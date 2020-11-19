module.exports = function (engine) {
  const fee = 0.0025
  const pairs = {
    ethuah: {},
    btcuah: {},
    ltcuah: {},
    xrpuah: {},
    bchuah: {},
    xlmuah: {},
    dashuah: {},
    zecuah: {}
  }

  return {
    async resolve (query) {
      const pair = [query.target, query.source].join('')
      if (!pairs[pair]) {
        return {}
      }
      if (query.source !== 'uah') {
        return {}
      }
      const obr = await engine.fetch({ url: `https://kuna.io/api/v2/depth?market=${pair}`, json: true }, 'kuna')
      if (!obr || !obr.data) {
        return { error: true }
      }
      const data = obr.data
      const book = query.dir === 'buy' ? data.asks.reverse() : data.bids
      const bookFormatted = book.map(i => ({ price: i[0], amount: i[1] }))
      // console.log(bookFormatted)
      let { rest, cost } = engine.calcOrderBook(query.value, bookFormatted)

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
