module.exports = function (engine) {
  const assets = [
    'btc',
    'ltc',
    'eth'
  ]

  const types = {
    wire: {
      no: 6,
      dirs: ['buy', 'sell']
    },
    dotpay: {
      no: 17,
      dirs: ['buy']
    }
  }

  return {
    async resolve (query) {
      if (query.source !== 'pln' || assets.indexOf(query.target) === -1) {
        return null
      }
      const out = []
      for (const tk of Object.keys(types)) {
        const t = types[tk]
        if (t.dirs.indexOf(query.dir) === -1) {
          continue
        }
        const q = {
          url: `https://backend.bitcantor.com/rate/${query.target}/${query.source}/${query.dir === 'sell' ? 'ask' : 'bid'}/amount`,
          method: 'post',
          json: true,
          data: engine.qs.stringify({
            price: query.value,
            operator: t.no
          })
        }
        const rr = await engine.fetch(q, 'bitcantor')
        const data = rr.data
        out.push({
          seller: `bitcantor_${tk}`,
          price: String(data.quantity)
        })
      }
      return out
    }
  }
}
