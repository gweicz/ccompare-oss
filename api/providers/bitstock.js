
module.exports = function (engine) {
  const limits = {
    cash: {
      min: 1000,
      max: 25000
    },
    btm: {
      min: 1000,
      max: 25000
    },
    wire: {
      min: 1000,
      max: 25000
    },
    svcbbank: {
      max: 1750000
    }
  }

  return {
    async resolve (query) {
      let pair = null
      let dir = null
      if (query.source === 'czk' && query.target === 'btc') {
        pair = 'BTCCZK'
        dir = 'B'
      }
      if (query.source === 'btc' && query.target === 'czk') {
        pair = 'BTCCZK'
        dir = 'S'
      }
      if (!pair) {
        return {}
      }
      if (query.dir === 'sell') {
        dir = dir === 'S' ? 'B' : 'S'
      }
      const out = []
      const rr = await engine.fetch({ url: `https://cz.bitstock.com/api01/exchange-pairs/${pair}` }, 'bitstock')
      const rates = rr.data.data.attributes
      for (const r of Object.keys(rates)) {
        const channel = r.replace(/^channel/, '').toLowerCase()
        if (channel === 'cash') {
          continue
        }
        const price = Number(rates[r][dir]) * Number(query.value)
        const obj = { seller: `bitstock_${channel}`, price: String(price) }
        if (limits[channel]) {
          if (price < limits[channel].min) {
            obj.error = `minimální objednávka je ${limits[channel].min} ${query.source.toUpperCase()}`
            obj.price = null
          }
          if (price > limits[channel].max) {
            obj.error = `maximální objednávka je ${limits[channel].max} ${query.source.toUpperCase()}`
            obj.price = null
          }
        }
        out.push(obj)
      }
      return out
    }
  }
}
