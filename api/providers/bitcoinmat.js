module.exports = function (engine) {
  const crypto = [
    'eth',
    'ltc',
    'btc',
    'bch',
    'xrp',
    'dash',
    'dai'
  ]
  const fiat = [
    'eur',
    'czk'
  ]

  return {

    async resolve (query) {
      if (crypto.indexOf(query.target) === -1 || fiat.indexOf(query.source) === -1) {
        return {}
      }
      const pair = [query.target, query.source].join('').toUpperCase()
      const rr = await engine.fetch({ url: 'https://www.bitcoinmat.sk/', json: false }, 'bitcoinmat')
      if (rr.error) {
        return { error: rr.error }
      }
      const m = rr.data.match(/var tickers = (\{[^;]+\})/)
      if (!m) {
        return { error: 'not match' }
      }
      const data = m[1].replace(/\s{2,}/g, ' ').replace(/, \}/g, ' }')
      const rates = JSON.parse(data)
      const rate = rates[query.dir === 'sell' ? 'SELL' : 'BUY'][pair]
      if (!rate) {
        return {}
      }
      return { price: String(Number(rate) * Number(query.value)) }
    }
  }
}
