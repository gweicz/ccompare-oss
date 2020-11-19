module.exports = function (engine) {

  const pairs = {
    'USDTEUR': 49,
    'LTCEUR': 194,
    'BTCEUR': 50,
    'ETHEUR': 51,
    'USDCEUR': 293,
  }
  const fee = 0.0005

  return {
    async resolve (query) {
      const pair = [ query.target.toUpperCase(), query.source.toUpperCase() ].join('')
      const pid = pairs[pair]
      if (!pid) {
        return {}
      }
      const r = await engine.fetch({
        url: `https://api.eterbase.exchange/api/markets/${pid}/order-book`,
        json: true
      }, 'eterbase')
      if (r.error) {
        return { error: 'chyba zdroje' }
      }
      let book = (query.dir === 'buy' ? r.data.asks : r.data.bids).sort((x, y) => x[0] > y[0] ? 1 : -1)
      if (query.dir === 'sell') {
        book = book.reverse()
      }
      let { rest, cost } = engine.calcOrderBook(query.value, book.map(i => ({ price: i[0], amount: i[1] })))
      if (rest > 0) {
        return {
          error: `nedostatek likvidity (dostupná: ${Math.round((Number(query.value) - rest) * 100) / 100} ${query.target.toUpperCase()})`
        }
      }
      if (query.dir === 'sell') { cost -= cost * fee } else { cost += cost * fee }
      return {
        price: String(cost)
      }
    }
  }
}
