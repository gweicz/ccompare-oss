module.exports = function (engine) {

  const pairs = {
    'BTC-EUR': {},
    'ETH-EUR': {},
    'BAT-EUR': {},
    'LTC-EUR': {},
    'XLM-EUR': {},

  }
  const fee = 0.0025


  return {
    async resolve (query) {
      const pair = [ query.target.toUpperCase(), query.source.toUpperCase() ].join('-')
      if (!pairs[pair]) {
        return {}
      }
      const r = await engine.fetch({ url: `https://api.bitvavo.com/v2/${pair}/book`, json: true }, 'bitvavo')
      const book = query.dir === 'buy' ? r.data.asks : r.data.bids
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
