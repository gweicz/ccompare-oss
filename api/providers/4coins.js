module.exports = function (engine) {
  return {
    async resolve (query) {
      return {}
      if (query.source !== 'pln' || query.target !== 'btc') {
        return {}
      }

      const rr = await engine.fetch({ url: 'https://www.4coins.pl', json: false }, '4coins')
      const m = rr.data.match(/<span class="pln2btc-result" data-comm="([0-9\.]+)" data-comm-max="([0-9\.]+)" data-comm-min="([0-9\.]+)" data-rate="([0-9\.]+)"><span>[0-9\.]+<\/span>/)
      if (!m) {
        return {}
      }
      const [fee, feeMax, feeMin, rate] = m.slice(1)
      let f = (Number(query.value)) * Number(fee)
      f = Math.min(f, Number(feeMin))
      f = Math.max(f, Number(feeMax))

      const val = Number(query.value)
      const price = (val + (val * 0.016)) * Number(rate)
      console.log(`value: ${query.value} BTC = ${price} PLN`)

      return {}
    }
  }
}
