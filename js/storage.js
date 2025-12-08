export const get = key => JSON.parse(localStorage.getItem(key))
export const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))
export const deleet = key => key === "ALL" ? localStorage.clear() : localStorage.removeItem(key)

// special case - otherwise when useProxy it will be 'getting' urls twice per call
const urls = get("urls")
const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)

// future might store multi portfolio display/ case for get reits/stocks?
const getDisplay = () => get("display")
// getStocks - add undisplayed - but note most sold are already unlisted

export const getTrades = symbol => {
  const trades = get("trades")
  return symbol ? trades[symbol] : trades
}

export const getQuotes = async () => {
  let quotes = get("quotes")
  if (!quotes) {
    const counters = Object.values(getDisplay()).flat()
    console.log('getting quotes...')
    const resp = await fetch(useProxy(urls.quotes))
    const data = await resp.json()
    // dont forget data (not data.data) has a time retreived, useful to store
    quotes = Object.fromEntries(data.data.prices
      .filter(quote => counters.includes(quote.nc)) // e.g. nc'name code'is trading code
      .map(({ nc: code, n: name, lt: last, c: chng, p: pChng, h: high, l: low, vl: vol, pv: prev, type, trading_time }) =>
        [code, { code, name, last, chng, pChng, high, low, vol, prev, type, trading_time }]))
    localStorage.setItem("quotes", JSON.stringify(quotes))
    console.log("quotes stored")
  }
  return quotes
}

export const getFinancials = async () => get("financials")
export const getRates = async () => get("rates")

/*
wanna make these asyn and fetch if outdated
something like ..

let financials  = get financials
if outdated
    financials  = await fetch financials
    save financials
return financials
*/
