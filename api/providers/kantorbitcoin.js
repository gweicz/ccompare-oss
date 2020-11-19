module.exports = function (engine) {
  const symbols = {
    btc: 'xbt',
    ltc: 'ltc',
    xmr: 'xmr',
    dash: 'dash'
  }

  return {
    async resolve (query) {
      if (query.source !== 'pln' || !symbols[query.target]) {
        return {}
      }
      const pair = [symbols[query.target], query.source].join('')
      const rr = await engine.fetch({ url: `https://kantorbitcoin.pl/pricetools/index.php/api/kantorprices/${pair}` }, 'kantorbitcoin')
      const data = rr.data
      const rate = query.dir === 'sell' ? data.buyprice : data.sellprice
      return {
        price: String(Number(rate) * Number(query.value))
      }
    }
  }
}
