
const m = require('mithril')
const Nes = require('@hapi/nes/lib/client')
const numeral = require('numeral')
const USON = require('uson')
const i18next = require('i18next')
const i18n = i18next.default
const yaml = require('js-yaml')
const fs = require('fs')
const ChartJS = require('chart.js')

const flagEmojis = require('./flag-emojis')
const sellers = require('./sellers')
const locales = require('./locales.yaml')

const flags = {
  'no-kyc': { ico: 'fas fa-eye-slash', name: 'Možný nákup bez KYC' },
  cash: { ico: 'fas fa-money-bill-wave', name: 'Hotovost' },
  exchange: { ico: 'fas fa-analytics', name: 'Burza', color: 'green', fixed: true },
  verified: { ico: 'fas fa-badge-check', name: 'Ověřený prodejce', color: 'green', fixed: true },
  cards: { ico: 'fas fa-credit-card', name: 'Podpora platebních karet' },
  wire: { ico: 'fas fa-university', name: 'Platby na bankovní účet' },
  custody: { ico: 'fas fa-wallet', name: 'Integrovaná peněženka (custody) - NEBEZPEČNÉ' },
  'no-bank-account': { ico: 'fas fa-exclamation-triangle', name: 'Není možné vkládat/vybírat fiat - nepoužitelné pro směnu', color: '#e64c4c', fixed: true },
  direct: { ico: 'fas fa-forward', name: 'Přímé zaslání z účtu do peněženky či naopak (bez custody)' },
  'no-2fa': { ico: 'fas fa-unlock', name: 'Nepodporuje dvoufaktorovou autentizaci (2FA) - doporučujeme okamžitě přeposlat prostředky do vlastní peněženky', color: '#e64c4c', fixed: true }
}

const symbols = {
  czk: { type: 'fiat', name: 'CZK', aliases: ['eur', 'pln', 'uah', 'chf'], format: val => `${val} Kč` },
  eur: { type: 'fiat', name: 'EUR', aliases: ['czk', 'pln', 'uah', 'chf'], format: val => `€${val}` },
  usd: { type: 'base', name: 'USD', format: val => `$${val}` },
  pln: { type: 'fiat', name: 'PLN', aliases: ['czk', 'eur', 'uah', 'chf'], format: val => `${val} zł` },
  uah: { type: 'fiat', name: 'UAH', aliases: ['czk', 'eur', 'pln', 'chf'], format: val => `₴${val}` },
  chf: { type: 'fiat', name: 'CHF', aliases: ['czk', 'eur', 'pln', 'uah'], format: val => `${val} fr.` },
  btc: { type: 'crypto', name: 'BTC', title: 'Bitcoin', base: 0.05 },
  eth: { type: 'crypto', name: 'ETH', title: 'Ether', base: 2 },
  dai: { type: 'crypto', name: 'DAI', title: 'Dai Stablecoin', base: 200 },
  usdc: { type: 'crypto', name: 'USDC', title: 'USD Coin', base: 200 },
  usdt: { type: 'crypto', name: 'USDT', title: 'Tether', base: 200 },
  ltc: { type: 'crypto', name: 'LTC', title: 'Litecoin', base: 5 },
  zec: { type: 'crypto', name: 'ZEC', title: 'Zcash', base: 10 },
  xlm: { type: 'crypto', name: 'XLM', title: 'Stellar Lumens', base: 5000 },
  dash: { type: 'crypto', name: 'DASH', title: 'Dash', base: 5 },
  bat: { type: 'crypto', name: 'BAT', title: 'Basic Attention Token', base: 2000 },
  ada: { type: 'crypto', name: 'ADA', title: 'Cardano', base: 10000 }
}

for (const sk of Object.keys(symbols)) {
  const s = symbols[sk]
  s.symbol = sk
  if (!s.format) {
    s.format = val => `${val} ${s.name}`
  }
}

const baseSymbols = ['usd', 'eur']

let defaultLanguage = ((navigator.languages ? navigator.languages[0] : (navigator.language || navigator.userLanguage)).split('-')[0] || 'cs')
const languages = {
  cs: { source: 'czk', name: 'Čeština', emoji: '🇨🇿' },
  en: { source: 'czk', name: 'English', emoji: '🇬🇧' },
  ua: { source: 'uah', name: 'Українська', emoji: '🇺🇦' }
}
const supportedLangs = Object.keys(languages)
if (!supportedLangs.includes(defaultLanguage)) {
  defaultLanguage = 'en'
}

i18n.init({
  lng: defaultLanguage,
  debug: true,
  resources: locales
})

const apiUrl = 'https://api.kurzy.gwei.cz'
const nes = window.nes = new Nes.Client(apiUrl.replace('https', 'wss'))
let ws = null
let subscribed = false
let refresh = false

const defaultState = (lang = 'cs', dir = 'buy', target = 'btc') => ({
  dir,
  source: languages[lang].source,
  target,
  value: String(symbols[target].base),
  ref: 'usd',
  alts: baseAliases(languages[lang].source)
})

const stateParams = ['ref', 'alts']
let state = Object.assign({}, defaultState())

function baseAliases (src) {
  if (!symbols[src].aliases) {
    return []
  }
  return JSON.parse(JSON.stringify(symbols[src].aliases))
}

const params = {
  lang: defaultLanguage,
  live: true,
  oracleDiff: true,
  advanced: true,
  debug: false
}

let loading = false
let currentSearch = null
const lastSocket = new Date()
let result = { items: [] }
let fiatRates = null
let fiatRatesPromise = null

nes.connect().then(() => {
  ws = true
})

let valueChanging = false

function stateSetter (key) {
  return function (e) {
    const old = state[key]
    state[key] = e.target.value
    if (key === 'source') {
      state.alts = baseAliases(state[key])
    }
    if (key === 'target') {
      if (Number(state.value) === Number(symbols[old].base) || Number(state.value) <= 0) {
        state.value = String(symbols[state[key]].base)
      }
    }
    if (key === 'value') {
      const retry = () => {
        if (Number(new Date()) - Number(valueChanging) > 500) {
          valueChanging = false
          doSearch()
        } else {
          m.redraw()
          setTimeout(() => retry(), 250)
        }
      }
      if (!valueChanging) {
        valueChanging = new Date()
        setTimeout(() => retry(), 250)
      } else {
        valueChanging = new Date()
      }
    } else {
      doSearch()
    }
  }
}

function stateCheckbox (key) {
  return function (e) {
    state[key] = e.target.checked
    doSearch()
  }
}

function stateCheckboxAliases (key) {
  return function (e) {
    const val = e.target.checked
    if (val) {
      state[key] = baseAliases(state.source)
    } else {
      state[key] = false
    }
    doSearch()
  }
}

function stateCheckboxArray (key, symbol) {
  return function (e) {
    if (e.target.checked) {
      if (!state[key]) {
        state[key] = []
      }
      state[key].push(symbol)
    } else {
      if (state[key].length <= 1) {
        if (key === 'alts') {
          state.alts = false
        }
      } else {
        state[key].splice(state[key].indexOf(symbol), 1)
      }
    }
    doSearch()
  }
}

function paramCheckbox (key) {
  return function (e) {
    const val = e.target.checked
    params[key] = e.target.checked
    if (key === 'live') {
      if (!val && subscribed) {
        nes.unsubscribe(subscribed)
        subscribed = false
      } else {
        initSubscriptions()
      }
      // setRoute()
    }
  }
}
function paramSetter (key) {
  return function (e) {
    params[key] = e.target.value

    // language set
    if (key === 'lang') {
      i18n.changeLanguage(params[key]).then(() => {
        setRoute()
      })
    }
  }
}

function updateTitle () {
  let title = ''
  if (result && result.items.length > 0 && !loading) {
    const price = formatSymbol(state.source, numeral(result.items.filter(i => !i.oracle)[0].price).format('0,0.00'))
    title = `${i18n.t(state.dir)} ${state.value} ${state.target.toUpperCase()} ${i18n.t('for')} ${price} | ${i18n.t('header')}`
  } else {
    title = `${i18n.t(state.dir)} ${state.target.toUpperCase()}/${state.source.toUpperCase()} | ${i18n.t('header')}`
  }
  if (document.title !== title) {
    document.title = title
  }
}

function setRoute () {
  const url = getRouteUrl()
  if (url !== m.route.get()) {
    m.route.set(url)
  }
  updateTitle()
}

function getSymbols (type) {
  return Object.keys(symbols).filter(s => symbols[s].type === type).map(symbol => Object.assign(symbols[symbol], { symbol }))
}
function relDiff (a, b) {
  return 100 * ((a - b) / ((a + b) / 2))
}
function sortObject (obj) {
  return Object.keys(obj)
    .sort().reduce((a, v) => {
      a[v] = obj[v]
      return a
    }, {})
}
function getRoute () {
  if (state.alts && Array.isArray(state.alts) && state.alts.length > 1) {
    state.alts = state.alts.sort()
  }
  const defaultStateNorm = JSON.stringify(sortObject(defaultState(params.lang, state.dir, state.target)))
  const stateClone = JSON.parse(JSON.stringify(state))
  stateClone.target = stateClone.target.split('-')[0]
  const stateNorm = JSON.stringify(sortObject(stateClone))
  const obj = {
    lang: params.lang,
    params: { ...state, dir: state.dir === 'sell' ? i18n.t('url_sell') : i18n.t('url_buy') },
    default: defaultStateNorm === stateNorm,
    x: [defaultStateNorm, stateNorm]
  }
  const par = []
  for (const p of stateParams) {
    if (p === 'alts') {
      if ((state[p] && Array.isArray(state[p]) ? state[p] : []).sort().join(',') === baseAliases(state.source).sort().join(',')) {
        continue
      }
    }
    const cp = state[p] || params[p]
    par.push(p + '=' + (Array.isArray(cp) ? '[' + cp.sort().join(',') + ']' : (cp === undefined ? 'false' : cp)))
  }
  if (Object.keys(par).length > 0) {
    obj.params.params = par.join(',')
  }
  return obj
}

function getRouteUrl () {
  const rt = getRoute()
  const perm = ['lang', 'dir', 'target']
  const opt = ['source', 'value', 'params']
  const tsymbol = symbols[rt.params.target]
  rt.target = rt.params.target + (tsymbol ? '-' + tsymbol.title.toLowerCase().replace(/\s+/g, '-') : '')
  return '/' + (perm.map(k => rt[k] || rt.params[k]).join('/')) + (!rt.default ? '/' + opt.map(k => rt.params[k]).filter(v => v).join('/') : '')
}

function formatSymbol (symbol, val) {
  return symbols[symbol].format(val)
}

function offsetClass (dir, offset) {
  const n = Number(offset)
  if (n === 0) {
    return ''
  }
  if ((dir !== 'sell' && n > 6) || (dir === 'sell' && n < -6)) {
    return 'is-red'
  }
  if ((dir !== 'sell' && n >= 3) || (dir === 'sell' && n <= -3)) {
    return 'is-yellow'
  }
  if ((dir !== 'sell' && n < 3) || (dir === 'sell' && n > -3)) {
    return 'is-green'
  }
  return 'is-none'
}

function waitForCore () {
  return Promise.all([
    fiatRatesPromise
  ])
}

function searchSubPath () {
  return `/rates/${state.dir}/${state.source}/${state.target}/${state.value}/${state.ref}`
}

function initSubscriptions () {
  subscribed = searchSubPath()
  nes.subscribe(subscribed, (x) => {
    if (!(x.source === state.source && x.target === state.target && String(x.value) === state.value && x.dir === state.dir)) {
      return null
    }
    const f = result.items.find(i => i.seller === x.seller && i.origSymbol === x.origSymbol && x.refSymbol === state.ref)
    if (x.oracle) {
      console.log([x, f])
    }
    if (f && String(f.price) !== String(x.price) && Number(x.price) !== 0) {
      x.updated = false
      const oldf = JSON.parse(JSON.stringify(f))
      f.updated = false
      m.redraw()
      setTimeout(() => {
        Object.assign(f, x)
        if (state.dir === 'sell') {
          f.updated = Number(x.price) > Number(oldf.price) ? 'good' : 'bad'
        } else {
          f.updated = Number(x.price) < Number(oldf.price) ? 'good' : 'bad'
        }
        f.updatedTime = Number(new Date())
        updateTitle()
        m.redraw()
        setTimeout(() => {
          m.redraw()
        }, 1300)
      }, 10)
    }
  })
  refresh = setInterval(() => {
    doSearch(false)
  }, 8000)
}

let defaultRoute = getRouteUrl()

function execSearch (use) {
  return new Promise((resolve) => {
    if (Number(state.value) === 0) {
      return null
    }
    if (use) {
      loading = true
      setRoute()

      if (subscribed) {
        nes.unsubscribe(subscribed)
        subscribed = false
      }
      if (refresh) {
        clearTimeout(refresh)
      }
    }

    const nstate = JSON.parse(JSON.stringify(state))
    if (nstate.alts && Array.isArray(nstate.alts) && nstate.alts.length > 0) {
      nstate.alts = nstate.alts.join(',')
    }
    m.request(`${apiUrl}/exchange?${m.buildQueryString(nstate)}`).then(res => {
      waitForCore().then(() => {
        if (use) {
          result = res
          loading = false
          updateTitle()
          m.redraw()
        }
        resolve()
      })
    }).catch(err => {
      loading = false
      console.error(JSON.stringify(err, null, 2))
    })
    if (!subscribed && params.live) {
      initSubscriptions()
    }
    if (use) {
      // loadChart()
    }
  })
}

function doSearch (use = true) {
  if (currentSearch) {
    currentSearch.then(() => {
      execSearch(use)
    })
    return false
  }
  currentSearch = execSearch(use)
  return false
}

let chartData = null
let chart = null

function loadChart () {
  chartData = null
  m.request(apiUrl + '/chart?pair=' + [state.target, state.source].join('-')).then(res => {
    chartData = res
    if (chart) {
      chart.data = chartDataInit(chartData)
      chart.update()
    }
  })
}

function chartDataInit (data) {
  return {
    datasets: [
      {
        label: 'oracle',
        data: data[0].map(i => ({ t: new Date(i.time), y: i.mean })),
        pointRadius: 0,
        fill: false,
        borderWidth: 1,
        borderColor: 'blue'
      },
      {
        label: 'buy',
        data: data[1].filter(i => i.dir === 'buy').map(i => ({ t: new Date(i.time), y: i.mean })),
        pointRadius: 0,
        fill: false,
        borderWidth: 1,
        borderColor: 'green'
      },
      {
        label: 'sell',
        data: data[1].filter(i => i.dir === 'sell').map(i => ({ t: new Date(i.time), y: i.mean })),
        pointRadius: 0,
        fill: false,
        borderWidth: 1,
        borderColor: 'red'
      }
    ]
  }
}

const Chart = {
  oninit (vnode) {
    loadChart()
  },
  view (vnode) {
    if (!chartData && !chart) {
      return ''
    }
    return m('#canvas-holder', [
      m('canvas#chart-area', {
        height: 100,
        oncreate (vnode) {
          const ctx = vnode.dom.getContext('2d')
          chart = new ChartJS(ctx, {
            type: 'line',
            data: chartDataInit(chartData),
            options: {
              legend: {
                display: false
              },
              tooltips: {
                mode: 'index',
                intersect: false
              },
              hover: {
                mode: 'nearest',
                intersect: true
              },
              scales: {
                xAxes: [{
                  type: 'time',
                  time: {
                    unit: 'hour'
                  }
                }],
                yAxes: [{
                  ticks: {
                    callback: (val) => formatSymbol(state.source, numeral(val).format('0,0'))
                  }
                }]
              }
            }
          })
        }
      })
    ])
  }
}

const Table = {
  view (vnode) {
    if (loading) {
      return m('div', { style: 'text-align: center; margin-top: 5em; margin-bottom: 10em;' }, m('.loading'))
    }
    if (!result) {
      return m('div', '')
    }
    let best = null
    if (vnode.attrs.oracleDiff) {
      best = result.items.filter(i => i.price && i.oracle)[0]
    } else {
      best = result.items.filter(i => i.price && !i.oracle)[0]
    }
    let sorted = result.items.filter(i => i.price).sort((a, b) => {
      return Number(a.price) > Number(b.price) ? 1 : -1
    })
    if (result.dir === 'sell') {
      sorted = sorted.reverse()
    }
    const items = [].concat(sorted, result.items.filter(i => !i.price).filter(i => i.error).sort((a, b) => {
      return !a.error ? 1 : -1
    }))
    return m('table.table.is-fullwidth.cc-table', { style: 'margin-bottom: 1em; margin-top: 0.5em;' }, [
      m('thead', [
        m('th', { colspan: 3 }, ''),
        m('th', { align: 'center' }, m.trust(i18n.t('rate') + '<sup>*</sup>')),
        m('th', { align: 'center' }, i18n.t('difference')),
        m('th', { align: 'right' }, m.trust(i18n.t('price') + '<sup>*</sup>'))
      ]),
      m('tbody', items.map(r => {
        if (Number(r.price) < 1) {
          return null
        }
        const offset = best ? relDiff(Number(r.price), Number(best.price)) : null
        const seller = sellers[r.seller] || { name: r.seller }
        const cl = offsetClass(result.dir, offset)
        const sellerTd = [
          m(`.seller-ico.seller-${seller.ico || r.seller}`),
          r.oracle ? m.trust(`${i18n.t('reference_price')} [<a href="${r.url}" target="_blank">${seller.name}</a>]`) : m('a', { href: seller.url, target: '_blank' }, seller.name + (r.origSymbol ? ` [${r.origSymbol.toUpperCase()}]` : ''))
        ]

        if (!r.price) {
          return m('tr.is-inactive', [
            m('td', sellerTd),
            m('td', { colspan: 5, align: 'center' }, `-- ${r.error ? r.error : 'žádné data'} --`)
          ])
        }
        const showPrice = () => {
          const primary = `${r.orig ? '~ ' : ''}${formatSymbol(result.source, numeral(Math.round(r.price * 100) / 100).format('0,0.00'))}`
          const secondary = r.orig ? `<small>${formatSymbol(r.origSymbol, numeral(Math.round(r.orig * 100) / 100).format('0,0.00'))}</small>` : ''
          return m.trust([!r.oracle ? `<b>${primary}</b>` : primary, secondary].join('<br>'))
        }

        const ref = formatSymbol(result.ref, numeral(Number(r.ref) / Number(result.value)).format('0,0.00'))
        return m('tr', { key: r.provider, id: r.provider, class: `${r.oracle ? 'is-oracle' : ''} ${r.updated && (Number(new Date()) - r.updatedTime) < 1300 ? 'updated make mk-' + r.updated : ''}` }, [
          m('td', sellerTd),
          m('td', { align: 'left' }, (!seller || !seller.flags) ? '' : seller.flags.map(sf => {
            const fl = flags[sf]
            return m('i.flag', { class: fl.ico + (fl.fixed ? ' ' + 'fixed' : ''), style: `color: ${fl.color ? fl.color : 'gray'};`, title: fl.name, alt: fl.name })
          })),
          m('td', { style: 'padding-left: 0; padding-right: 0;' }, !seller.countries ? '' : seller.countries.map(c => {
            const em = flagEmojis.find(e => e.code === c.toUpperCase())
            return m('.flag-country', { alt: em.name, title: em.name }, em.emoji)
          })),
          m('td', { align: 'center', style: 'font-size: 0.8em; line-height: 1.2em;' }, r.price ? m.trust(formatSymbol(result.source, numeral(Number(r.price) / Number(result.value)).format('0,0.00')) + `<br>${ref}`) : ''),
          m('td', { align: 'center', class: cl }, r.price ? (offset ? `${offset > 0 ? '+' : ''}${Math.round(offset * 100) / 100}%` : (r.oracle ? '0%' : 'nejlepší nabídka')) : ''),
          m('td', { align: 'right', style: `${r.orig ? 'line-height: 1.1em; padding-top: 0.4em; padding-bottom: 0.3em;' : ''}` }, r.price ? showPrice() : '')
        ])
      }))
    ])
  }
}

const Form = {
  view () {
    return [
      m('.columns.is-centered', { style: 'margin-top: 0;' }, [
        m('.column.is-two-thirds', [
          m('form', { onsubmit: doSearch }, [
            m('.level', { style: '' }, [
              m('.level-item', [
                m('.select', [
                  m('select', { onchange: stateSetter('dir'), value: state.dir }, [
                    m('option', { value: 'buy' }, i18n.t('buy')),
                    m('option', { value: 'sell' }, i18n.t('sell'))
                  ])
                ])
              ]),
              m('.level-item', [
                m('input.input', { type: 'text', placeholder: i18n.t('amount'), oninput: stateSetter('value'), value: state.value })
              ]),
              m('.level-item', [
                m('.select', [
                  m('select', { onchange: stateSetter('target'), value: state.target }, getSymbols('crypto').map(s => {
                    return m('option', { value: s.symbol }, s.name)
                  }))
                ])
              ]),
              m('.level-item', i18n.t('for')),
              m('.level-item', [
                m('.select', [
                  m('select', { onchange: stateSetter('source'), value: state.source }, getSymbols('fiat').map(s => {
                    return m('option', { value: s.symbol }, s.name)
                  }))
                ])
              ]),
              m('.level-item', [
                m('button.button.is-primary', { onclick: doSearch }, i18n.t('search'))
              ])
            ])
          ])
        ])
      ]),
      !params.advanced ? '' : m('.columns.is-centered', [
        m('.column.is-two-thirds', [
          m('.level.ccompare-params', { style: 'font-size: 0.9em;' }, [
            m('.level-left', [
              /* m('.level-item', [
                m('label.checkbox', [
                  m('input', { type: 'checkbox', onchange: paramCheckbox('oracleDiff'), checked: params.oracleDiff }),
                  m('span', { style: 'margin-left: 0.5em;' }, 'Rozdíl ceny vůči referenčnímu kurzu')
                ])
              ]), */
              /* m('.level-item', [
                m('label.checkbox', [
                  m('input', { type: 'checkbox', onchange: paramCheckbox('debug'), checked: params.debug }),
                  m('span', { style: 'margin-left: 0.5em;' }, 'Debug')
                ])
              ]), */
              m('.level-item', [
                m('label.checkbox', [
                  m('input', { type: 'checkbox', onchange: stateCheckboxAliases('alts'), checked: Boolean(state.alts) }),
                  m('span', { style: 'margin-left: 0.5em;' }, i18n.t('alt_currencies') + ':')
                ])
              ]),
              getSymbols('fiat').filter(f => baseAliases(state.source).indexOf(f.symbol) !== -1).map(s => {
                const checked = !state.alts ? false : state.alts.indexOf(s.symbol) !== -1
                return m('.level-item', m('div', [
                  m('div', m('label.checkbox', [
                    m('input', { type: 'checkbox', onchange: stateCheckboxArray('alts', s.symbol), checked }),
                    m('span', { style: 'margin-left: 0.5em;' }, s.name),
                    fiatRates ? m('div', { style: `font-size: 0.9em; opacity: ${checked ? 0.6 : 0.3}; margin-top: 0.1em;` }, formatSymbol(state.source, numeral(fiatRates[`${s.symbol.toUpperCase()}_${state.source.toUpperCase()}`]).format('0,00.00'))) : ''
                  ]))
                ]))
              }),
              m('.level-item.padded', [
                m('div', { style: 'margin-right: 0.2em;' }, i18n.t('reference_currency') + ':')
              ]),
              baseSymbols.map(bs => {
                const s = symbols[bs]
                const checked = state.ref === bs
                return m('.level-item', m('div', [
                  m('.control', { style: 'font-size: inherit;' }, m('label.radio', [
                    m('input', { type: 'radio', onchange: stateSetter('ref'), value: bs, checked }),
                    m('span', { style: 'margin-left: 0.5em;' }, s.name),
                    fiatRates ? m('div', { style: `font-size: 0.9em; opacity: ${checked ? 0.6 : 0.3}; margin-top: 0.1em;` }, formatSymbol(state.source, numeral(fiatRates[`${s.symbol.toUpperCase()}_${state.source.toUpperCase()}`]).format('0,00.00'))) : ''
                  ]))
                ]))
              }),
              m('.level-item.padded', [
                m('label.checkbox', [
                  m('input', { type: 'checkbox', onchange: paramCheckbox('live'), checked: params.live }),
                  m('span', { style: 'margin-left: 0.5em;' }, [i18n.t('live_mode'), m(`i.fas.${params.live ? 'fa-eye' : 'fa-eye-slash'}`, { style: `margin-left: 0.5em; ${nes._subscriptions[searchSubPath()] ? 'color: green;' : ''};` })])
                ])
              ])
            ])
          ])
        ])
      ])
    ]
  }
}

const Debug = {
  view () {
    return !params.debug ? '' : m('div', [
      m('div', { style: 'margin-top: 5em;' }, [
        m('.title.is-5', 'Debug (input)'),
        m('pre.code', '// state\n' + JSON.stringify(state, null, 2)),
        m('pre.code', '// params\n' + JSON.stringify(params, null, 2))
      ]),
      m('div', { style: 'margin-top: 5em;' }, [
        m('.title.is-5', 'Debug (result)'),
        m('pre.code', JSON.stringify(result, null, 2))
      ])
    ])
  }
}

function initRoutes (vnode) {
  if (!vnode.attrs) {
    return null
  }
  let aliasesUsed = false
  if (vnode.attrs) {
    params.lang = vnode.attrs.lang || defaultLanguage
    state = defaultState(params.lang)
    defaultRoute = getRouteUrl()
    i18n.changeLanguage(params.lang)

    for (const k of Object.keys(vnode.attrs)) {
      if (state[k]) {
        if (k === 'dir') {
          state[k] = vnode.attrs[k] === i18n.t('url_buy') ? 'buy' : 'sell'
        } else if (k === 'target') {
          state[k] = vnode.attrs[k].split('-')[0]
        } else {
          state[k] = vnode.attrs[k]
        }
      }
      if (k === 'params') {
        const v = vnode.attrs[k].replace(/=/g, ':').replace(/,/g, ' ')
        const par = USON.parse(v, 'object')
        for (const p of Object.keys(par)) {
          if (p === 'alts') {
            aliasesUsed = true

            if (state[p] && state[p].length === 1) {
              state.alts = false
              continue
            }
          }
          if (state[p] && state[p] !== undefined) {
            state[p] = par[p]
          } else {
            params[p] = par[p]
          }
        }
      }
    }
  }
  if (!aliasesUsed) {
    state.alts = baseAliases(state.source)
  }
  if (!vnode.attrs.value && vnode.attrs.target) {
    state.value = String(symbols[state.target].base)
  }
  setRoute()
  doSearch()
}

const Page = {
  oninit (vnode) {
    fiatRatesPromise = m.request(apiUrl + '/fiat').then(res => {
      fiatRates = res
    })
    initRoutes(vnode)
  },
  view () {
    return m('.section', [
      m('div', { style: 'position: absolute; right: 2em; top: 1.5em; z-index: 1;' }, [
        m('.select', [
          m('select', { onchange: paramSetter('lang'), value: params.lang }, Object.keys(languages).map(lk => {
            const l = languages[lk]
            return m('option', { value: lk }, `${l.emoji} ${l.name}`)
          }))
        ])
      ]),
      m('.container', [
        m('.columns.is-centered', [
          m('.column.is-three-quarters', [
            m('.figure', { style: 'text-align: center; margin-bottom: 1em;' }, [
              // m('.title.is-1', m.trust('Czech Crypto Index')),
              m('.title.is-2', m('a', { href: `/${params.lang}/`, style: 'color: #222;' }, i18n.t('header')))
            ])
          ])
        ]),
        m(Form),
        m('.columns.is-centered', [
          m('.column.is-three-quarters', [
            // m(Chart),
            m(Table, params),
            m(Debug)
          ])
        ]),
        !result || loading ? '' : m('div', { align: 'center', style: 'margin-top: 2em;' }, [
          m('p', m.trust('<sup>*</sup> ' + i18n.t('note_price1'))),
          m('p', m.trust('<sup>*</sup> ' + i18n.t('note_price2'))),
          m('p', i18n.t('note_update'))
        ]),
        m('div', { align: 'center', style: 'margin-top: 4em;' }, [
          m('a', { href: 'https://gwei.cz', target: '_blank' }, m('.gwei-logo')),
          m('div', m.trust(i18n.t('footer_author'))),
          params.lang !== 'cs' ? '' : m('div', { style: 'margin-top: 0.5em; font-size: 1.2em;' }, m.trust('<a href="https://discord.gg/FpxwbnM" target="_blank">Připojte se na náš Discord</a>'))
        ])
      ])
    ])
  }
}

const root = document.getElementById('app')
m.mount(root, Page)

m.route.prefix = ''
m.route(root, '/', {
  '/': Page,
  '/:lang': Page,
  '/:lang/:dir': Page,
  '/:lang/:dir/:target': Page,
  '/:lang/:dir/:target/:source': Page,
  '/:lang/:dir/:target/:source/:value': Page,
  '/:lang/:dir/:target/:source/:value/:params': Page
})
