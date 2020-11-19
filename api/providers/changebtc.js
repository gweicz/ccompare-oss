
module.exports = function (engine) {
  const markets = {
    btc: 43196436
  }

  return {

    async resolve (query) {
      // temporarly disable
      return {}

      const rr = await engine.fetch({
        url: 'https://www.changebtc.cz/common/smenarnabtc-exchange/smenarnaExChangeBTC.php',
        method: 'post',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          Origin: 'https://www.changebtc.cz',
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Dest': 'empty',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.116 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          Referer: 'https://www.changebtc.cz/',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
          Cookie: 'PHPSESSID=jlm83dtauq5gsbsgschal5i8t4; sid_43196436=c15daced5493eabafa8c8ca2dee4b601'
        },
        data: `cat_id=${markets[query.target]}&action=calculatePrice&cat_key=btc_prodej&amount=${query.value}&currency=${query.source.toUpperCase()}&direction=2`
      }, 'changebtc')
      if (!rr.data || !rr.data.price) {
        return {}
      }
      const price = rr.data.price.replace(/\s+/, '')
      return { price }
    }
  }
}
