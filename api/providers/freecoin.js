module.exports = function (engine) {
  const symbols = [
    'ETH',
    'BTC',
    'LTC',
    'XRP',
    'DASH',
    'BCH'
  ]

  const limits = {
    min: 2500,
    max: 250000
  }

  return {
    name: 'FreeCoin',

    async resolve (query) {
      let pair = null
      let buy = null
      if (query.source === 'czk' && symbols.indexOf(query.target.toUpperCase()) !== -1) {
        pair = `${query.target.toUpperCase()}_CZK`
        buy = true
      }
      if (query.target === 'czk' && symbols.indexOf(query.source.toUpperCase()) !== -1) {
        pair = `${query.source.toUpperCase()}_CZK`
        buy = false
      }
      if (query.dir === 'sell') {
        buy = !buy
      }
      if (!pair) {
        return {}
      }
      const rr = await engine.fetch({ url: `https://www.freecoin.cz/get_exrate.php?par=${pair}` }, 'freecoin')
      const price = Number(query.value) * Number(rr.data[buy ? 'prodej' : 'nakup'])
      if (price < limits.min) {
        return { error: `minimální objednávka je ${limits.min} ${query.source.toUpperCase()}` }
      }
      if (price > limits.max) {
        return { error: `minimální objednávka je ${limits.max} ${query.source.toUpperCase()}` }
      }
      return {
        price: String(price)
      }
    }
  }
}
