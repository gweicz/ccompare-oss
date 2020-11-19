module.exports = function (engine) {
  const fee = 0.0079
  const fiat = ['eur', 'czk']

  return {
    async resolve (query) {
      if (query.target !== 'btc' || fiat.indexOf(query.source) === -1) {
        return {}
      }
      const url = `https://market.bitstock.com/homeapi?market=${query.target.toUpperCase()}&currency=${query.source.toUpperCase()}&lang=en`
      const rr = await engine.fetch({ url, json: true }, 'bitstock-market')
      const book = rr.data.offers
      let { rest, cost } = engine.calcOrderBook(query.value, query.dir === 'buy' ? book.sell : book.buy, true)
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
