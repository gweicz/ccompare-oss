
module.exports = function (engine) {

  const pairs = {
    'btc-eur': {},
    'btc-chf': {},
    'eth-eur': {},
    'eth-chf': {},
  }

  return {
    async resolve (query) {
      if (!pairs[query.pair]) {
        return {}
      }
      const input = {
        input: {
          currency: (query.dir === 'buy' ? query.source : query.target).toUpperCase(),
          amount: query.dir === 'sell' ? String(query.value) : undefined
        },
        output: {
          currency: (query.dir === 'buy' ? query.target : query.source).toUpperCase(),
          amount: query.dir === 'buy' ? String(query.value) : undefined
        }
      }
      const req = await engine.fetch({
        url: 'https://exchange.api.bity.com/v2/orders/estimate',
        method: 'post',
        json: true,
        data: input
      })
      const data = req.data
      if (!data || !data.output) {
        return { error: 'Chyba zdroje' }
      }
      return { price: String((query.dir === 'buy' ? data.input.amount : data.output.amount)) }
    }
  }
}
