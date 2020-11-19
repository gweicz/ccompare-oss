module.exports = function (engine) {
  const limits = {
    min: 500,
    max: 5000000
  }

  const symbols = [
    'BTC',
    'ETH',
    'LTC',
    'XRP',
    'BCH',
    'IOTA',
    'XLM',
    'ETC',
    'NEO',
    'DASH',
    'DOGE'
  ]

  return {
    async resolve (query) {
      if (query.source !== 'czk') {
        return {}
      }
      if (symbols.indexOf(query.target.toUpperCase()) === -1) {
        return {}
      }
      const rr = await engine.fetch({ url: 'https://www.ccshop.cz/prices.php', json: false }, 'ccshop')
      const rates = rr.data.byCode

      let symbol = null
      let buy = null

      if (query.source === 'czk' && symbols.indexOf(query.target.toUpperCase()) !== -1) {
        symbol = query.target.toUpperCase()
        buy = true
      }
      if (symbols.indexOf(query.source) !== -1 && query.target === 'czk') {
        symbol = query.source.toUpperCase()
        buy = false
      }
      if (!symbol) {
        return {}
      }
      if (query.dir === 'sell') {
        buy = !buy
      }
      if (!buy) {
        // we need implement sell
        return {}
      }
      const price = Number(rates[symbol][buy ? 'price_sell' : 'price']) * (Number(query.value))
      // price -= price * 0.014
      if (price < limits.min) {
        return { error: `minimální objednávka je ${limits.min} ${query.source.toUpperCase()}` }
      }
      if (price > limits.max) {
        return { error: `maximální objednávka je ${limits.max} ${query.source.toUpperCase()}` }
      }
      return { price: String(price) }
    }
  }
}
