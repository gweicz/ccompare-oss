module.exports = function (engine) {
  const fee = 0.003
  const pairs = {
    'btc-pln': {},
    'ltc-pln': {}
  }

  return {
    async resolve (query) {
      if (!pairs[query.pair]) {
        return {}
      }
      const rr = await engine.fetch({ url: 'https://bitmaszyna.pl/datainit.json' }, 'bitmaszyna')
      const bsrc = rr.data[`offers${[query.target, query.source].join('').toUpperCase()}`]
      const book = (query.dir === 'sell' ? bsrc.bids : bsrc.asks).map(i => ({ price: i[2], amount: i[1] }))
      let { rest, cost } = engine.calcOrderBook(query.value, book)
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
