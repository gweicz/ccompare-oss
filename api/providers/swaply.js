module.exports = function (engine) {
  const pairs = [
    'btc-pln'
  ]

  return {
    async resolve (query) {
      return {}
      if (pairs.indexOf(query.pair) === -1) {
        return {}
      }
      const q = {
        url: 'https://api.swap.ly/rates/askcalculate',
        method: 'post',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        data: engine.qs.stringify({
          amount: query.value,
          currency: query.source.toUpperCase(),
          cryptoCurrency: query.target.toUpperCase()
        })
      }
      console.log(q)
      const rr = await engine.fetch(q, 'swaply')
      console.log(rr.data)
      return { error: 'xx' }
    }
  }
}
