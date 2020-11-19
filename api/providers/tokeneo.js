module.exports = function (engine) {
  const assets = [
    'btc',
    'eth'
  ]

  return {
    async resolve (query) {
      if (query.source !== 'pln' || assets.indexOf(query.target) === -1) {
        return {}
      }
      if (query.dir === 'sell') {
        // sell disabled
        return {}
      }
      const q = {
        url: 'https://cash.tokeneo.com/market/rate',
        method: 'post',
        json: true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: engine.qs.stringify({
          baseCurrency: query.target.toUpperCase(),
          baseAmount: Number(query.value),
          quotedCurrency: query.source.toUpperCase(),
          transactionType: query.dir === 'sell' ? 'sell' : 'buy'
        })
      }
      const rr = await engine.fetch(q, 'tokeneo')
      const data = rr.data
      if (Number(data.baseAmount) !== Number(query.value)) {
        return { error: `Maximální objednávka je ${data.baseAmount} ${query.target.toUpperCase()}` }
      }
      return { price: String(data.quotedAmount) }
    }
  }
}
