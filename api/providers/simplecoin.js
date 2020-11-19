module.exports = function (engine) {
  const symbols = {
    eur: '2',
    czk: '4',
    btc: '6',
    ltc: '9',
    bch: '10',
    eth: '13',
    xrp: '14',
    zec: '15'
  }
  const apiUrl = 'https://server.simplecoin.eu/v1/exchange/price'

  return {
    name: 'SimpleCoin',

    async resolve (query) {
      const params = {
        from: symbols[query.source],
        to: symbols[query.target],
        amount: query.value,
        direction: query.dir === 'buy' ? 1 : 0
      }
      if (!params.from || !params.to) {
        return {}
      }
      if (query.dir === 'sell') {
        const pcopy = JSON.parse(JSON.stringify(params))
        params.to = pcopy.from
        params.from = pcopy.to
      }
      const url = apiUrl + '?' + engine.qs.stringify(params)
      const out = await engine.fetch({ url }, 'simplecoin')
      if (!out.data || !out.data.status) {
        return {
          error: true
        }
      }
      if (out.data.status === 'fail') {
        return {}
      }
      const resp = out.data.response
      return {
        price: String(resp.price)
      }
    }
  }
}
