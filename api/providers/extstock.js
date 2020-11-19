module.exports = function (engine) {

  const pairs = {
    BTC_EUR: {},
    ETH_EUR: {},
    LTC_EUR: {},
    BCH_EUR: {},
    BTC_GBP: {},
    ETH_GBP: {},
    LTC_GBP: {},
    BCH_GBP: {},
  }

  const fee = 0.001

  return {

    async resolve (query) {
      const pair = [ query.target, query.source ].join('_').toUpperCase()
      if (!pairs[pair]) {
        return {}
      }
      const url = `https://extstock.com/api/v2/orderbook/${pair}`
      const bres = await engine.fetch({ url, json: true }, 'extstock')
      if (!bres.data) {
        console.error(bres)
      }
      const data = bres.data.data
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
