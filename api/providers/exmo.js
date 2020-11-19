module.exports = function (engine) {
  const fee = 0.002
  const pairs = {
    BTC_UAH: {},
    ETH_UAH: {},
    LTC_UAH: {},
    XRP_UAH: {},
    DASH_UAH: {},
    USDT_UAH: {},
    BCH_UAH: {},
    BTC_EUR: {},
    BCH_EUR: {},
    ETH_EUR: {},
    LTC_EUR: {},
    USDT_EUR: {},
    XMR_EUR: {},
    XRP_EUR: {},
    ZEC_EUR: {},
    BTC_PLN: {},
    ETH_PLN: {}
  }

  return {
    async resolve (query) {
      const pair = [query.target, query.source].join('_').toUpperCase()
      if (!pairs[pair]) {
        return {}
      }
      const obr = await engine.fetch({ url: `https://api.exmo.com/v1/order_book/?pair=${pair}` }, 'exmo')
      const data = obr.data[pair]
      if (!data) {
        return { error: true }
      }
      let { rest, cost } = engine.calcOrderBook(query.value, query.dir === 'buy' ? data.ask : data.bid)

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
