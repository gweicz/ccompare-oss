
module.exports = function (engine) {
  return {

    async resolve (query) {
      if (query.source !== 'czk') {
        return {}
      }
      const pg = await engine.fetch({ url: 'https://sonatacoin.cz/', json: false }, 'sonatacoin')
      if (!pg.data) {
        return { error: 'chybné data' }
      }
      const m = pg.data.match(/var orderFormSettings = (\{.+\});\n/)
      if (!m) {
        return { error: 'chybné data' }
      }
      const res = JSON.parse(m[1])
      const symbol = res.currencies.find(s => s.code === query.target.toUpperCase())
      if (!symbol) {
        return {}
      }
      const rate = query.dir === 'sell' ? symbol.finalSaleRate : symbol.finalPurchaseRate
      const price = rate * query.value
      return { price: String(price) }
    }
  }
}
