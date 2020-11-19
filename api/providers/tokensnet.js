
module.exports = function (engine) {
  const pairs = {
   // 'btc-eur': 'btceurs',
   // 'eth-eur': 'etheurs',
   // 'dai-eur': 'daieurs',
   // 'usdc-eur': 'usdceurs',
   // 'ltc-eur': 'ltceurs',
  }
  const fee = 0.002

  return {
    async resolve (query) {
      const pair = pairs[query.pair]
      if (!pair) {
        return {}
      }
      const url = `https://api.tokens.net/public/order-book/${pair}/`
      const bres = await engine.fetch({ url, json: true }, 'tokensnet')
      if (!bres.data) {
        console.error(bres)
      }
      const data = bres.data
      const book = (query.dir === 'buy' ? data.asks : data.bids).map(i => ({ price: i[1], amount: i[0] }))
      let { rest, cost } = engine.calcOrderBook(query.value, book)
      if (rest > 0) {
        return {
          error: `nedostatek likvidity (dostupná: ${Math.round((Number(query.value) - rest) * 100) / 100} ${query.target.toUpperCase()})`
        }
      }
      console.log(rest, cost)
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
