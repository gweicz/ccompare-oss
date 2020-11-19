module.exports = function (engine) {
  const fee = 0.001
  const pairs = {
    'btc-pln': {},
    'eth-pln': {},
    'ltc-pln': {},
    'dash-pln': {},
    'xrp-pln': {},
    'zec-pln': {},
    'bat-pln': {},
    'rep-pln': {},
    'xlm-pln': {},
    'btc-eur': {},
    'eth-eur': {},
    'ltc-eur': {},
    'dash-eur': {},
    'xrp-eur': {},
    'zec-eur': {},
    'bat-eur': {},
    'rep-eur': {},
    'xlm-eur': {}
  }

  return {
    async resolve (query) {
      if (!pairs[query.pair]) {
        return {}
      }
      const url = `https://api.bitbay.net/rest/trading/orderbook/${query.pair.toUpperCase()}`
      const obr = await engine.fetch({ url, json: true }, 'bitbay')
      const data = obr.data
      const book = (query.dir === 'buy' ? data.sell : data.buy).map(i => ({ price: i.ra, amount: i.ca }))
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
