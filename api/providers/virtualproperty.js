
module.exports = function (engine) {
  const assets = {
    crypto: ['btc', 'eth', 'bch', 'ltc'],
    fiat: ['eur', 'czk']
  }

  return {

    async resolve (query) {
      if (assets.crypto.indexOf(query.target) === -1 || assets.fiat.indexOf(query.source) === -1) {
        return {}
      }
      const url = `https://www.virtualproperty.cz/app/${query.dir === 'sell' ? 'prodej' : 'nakup'}.php?currency=${query.target.toUpperCase()}&zaco=${query.source.toUpperCase()}`
      const headers = {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36'
      }
      const rr = await engine.fetch({ url, json: false, headers }, 'virtualproperty')
      const re = query.dir === 'sell'
        ? /\(this.value \* ([\d.]+)\*([\d.]+)\).toFixed\(2\)/
        : /\(this.value \/ \(([\d.]+)\*([\d.]+)\)\).toFixed\(6\)/
      const m = rr.data.match(re)
      if (!m) {
        return {}
      }
      const rate = Number(m[1]) * Number(m[2])
      const price = query.value * rate
      return { price: String(price) }
    }
  }
}
