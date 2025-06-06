const get = key => JSON.parse(localStorage.getItem(key))

const urls = get("urls")
const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)

const display = get("display")
const counters = Object.values(display).flat()

const portfolio = get("portfolio")

const officeHours = () => {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  if (day < 1 || day > 5) { return false }
  if (hour < 8 || hour > 17) { return false }
  if (hour == 8 && minute < 30) { return false }
  if (hour == 17 && minute > 30) { return false }
  return true
}

const getQuotes = async () => {
  const resp = await fetch(useProxy(urls.quotes))
  const data = await resp.json()
  const quotes = data.data.prices.filter(quote => counters.includes(quote.nc))
    .reduce((acc, quote) => {
      acc[quote.nc] = quote
      return acc
    }, {})
  return [quotes, data.meta.processedTime]
}

const updateState = async () => {
  const [stocks, time] = await getQuotes()
  for (const symbol in stocks) {
    stocks[symbol].avg_price =
      symbol in portfolio ? portfolio[symbol].avg_price : null
    stocks[symbol].mkt_value =
      symbol in portfolio ? stocks[symbol].lt * portfolio[symbol].holdings : null
    stocks[symbol].gain_loss =
      symbol in portfolio ? (stocks[symbol].lt - portfolio[symbol].avg_price) * portfolio[symbol].holdings : null
  }
  return [stocks, time]
}

const data = () => {
  return {
    stocks: {},
    processedTime: 0,
    intervalTime: 0,
    intervalId: 0,
    async updateSelf(initial = false) {
      this.intervalTime = new Date().valueOf()
      if (initial || (officeHours() && this.intervalTime - this.processedTime > 80000)) {
        [stocks, time] = await updateState()
        this.stocks = stocks
        this.processedTime = time
        this.intervalTime = new Date().valueOf() // so that no -1 and 0 secs ago
      }
      // to simulate change in data on every interval update
      // for (symbol of ["N2IU", "BTOU", "S59"]) {
      //   this.stocks[symbol].mkt_value++
      //   this.stocks[symbol].gain_loss++
      //   this.stocks = { ...this.stocks }
      // }
    },
    init() {
      this.updateSelf(true)
      this.intervalId = setInterval(async () => await this.updateSelf(), 1000);
    }
  }
}

const columns = [
  {
    label: "Company Name", alias: "n", format: str => {
      const words = str.split(" ")
      if (words.length > 2) {
        str = words.slice(0, 3).join(" ")
        str = str.length > 16 ? words.slice(0, 2).join(" ") : str
      }
      return `<div class="text-violet-400 text-left">${str}</div>`
    }
  },
  { label: "Last", alias: "lt", format: num => num },
  { label: "Change", alias: "c", format: num => `<div class="${color(num)}">${num}</div>` },
  { label: "%", alias: "p", format: num => `<div class="${color(num)}">${num.toFixed(1)}</div>` },
  { label: "High", alias: "h", format: num => num },
  { label: "Low", alias: "l", format: num => num },
  { label: "Avg Px", alias: "avg_price", format: num => num ? num.toFixed(2) : "-" },
  { label: "Mkt Val", alias: "mkt_value", format: num => num ? Math.floor(num).toLocaleString() : "-" },
  { label: "Gain/Loss", alias: "gain_loss", format: num => num !== null ? `<div class="${color(num)}">${Math.floor(num).toLocaleString()}</div>` : "-" },
]

// css classes
const header = "pb-2 px-2 text-gray-400 whitespace-nowrap"
const border = "border border-gray-400 "
const padding = "py-1 px-2 "
const text = "text-xl/6 text-gray-400 text-right "
const base = border + padding + text
const green = "text-emerald-500"
const red = "text-rose-700"
const color = num => num > 0 ? green : num < 0 ? red : ""
const button = "bg-violet-900 hover:bg-violet-400 px-4 rounded-full"
