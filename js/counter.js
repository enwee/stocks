const symbol = location.search.slice(1)
const get = key => JSON.parse(localStorage.getItem(key))
const trades = get("trades")[symbol]
const cur = trades.at(-1)

const xData = () => ({
  name: "",
  usd: false,
  async init() {
    this.name = (await getNames())[symbol]
    this.usd = this.name.endsWith("USD")
  }
})

const getNames = async () => {
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

// css classes
const header = "pb-2 px-2 text-gray-400 whitespace-nowrap "
const border = "border border-gray-400 "
const padding = "py-1 px-2 "
const text = "text-lg text-gray-400 text-right "
const base = border + padding + text
const altBG = bool => bool ? "bg-slate-900" : "bg-stone-900"

// html page table columns
const columns = [
  {
    label: "Date", alias: "tradeDate", format: str => { // d-m-y -> "d m 20y"
      const dMy = str.split("-")
      dMy[2] = "20" + dMy[2]
      return dMy.join(" ")
    }
  },
  { label: "Shares", alias: "shares", format: num => numComma(num) },
  { label: "Price", alias: "price", format: num => num.toFixed(3), addLabel: true },
  { label: "Cost", alias: "tradeCost", format: num => numComma(num), addLabel: true },
  { label: "", alias: "", format: str => "⟶" },
  { label: "Holdings", alias: "holdings", format: num => numComma(num) },
  { label: "Avg Px", alias: "avgPrice", format: num => num.toFixed(3), addLabel: true },
  { label: "Total Cost", alias: "totalCost", format: num => numComma(num), addLabel: true },
]

const numComma = num => Math.floor(num).toLocaleString()

const currency = (str = "USD") => `<span class='relative'><div class='text-[10px] absolute -top-1 -right-3.25'>${str}</div></span>`
