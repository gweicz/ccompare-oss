module.exports = function (engine) {
  const fee = 0.002
  const pairs = {
    'btc-czk': {},
    'btc-eur': {},
    'ltc-eur': {}
  }

  return {
    async resolve (query) {
      const pair = [query.target, query.source].join('-')
      if (!pairs[pair]) {
        return {}
      }
      const obr = await engine.fetch({ url: `https://api.coingi.com/current/order-book/${pair}/512/512/32`, json: true }, 'coingi')
      const data = obr.data
      let { rest, cost } = engine.calcOrderBook(query.value, query.dir === 'buy' ? data.asks : data.bids)

      if (rest > 0) {
        return { error: `nedostatek likvidity (dostupná: ${Math.round((Number(query.value) - rest) * 100) / 100} ${query.target.toUpperCase()})` }
      }
      if (query.dir === 'sell') {
        cost -= cost * fee
      } else {
        cost += cost * fee
      }
      return { price: String(cost) }
    }
  }
}
