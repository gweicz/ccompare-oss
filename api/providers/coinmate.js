module.exports = function (engine) {
  const symbols = {
    fiat: ['czk', 'eur']
  }

  const pairs = {
    czk: {
      eth: true,
      btc: true,
      ltc: true,
      dash: true,
      xrp: true,
      bch: true
    },
    eur: {
      eth: true,
      btc: true,
      ltc: true,
      dai: 'DAI',
      dash: true,
      bch: true,
      xrp: true
    }
  }

  const fees = {
    ETH_CZK: 0.0015,
    ETH_EUR: 0.0015,
    BTC_CZK: 0.0025,
    BTC_EUR: 0.0025,
    LTC_CZK: 0.0025,
    LTC_EUR: 0.0025
  }

  return {

    async resolve (query) {
      let pair = null
      if (symbols.fiat.indexOf(query.source) !== -1 && pairs[query.source][query.target]) {
        const tg = typeof (pairs[query.source][query.target]) === 'string'
          ? pairs[query.source][query.target]
          : query.target.toUpperCase()
        pair = `${tg}_${query.source.toUpperCase()}`
      }
      if (!pair) {
        return {}
      }
      const url = `https://coinmate.io/api/orderBook?currencyPair=${pair}&groupByPriceLimit=False`
      const bres = await engine.fetch({ url, json: true }, 'coinmate')
      if (!bres.data) {
        console.error(bres)
      }
      const data = bres.data.data
      let { rest, cost } = engine.calcOrderBook(query.value, query.dir === 'buy' ? data.asks : data.bids)
      if (rest > 0) {
        return {
          error: `nedostatek likvidity (dostupná: ${Math.round((Number(query.value) - rest) * 100) / 100} ${query.target.toUpperCase()})`
        }
      }
      // fee
      if (fees[pair]) {
        if (query.dir === 'sell') {
          cost -= cost * fees[pair]
        } else {
          cost += cost * fees[pair]
        }
      }
      return {
        price: String(cost)
      }
    }
  }
}
