
module.exports = function (engine) {
  const subs = [
    'coinbank',
    'coinexchange'
  ]

  const limits = {
    coinexchange: {
      min: 1000,
      max: 25000
    },
    coinbank: {
      daily: 100000
    }
  }

  return {

    async resolve (query) {
      const pg = await engine.fetch({ url: 'https://coinexchange.cz/', json: false }, 'coinbank')
      const m = pg.data.match(/var Instruments = (\[.+\]);\r\n/)
      if (!m) {
        return {}
      }
      let rate = null
      let buy = null
      const ins = JSON.parse(m[1])
      if (query.source === 'czk') {
        const target = ins.find(i => i.InstrumentSymbol === query.target.toUpperCase())
        if (target) {
          rate = target.Rate
          buy = true
        }
      }
      if (query.target === 'czk') {
        const source = ins.find(i => i.InstrumentSymbol === query.source.toUpperCase())
        if (source) {
          rate = source.Rate.AMO_sell_coinbanking
          buy = false
        }
      }
      if (query.dir === 'sell') {
        buy = !buy
      }
      if (!rate) {
        return {}
      }
      const price = String(Number(query.value) * Number(rate[buy ? 'AMO_buy_coinbanking' : 'AMO_sell_coinbanking']))
      return subs.map(s => {
        const obj = { seller: s, price }
        if (limits[s]) {
          if (price < limits[s].min) {
            obj.error = `minimální objednávka je ${limits[s].min} ${query.source.toUpperCase()}`
            obj.price = null
          }
          if (price > limits[s].max) {
            obj.error = `maximální objednávka je ${limits[s].max} ${query.source.toUpperCase()}`
            obj.price = null
          }
          if (price > limits[s].daily) {
            obj.error = `denní limit je ${limits[s].daily} ${query.source.toUpperCase()}`
            obj.price = null
          }
        }
        return obj
      })
    }
  }
}
