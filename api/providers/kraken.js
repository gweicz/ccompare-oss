module.exports = function (engine) {

  const pairs = {
    'eth-eur': 'XETHZEUR',
    'dai-eur': 'DAIEUR',
    'btc-eur': 'XXBTZEUR',
    'usdc-eur': 'USDCEUR',
    'usdt-eur': 'USDTEUR',
    'ltc-eur': 'XLTCZEUR',
    'zec-eur': 'XZECZEUR',
    'dash-eur': 'DASHEUR',
    'bat-eur': 'BATEUR',
    'eth-chf': 'ETHCHF',
    'btc-chf': 'XBTCHF',
    'ada-eur': 'ADAEUR',
  }
  const fee = 0.0016

  return {

    async resolve (query) {
      const pair = pairs[query.pair]
      if (!pair) {
        return {}
      }
      const url = `https://api.kraken.com/0/public/Depth?pair=${pair}`
      const bres = await engine.fetch({ url, json: true }, 'kraken')
      if (!bres.data) {
        console.error(bres)
      }
      if (bres.data.error && bres.data.error.length > 0) {
        console.error(bres.data.error)
        return { error: 'API error' }
      } 
      const data = bres.data.result[pair]
      if (!data) {
        return { error: 'API error' }
      }
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
