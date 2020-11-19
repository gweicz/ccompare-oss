const fs = require('fs')
const path = require('path')
const axios = require('axios')
const qs = require('querystring')
const crypto = require('crypto')
const Influx = require('influx')
// const WebSocket = require('ws')
const Redis = require('ioredis')
const redis = new Redis()

const symbols = require('./symbols')

const banned = [
  'hashback',
//  'bitbay',
//  'bitcantor',
  'moonpay',
//  'coinbank',
//  'virtualproperty',
  'tokeneo',
  'extstock',
  'sonatacoin',
  'coinbank',
  'bitcoinmat',
  'bitmaszyna'
]

const oracles = {
  'coinbase-pro': {
    name: 'Coinbase Pro'
  },
  kraken: {
    name: 'Kraken'
  }
}

const lastValues = {}

const fiats = {
  czk: {},
  eur: {},
  uah: {},
  pln: {},
  chf: {},
}

const baseAmounts = {
  btc: 0.05,
  eth: 2,
  ltc: 5,
  dai: 200,
  usdc: 200,
  usdt: 200,
//  ebase: 200,
  zec: 10,
  xlm: 5000,
  dash: 5,
  bat: 2000,
  ada: 10000,
}

function relDiff (a, b) {
  return 100 * ((a - b) / ((a + b) / 2))
}

class CCompare {
  constructor ({ server }) {
    this.server = server
    this.axios = axios
    this.oracleRates = {}
    this.cacheDir = path.join(__dirname, 'cache')
    this.cacheTimeout = 30 * 1000
    this.intervalMs = 1000 * 40
    this.fiatIntervalMs = 1000 * 60 * 15
    this.qs = qs
    this.influxDbName = 'ccompare'
    this.BTCHalvingTime = null
  }

  async start () {
    await this.initRoutes()
    this.influx = await this.loadInflux()
    console.log(`InfluxDB connected: ${this.influxDbName}`)
    this.providers = await this.loadProviders()
    console.log(`Providers: ${this.providers.map(p => p.id).join(', ')}`)
    this.rates = await this.fiatRates()
    console.log(`Fiat rates: ${JSON.stringify(this.rates)}`)

    // halving
    //this.updateBtcHalving()
    //setInterval(() => this.updateBtcHalving(), 1000 * 60 * 15)

    setTimeout(() => {
      // setInterval(() => this.periodic(), this.intervalMs)
      setInterval(() => this.fiatPeriodic(), this.fiatIntervalMs)
    }, 5000)
    // this.ws = await this.initWebsocket()
    // console.log(`Websocket server initialized`)
    console.log('CCompare engine started')
    this.periodic()
  }

  async periodic () {
    const st = new Date()
    console.log('periodic started')
    for (const source of Object.keys(fiats)) {
      for (const dir of ['buy', 'sell']) {
        for (const target of Object.keys(baseAmounts)) {
          console.log(`Periodic: ${dir} ${source} ${target}`)
          await this.search({ dir, source, target, value: baseAmounts[target], peridic: true })
          await (new Promise(resolve => setTimeout(resolve, 200)))
        }
      }
    }
    console.log(`periodic done: ${(Number(new Date()) - Number(st)) / 1000}s`)
    this.periodic()
  }

  fiatRate (source, target) {
    return this.rates[[target.toUpperCase(), source.toUpperCase()].join('_')]
  }

  async fiatPeriodic () {
    this.rates = await this.fiatRates()
  }

  hash (obj) {
    return String(crypto.createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex'))
  }

  saveCache (key, obj) {
    redis.set(key, JSON.stringify({ data: obj, time: new Date() }))
  }


  async loadCache (key, timeout = null) {
    const cached = await redis.get(key)
    if (!cached) {
      return null
    }
    const res = JSON.parse(cached)
    const offset = (Number(new Date()) - Number(new Date(res.time)))
    if (offset > ((timeout || this.cacheTimeout) - (Math.random(1) * 1000))) {
      return null
    }
    return res.data
  }

  async index () {
    return {
      welcome: 'ccompare-czsk-api',
      exampleUrl: 'https://api.kurzy.gwei.cz/exchange?value=1&source=czk&target=eth'
    }
  }

  async initRoutes () {
    this.server.route({
      method: 'GET',
      path: '/',
      handler: req => this.index()
    })
    this.server.route({
      method: 'GET',
      path: '/exchange',
      handler: req => this.search(req.query, req)
    })
    this.server.route({
      method: 'GET',
      path: '/fiat',
      handler: req => this.rates
    })
    this.server.route({
      method: 'GET',
      path: '/chart',
      handler: req => this.chart(req)
    })
    this.server.route({
      method: 'GET',
      path: '/btc-halving',
      handler: req => ({ time: this.BTCHalvingTime })
    })
    this.server.subscription('/rates/{dir}/{source}/{target}/{value}/{ref}')
  }

  async updateBtcHalving () {
    const r = await axios({ url: 'https://www.bitcoinblockhalf.com/', json: false })
    const html = r.data
    const m = html.match(/Reward-Drop ETA date: <strong>(.+)<\/strong>/)
    if (!m) {
      console.error('cannot parse btc halving value')
    }
    this.BTCHalvingTime = Number(new Date(m[1])) / 1000
  }

  async chart (req) {
    const pair = req.query.pair
    if (!pair) { return {} }
    const data = await this.influx.query(`SELECT mean("price") FROM "rate" WHERE ("pair" = '${pair}' AND "base" = 'yes' AND "oracle" = 'yes') AND time >= now() - 2d GROUP BY time(5m) fill(linear); SELECT mean("price") FROM "rate" WHERE ("pair" = '${pair}' AND "base" = 'yes') AND time >= now() - 2d GROUP BY time(5m), "dir" fill(linear)`)
    return data
  }
  
  async fiatRates () {
    const arr = []
    for (const f of Object.keys(fiats)) {
      arr.push('USD' + f.toUpperCase())
    }
    const rts = {}
    /*const url = 'https://www.freeforexapi.com/api/live?pairs=' + arr.join(',')
    const res = await this.fetch({ url, timeout: 1000 * 60 * 30, json: true }, 'freeforexapi')
    const r = res.data.rates 

    const url = 'https://www.freeforexapi.com'
    const res = await this.fetch({ url, timeout: 1000 * 60 * 30, json: false }, 'freeforexapi_parse')
    const matches = res.data.matchAll(/<div id="([A-Z]+)_RateInv" class="RateNumber">([\d\.]+)<\/div>/g)
    const r = {}
    for (const m of matches) {
      r[m[1]] = { rate: 1 / Number(m[2]) }
      r[m[1].substring(3) + m[1].substring(0,3)] = { rate: Number(m[2]) }
    }*/
    const url = 'https://openexchangerates.org/api/latest.json?app_id=XXXX'
    let res = await this.fetch({ url, timeout: 1000 * 60 * 100, json: true }, 'openexchangerates')
    const r = {}
    if (!res.data) {
      res.error = false
      res.data = JSON.parse(fs.readFileSync('./cache/rates.json'))
    }
    for (const k of Object.keys(res.data.rates)) {
      r['USD'+k] = { rate: res.data.rates[k] }
      r[k+'USD'] = { rate: 1 / res.data.rates[k] }
    }
    if (res.data) {
      fs.writeFileSync('./cache/rates.json', JSON.stringify(res.data))
    }
    //console.log(r)
    //throw new Error()

    for (const f of Object.keys(fiats)) {
      if (res.error) {
        throw new Error(res.error)
      }
      for (const k of [ 'usd', ...Object.keys(fiats) ]) {
        const pairIdent = k.toUpperCase() + f.toUpperCase()
        const pair = k.toUpperCase() + '_' + f.toUpperCase()
        const pairReverse = f.toUpperCase() + '_' + k.toUpperCase()
        if (String(k) === String(f)) {
          rts[pair] = 1
          continue
        }
        if (r[pairIdent]) {
          rts[pair] = r[pairIdent].rate
        }
        // convert over usd
        if (r['USD' + f.toUpperCase()] && r['USD' + k.toUpperCase()]) {
          rts[pair] = Number(r['USD' + f.toUpperCase()].rate) * (1/Number(r['USD' + k.toUpperCase()].rate))
        }        
        rts[pairReverse] = 1 / rts[pair]
      }
    }
    this.influx.writePoints(Object.keys(rts).map(r => {
      return {
        measurement: 'fiat_rate',
        tags: { pair: r, oracle: 'freeforexapi' },
        fields: { price: Number(rts[r]) }
      }
    }))
    return rts
  }

  /*async fiatRates () {
    const pairs = [
      ['EUR_USD', 'CZK_USD' ],
      ['CZK_EUR', 'UAH_USD' ],
      ['UAH_CZK', 'UAH_EUR' ],
      ['PLN_USD', 'CZK_PLN' ],
      ['PLN_UAH', 'PLN_EUR' ],
    ]
    const rates = {}
    for (const ps of pairs) {
      const url = `https://free.currconv.com/api/v7/convert?q=${ps.join(',')}&compact=ultra&apiKey=XXXX`
      console.log(url)
      const res = await this.fetch({ url, timeout: 1000 * 60 * 60 * 12, json: true }, 'currconv')
      console.log(res)
      if (res.error) {
        throw new Error(res.error)
      }
      for (const k of Object.keys(res.data)) {
        rates[k] = res.data[k]
        rates[k.split('_').reverse().join('_')] = 1 / res.data[k]
      }
      await (new Promise(resolve => setTimeout(resolve, 5000)))
    }
    rates['EUR_EUR'] = 1
    this.influx.writePoints(Object.keys(rates).map(r => {
      return {
        measurement: 'fiat_rate',
        tags: { pair: r, oracle: 'currconv' },
        fields: { price: Number(rates[r]) }
      }
    }))
    return rates
  }*/

  oracleRateUrl (seller, base, symbol, web = false) {
    if (web) {
      return `https://cryptowat.ch/markets/${seller}/${[symbol, base].join('/').toLowerCase()}?apikey=XXXX`
    }
    return `https://api.cryptowat.ch/markets/${seller}/${(symbol + base).toLowerCase()}/price?apikey=XXXX`
  }

  async oracleRate (market, base, symbol) {
    const key = [market, base, symbol].join(':')
    const url = this.oracleRateUrl(market, base, symbol)
    //console.log(url)
    if (!this.oracleRates[key] || (Number(new Date()) - Number(this.oracleRates[key].time)) > (1000 * 120)) {
      const res = await this.fetch({ url, timeout: 1000 * 100, json: true }, 'cryptowatch')
      if (!res.data || !res.data.result) {
        console.log(res)
      }
      this.oracleRates[key] = {
        rate: res.data.result.price,
        time: new Date()
      }
    }
    return this.oracleRates[key].rate
  }

  async providerResolve (p, query, { obj }) {
    const pair = [query.target, query.source].join('-')
    const influxPoints = []
    const out = []
    if (!p.resolve) {
      return obj
    }
    // console.log(`-> ${p.id} started`)
    // const provStartTime = new Date()
    query.pair = [query.target, query.source].join('-')
    let res = {}
    try {
      res = await p.resolve(query)
    } catch (e) {
      console.error(p.id, e.message)
      out.push(Object.assign(obj, { error: 'chyba zdroje' }))
      /*influxPoints.push({
        measurement: 'search_provider_error',
        fields: { error: e.message },
        tags: { provider: p.id, dir: query.dir, pair }
      })*/
      res = Object.assign(obj, { error: 'chyba zdroje' })
    }
    // console.log(`-> ${p.id} done`)
    /* influxPoints.push({
      measurement: 'search_provider',
      fields: { duration: Number(new Date()) - Number(provStartTime), value: query.value },
      tags: { provider: p.id, dir: query.dir, pair, base, external: Boolean(req) }
    }) */
    if (!Array.isArray(res)) {
      res = [Object.assign(obj, res)]
    }
    const refRate = this.rates[query.source.toUpperCase() + '_' + query.ref.toUpperCase()]
    for (const i of res) {
      i.refSymbol = query.ref
      i.ref = String(Number(refRate) * Number(i.price))
    }
    return {
      res,
      influxPointsAdd: influxPoints
    }
  }

  async search (query, req = false) {
    const startTime = new Date()
    if (!query.value || !query.source || !query.target) {
      throw new Error('Bad params')
    }
    query.dir = query.dir || 'buy'
    query.ref = query.ref || 'usd'

    const hash = this.hash(query)
    if (!query.periodic) {
      const cached = await this.loadCache(hash, 20 * 1000)
      if (cached) {
        return cached.data
      }
    }

    const out = []
    const pair = [query.target, query.source].join('-')
    const sym = symbols[query.target] || {}
    const oracleRef = sym.ref ? [sym.ref[0], sym.ref[2], sym.ref[1]] : ['coinbase-pro', query.ref, query.target]
    const oracleRate = await this.oracleRate(...oracleRef)
    const baseAmount = baseAmounts[query.target]
    const base = Number(baseAmount) === Number(query.value) ? 'yes' : 'no'
    const influxPoints = []
    let aliases = []
    if (query.alts !== 'false') {
      const aa = Object.keys(fiats).filter(f => f !== query.source)
      if (query.alts) {
        for (const a of query.alts.split(',')) {
          if (aa.indexOf(a) !== -1) {
            aliases.push(a)
          }
        }
      } else {
        aliases = aa
      }
    }
    if (base === 'no') {
      console.log(`@@ ${query.dir} ${query.source} => ${query.target} (value=${query.value}, ref=${query.ref}, aliases=${query.aliases} [${aliases}])`)
    }
    const path = `/rates/${query.dir}/${query.source}/${query.target}/${query.value}/${query.ref}`
    const providersDone = this.providers.map(p => p.id).filter(p => banned.indexOf(p) === -1)
    const it = setInterval(() => {
      console.log(`Long request -- waiting [${Number(new Date()) - startTime}ms] -- ${providersDone.join(',')}`)
    }, 1000)
    await Promise.all(this.providers.map(async p => {
      if (banned.indexOf(p.id) !== -1) {
        return null
      }
      const obj = { seller: p.id, price: undefined }
      const qs = [[query, false]]
      qs.push(...aliases.map(a => [Object.assign(JSON.parse(JSON.stringify(query)), { source: a }), a]))
      await Promise.all(qs.map(async (input) => {
        const { res, influxPointsAdd } = await this.providerResolve(p, input[0], { obj: JSON.parse(JSON.stringify(obj)) })
        const arr = res.map(i => {
          const symbol = input[1]
          if (symbol) {
            i.origSymbol = symbol
          }
          if (symbol && i.price) {
            const rate = this.fiatRate(query.source, symbol)
            if (!rate) {
              return null
            }
            i.orig = i.price
            i.price = String(Number(i.price) * Number(rate))
          } else if (symbol && !i.error) {
            return null
          }
          return i
        }).filter(i => i !== null)
        arr.map(i => {
          if (!i.price) {
            return null
          }
          const fullPath = path + `/${i.seller}/${i.origSymbol}`
          if (!lastValues[fullPath]) {
            lastValues[fullPath] = i
          } else {
            const lv = lastValues[fullPath]
            if (String(lv.price) === String(i.price)) {
              return null
            }
          }
          this.server.publish(path, Object.assign({}, query, i))
        })
        out.push(...arr)
        influxPoints.push(...influxPointsAdd)
      }))
      providersDone.splice(providersDone.indexOf(p.id), 1)
    }))
    clearInterval(it)
    // add oracle rate
    const oraclePrice = String((Number(await oracleRate) * Number(query.value)) / Number(this.rates[`${query.source.toUpperCase()}_${query.ref.toUpperCase()}`]))
    const refRate = this.rates[query.source.toUpperCase() + '_' + query.ref.toUpperCase()]
    const oracle = {
      oracle: oracleRef[0],
      seller: `${oracles[oracleRef[0]] ? oracles[oracleRef[0]].name : oracleRef[0]} ${([oracleRef[2], oracleRef[1]].join('/')).toUpperCase()}`,
      price: oraclePrice,
      url: this.oracleRateUrl(...oracleRef, true),
      sourceUrl: this.oracleRateUrl(...oracleRef),
      ref: String(Number(refRate) * Number(oraclePrice)),
      refSymbol: query.ref,
    }
    out.push(oracle)
    this.server.publish(path, Object.assign({}, query, oracle))
    for (const i of out) {
      if (!i.price) {
        continue
      }
      if (Number(i.price) <= 0) {
        continue
      }
      const isOracle = i.oracle ? 'yes' : 'no'
      i.diff = relDiff(Number(i.price), Number(oracle.price))

      if (base) {
        influxPoints.push({
          measurement: 'rate',
          tags: { provider: (i.oracle ? i.oracle : i.seller) + (i.origSymbol ? `-${i.origSymbol}` : ''), pair, dir: query.dir, base, oracle: isOracle, ref: query.ref },
          fields: { amount: Number(query.value), price: Number(i.price) / Number(query.value), diff: i.diff }
        })
      }
    }

    // sort
    let sorted = out.filter(i => i.price).sort((a, b) => {
      return Number(a.price) > Number(b.price) ? 1 : -1
    })
    if (query.dir === 'sell') {
      sorted = sorted.reverse()
    }

    // duration time
    const duration = Number(new Date()) - Number(startTime)

    // save request to influx
    influxPoints.push({
      measurement: 'search',
      tags: { dir: query.dir, base, pair, external: Boolean(req) },
      fields: { duration, value: Number(query.value), /*ua: req ? req.headers['user-agent'] : null, ip: req ? req.headers['x-forwarded-for'] : null*/ }
    })

    this.influx.writePoints(influxPoints).catch(e => console.error(e.message))

    // return
    const obj = {
      dir: query.dir,
      source: query.source,
      target: query.target,
      value: query.value,
      ref: query.ref,
      alts: aliases,
      items: [].concat(sorted, out.filter(i => !i.price).filter(i => i.error).sort((a, b) => {
        return !a.error ? 1 : -1
      })),
      duration,
      date: new Date()
    }
    this.saveCache(hash, { data: obj })
    return obj
  }

  async fetch (opts, provider = null) {
    let out

    const hash = this.hash(opts)
    const cached = await this.loadCache(hash, opts.timeout)

    if (cached) {
      return cached
    }

    // console.log(`==> ${opts.url}`)
    const startTime = new Date()

    try {
      out = await axios(Object.assign(opts, { timeout: 2000 }))
    } catch (e) {
      console.error(opts.url, e.message)
      this.saveCache(hash, { error: e.message })
      this.influx.writePoints([{
        measurement: 'fetch_error',
        fields: { error: e.message },
        tags: { provider }
      }])
      return { error: e, data: {} }
    }
    const duration = Number(new Date()) - Number(startTime)
    this.saveCache(hash, { data: out.data })
    this.influx.writePoints([{
      measurement: 'fetch',
      fields: { duration, url: opts.url },
      tags: { provider }
    }])
    return out
  }

  async loadProviders () {
    const provs = []
    const dir = path.join(__dirname, 'providers')
    for (const fn of fs.readdirSync(dir)) {
      const p = require(path.join(dir, fn))(this)
      p.id = fn.split('.')[0]
      provs.push(p)
    }
    return provs
  }

  async loadInflux () {
    const influx = new Influx.InfluxDB({
      host: 'localhost',
      database: this.influxDbName,
      schema: [
        {
          measurement: 'rate',
          fields: {
            amount: Influx.FieldType.FLOAT,
            price: Influx.FieldType.FLOAT,
            diff: Influx.FieldType.FLOAT
          },
          tags: [
            'provider',
            'pair',
            'dir',
            'base',
            'oracle',
            'ref'
          ]
        },
        {
          measurement: 'fiat_rate',
          fields: {
            price: Influx.FieldType.FLOAT
          },
          tags: [
            'pair',
            'oracle'
          ]
        },
        {
          measurement: 'search',
          fields: {
            duration: Influx.FieldType.INTEGER,
            value: Influx.FieldType.FLOAT,
            ip: Influx.FieldType.STRING,
            ua: Influx.FieldType.STRING
          },
          tags: [
            'dir',
            'pair',
            'base',
            'external'
          ]
        },
        {
          measurement: 'search_provider',
          fields: {
            duration: Influx.FieldType.INTEGER,
            value: Influx.FieldType.FLOAT,
            error: Influx.FieldType.STRING
          },
          tags: [
            'provider',
            'dir',
            'pair',
            'base',
            'external'
          ]
        },
        {
          measurement: 'search_provider_error',
          fields: {
            error: Influx.FieldType.STRING
          },
          tags: [
            'provider',
            'dir',
            'pair'
          ]
        },
        {
          measurement: 'fetch_error',
          fields: {
            error: Influx.FieldType.STRING,
            url: Influx.FieldType.STRING
          },
          tags: [
            'provider'
          ]
        },
        {
          measurement: 'fetch',
          fields: {
            duration: Influx.FieldType.INTEGER,
            url: Influx.FieldType.STRING
          },
          tags: [
            'provider'
          ]
        }
      ]
    })
    const influxDbNames = await influx.getDatabaseNames()
    if (!influxDbNames.includes(this.influxDbName)) {
      await influx.createDatabase(this.influxDbName)
    }
    return influx
  }

  calcOrderBook (val, book, altamount = false) {
    if (Array.isArray(book[0])) {
      book = book.map(i => ({ price: i[0], amount: i[1] }))
    }
    let rest = Number(val)
    let cost = 0
    for (const i of book) {
      const price = Number(i.price)
      const amount = Number(i.amount || i.baseAmount)
      if (rest <= 0) {
        break
      }
      if (amount > rest) {
        cost += rest * price
        rest = 0
      } else if (amount <= rest) {
        cost += amount * price
        rest -= amount
      }
    }
    return { rest, cost }
  }
}

module.exports = CCompare
