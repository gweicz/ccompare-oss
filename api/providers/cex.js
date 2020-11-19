module.exports = function (engine) {
  const fee = 0.0025

  const symbols = {
    btc: {},
    eth: {},
    bch: {},
    dash: {},
    xrp: {},
    xlm: {},
    ltc: {},
    ada: {},
    bat: {}
  }

  return {
    async resolve (query) {
      if (query.source !== 'eur') {
        return {}
      }
      if (!symbols[query.target]) {
        return {}
      }
      const rr = await engine.fetch({
        url: `https://cex.io/api/order_book/${[query.target, query.source].join('/').toUpperCase()}`,
        json: true
      }, 'cex')
      if (!rr || !rr.data || (rr.data.error && rr.data.error === 'Invalid Symbols Pair')) {
        return { error: 'chyba' }
      }
      const book = rr.data
      const cbook = (query.dir === 'buy' ? book.asks : book.bids)
      if (!cbook) {
        console.error(rr.data)
        return {}
      }
      const bookFormatted = cbook.map(i => ({ price: i[0], amount: i[1] }))
      let { rest, cost } = engine.calcOrderBook(query.value, bookFormatted, true)
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
