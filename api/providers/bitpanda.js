
module.exports = function (engine) {

  const pairs = {
    BTC_EUR: {},
    ETH_EUR: {},
    XRP_EUR: {},
    BTC_CHF: {},
    ETH_CHF: {},
    XRP_CHF: {},
  }

  const fee = 0.0015

  return {

    async resolve (query) {
      const pair = [ query.target, query.source ].join('_').toUpperCase()
      if (!pairs[pair]) {
        return {}
      }
      const url = `https://api.exchange.bitpanda.com/public/v1/order-book/${pair}`
      const bres = await engine.fetch({ url, json: true }, 'bitpanda')
      if (!bres.data) {
        console.error(bres)
      }
      const data = bres.data
      let { rest, cost } = engine.calcOrderBook(query.value, query.dir === 'buy' ? data.asks : data.bids)
      if (rest > 0) {
        return {
          error: `nedostatek likvidity (dostupná: ${Math.round((Number(query.value) - rest) * 100) / 100} ${query.target.toUpperCase()})`
        }
      }
      // fee
      if (query.dir === 'sell') {
        cost -= cost * fee
      } else {
        cost += cost * fee
      }
      return {
        price: String(cost)
      }
    }
  }
}
