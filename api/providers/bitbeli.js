module.exports = function (engine) {
  const globalLimits = {
    day: 100000
  }

  /*const fees = {
    btc: 0.0004,
    ltc: 0.006,
    bch: 0.003,
    eth: 0.003,
    xrp: 3
  }*/

  let token = null

  return {
    async resolve (query) {
      if (query.source !== 'czk') {
        return {}
      }
      if (token && (Number(new Date()) - Number(token.time)) > 1000 * 60 * 60) {
        token = null
      }
      if (!token) {
        const login = await engine.fetch({
          url: 'https://www.bitbeli.cz/api/client/auth/login',
          json: true,
          method: 'post',
          headers: {
            'Content-Type': 'application/json'
          }
        }, 'bitbeli')
        token = {
          token: login.data.token,
          time: new Date()
        }
      }
      if (!token) {
        return {}
      }
      const pp = await engine.fetch({
        url: `https://www.bitbeli.cz/api/client/exchange/currency-crypto-rate-czk/${query.dir}`,
        json: true,
        headers: {
          authorization: `Bearer ${token.token}`
        }
      }, 'bitbeli')
      if (!pp.data) {
        return {}
      }
      const rate = pp.data[query.target.toUpperCase()]
      if (!rate) {
        return {}
      }
      const price = Number(query.value) * Number(rate)
      if (price <= 0) {
        return { error: 'příliš nízká částka' }
      }
      if (price > globalLimits.day) {
        return { error: `maximalní objednávka je ${globalLimits.day} ${query.source.toUpperCase()}` }
      }

      return { price: String(price) }
    }
  }
}
