module.exports = function (engine) {
  const limits = {
    min: 20,
    max: 2000
  }

  const fees = {
    wire: 0.01,
    card: 0.045
  }

  const gql = {
    operationName: 'cryptoCurrencies',
    variables: { apiKey: 'pk_live_R5Lf25uBfNZyKwccAZpzcxuL3ZdJ3Hc' },
    query: `
      query cryptoCurrencies($apiKey: String!) {
        cryptoCurrencies(apiKey: $apiKey) { id name code icon precision supportsAddressTag supportsLiveMode supportsTestMode isSuspended addressRegex testnetAddressRegex addressTagRegex isSupportedInUS audRate cadRate eurRate gbpRate usdRate zarRate __typename 
        }
      }`
  }

  return {
    async resolve (query) {
      if (query.dir === 'sell') {
        return {}
      }
      const rr = await engine.fetch({
        url: 'https://api.moonpay.io/graphql',
        method: 'post',
        json: true,
        data: JSON.stringify(gql),
        headers: {
          'Content-type': 'application/json'
        }
      }, 'moonpay').catch(err => {
        console.error(err, JSON.stringify(err.response.data.errors))
      })
      const symbols = rr.data.data.cryptoCurrencies
      const symbol = symbols.find(s => s.code === query.target)
      if (!symbol) {
        return {}
      }

      const rate = symbol[`${query.source}Rate`]
      if (!rate) {
        return {}
      }
      let price = rate * query.value
      price += fees.card * price

      return {
        price: String(price)
      }
    }
  }
}
