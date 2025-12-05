export const get = key => JSON.parse(localStorage.getItem(key))
export const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))
export const deleet = key => key === "ALL" ? localStorage.clear() : localStorage.removeItem(key)

/*
wanna make these asyn and fetch if outdated
something like ..

let financials  = get financials
if outdated
    financials  = await fetch financials
    save financials
return financials
*/


export const getTrades = () => get("trades")
export const getFinancials = async () => get("financials")
export const getRates = async () => get("rates")

export const getNames = async () => {
  let names = get("names")
  if (!names) {
    const urls = get("urls")
    const counters = Object.values(get("display")).flat()
    const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)
    console.log('getting quotes... (for names)')
    const resp = await fetch(useProxy(urls.quotes))
    const data = await resp.json()
    names = Object.fromEntries(data.data.prices
      .filter(quote => counters.includes(quote.nc))
      .map(quote => [quote.nc, quote.n]))
    localStorage.setItem("names", JSON.stringify(names))
    console.log("names stored")
  }
  return names
}



