module.exports = function (engine) {
  const fees = {
    wire: 0.02,
    card: 0.03
  }

  return {
    async resolve (query) {
      if (query.source !== 'pln' || ['btc', 'eth'].indexOf(query.target) === -1) {
        return {}
      }
      const q = {
        url: 'https://hash-back.net/redirectRequest.php',
        method: 'post',
        json: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        data: engine.qs.stringify({
          requestPath: '/market/getPrice.php',
          token: 0
        })
      }
      const rr = await engine.fetch(q, 'hashback')
      const rate = (query.target === 'eth' ? rr.data.ETH : rr.data)[query.dir === 'sell' ? 'sell' : 'buy']
      const price = Number(rate) * Number(query.value)

      const out = []
      for (const fk of Object.keys(fees)) {
        const f = fees[fk]
        out.push({
          seller: `hashback_${fk}`,
          price: String(price + (query.dir === 'sell' ? -(price * f) : (price * f)))
        })
      }
      return out
    }
  }
}
