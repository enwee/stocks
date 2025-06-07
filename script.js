const get = key => JSON.parse(localStorage.getItem(key))

const urls = get("urls")
const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)

const display = get("display")
const counters = Object.values(display).flat()

const portfolio = get("portfolio")

const officeHours = () => {
  const now = new Date(), day = now.getDay(), hour = now.getHours(), minute = now.getMinutes()
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

const getRates = async () => {
  let rates = get("rates")
  if (!rates || new Date(rates.time).toDateString() != new Date().toDateString()) {
    rates = {}
    const resp = await fetch(urls.rates)
    const data = await resp.json()
    for (const rate of ["SGD", "JPY", "CNY", "HKD"]) {
      rates[rate] = data.conversion_rates[rate]
    }
    rates.time = data.time_last_update_unix * 1000
    localStorage.setItem("rates", JSON.stringify(rates))
  }
  return rates
}

const updateState = async () => {
  const rates = await getRates()
  const [stocks, time] = await getQuotes()
  const totals = { reits: { total: 0, gain_loss: 0 }, stocks: { total: 0, gain_loss: 0 }, monitored: { total: 0, gain_loss: 0 } }
  const type = { adrs: "stocks", stocks: "stocks", reits: "reits", businesstrusts: "reits" }
  for (const symbol in stocks) {
    let avg_price, mkt_value, gain_loss = null
    if (symbol in portfolio) {
      const rate = stocks[symbol].n.trimEnd().endsWith("USD") ? rates.SGD : 1
      avg_price = portfolio[symbol].avg_price
      mkt_value = Math.floor(stocks[symbol].lt * portfolio[symbol].holdings * rate)
      gain_loss = Math.floor((stocks[symbol].lt - avg_price) * portfolio[symbol].holdings * rate)
      totals[type[stocks[symbol].type]].total += mkt_value
      totals[type[stocks[symbol].type]].gain_loss += gain_loss
    }
    stocks[symbol].avg_price = avg_price
    stocks[symbol].mkt_value = mkt_value
    stocks[symbol].gain_loss = gain_loss
  }
  totals.monitored.total = totals.reits.total + totals.stocks.total
  totals.monitored.gain_loss = totals.reits.gain_loss + totals.stocks.gain_loss

  totals.reits.meta = `1 USD = ${rates.SGD.toFixed(3)} SGD`
  totals.stocks.meta = `1 SGD = ${(rates.JPY / rates.SGD).toFixed(2)} JPY`
  totals.monitored.meta = `10 CNY = ${(rates.SGD / rates.CNY * 10).toFixed(2)} SGD`
  return [stocks, time, totals]
}

const data = () => {
  return {
    stocks: {},
    totals: {},
    processedTime: 0,
    intervalTime: 0,
    intervalId: 0,
    async updateSelf(initial = false) {
      this.intervalTime = new Date().valueOf()
      if (initial || (officeHours() && this.intervalTime - this.processedTime > 80000)) {
        [stocks, time, totals] = await updateState()
        this.stocks = stocks
        this.totals = totals
        this.processedTime = time
        this.intervalTime = new Date().valueOf() // so that no -1 and 0 secs ago
      }
      // to simulate change in data on every interval update
      // for (symbol of ["N2IU", "BTOU", "A7RU"]) {
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
  { label: "Mkt Val", alias: "mkt_value", format: num => num ? numComma(num) : "-" },
  { label: "Gain/Loss", alias: "gain_loss", format: num => num !== null ? numComma(num, true) : "-" },
]

const numComma = (num, colored = false) => `<div class="${color(colored ? num : 0)}">${num.toLocaleString()}</div>`

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
