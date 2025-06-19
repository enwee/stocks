// from localStorage
const get = key => JSON.parse(localStorage.getItem(key))
const urls = get("urls")
const display = get("display")
const counters = Object.values(display).flat()
const portfolio = get("portfolio")
const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)

// datetime related
const EIGHTHRSMILLISECS = 8 * 60 * 60 * 1000
// time shifted back 8hrs to get Date change happening at 8am
const notSameday = (t1, t2, shift = 0) => new Date(t1 - shift).toDateString() != new Date(t2 - shift).toDateString()
const isWeekend = time => [0, 6].includes(new Date(time).getDay())
const isAfter = (hhmm, time) => {
  const now = new Date(time), hour = now.getHours(), minute = now.getMinutes()
  const hh = Math.floor(hhmm / 100), mm = hhmm % 100
  return hour > hh || (hour == hh && minute > mm)
}
const updateDue = (processedTime, intervalTime) => notSameday(processedTime, intervalTime) ? true :
  isWeekend(intervalTime) ? false :
    isAfter(1730, intervalTime) ? !isAfter(1730, processedTime) :
      isAfter(830, intervalTime) && (intervalTime - processedTime > 80000)


const getQuotes = async () => {
  console.log('getting quotes...')
  const resp = await fetch(useProxy(urls.quotes))
  const data = await resp.json()
  const quotes = data.data.prices.filter(quote => counters.includes(quote.nc))
    .reduce((acc, quote) => {
      acc[quote.nc] = quote
      return acc
    }, {})
  console.log(`quotes done (${Date(data.meta.processedTime)})`)
  return [quotes, data.meta.processedTime]
}

// referenceTime = Date.now() default is needed for when directly calling this from console
const getRates = async (referenceTime = Date.now()) => {
  let rates = get("rates")
  if (!rates || notSameday(rates.time, referenceTime, EIGHTHRSMILLISECS)) {
    console.log(`getting rates...`)
    rates = { time: 0, lastUpdatedTime: "" }
    const resp = await fetch(urls.rates)
    const data = await resp.json()
    for (const rate of ["USD", "JPY", "CNY", "HKD"]) {
      rates[rate] = data.conversion_rates[rate]
    }
    rates.time = Date.now()
    rates.lastUpdatedTime = Date(data.time_last_update_unix * 1000)
    localStorage.setItem("rates", JSON.stringify(rates))
    console.log(`rates done (${Date(rates.time)})`)
  }
  return rates
}

// referenceTime = Date.now() default is needed for when directly calling this from console
const getFinancials = async (referenceTime = Date.now()) => {
  let financials = get("financials")
  if (!financials || notSameday(financials.time, referenceTime, EIGHTHRSMILLISECS)) {
    financials = { time: 0 }
    for (const symbol of counters) {
      console.log(`getting financials ${symbol}...`)
      const resp = await fetch(useProxy(urls.financials.replace("{CODE}", symbol)))
      const data = (await resp.json()).data[0] || {}
      for (const key in data) {
        // data[key] can be null // data itself can be {}
        data[key] = data[key] && key != "lastUpdatedTime" ? Number(data[key]) : data[key]
      }
      financials[symbol] = data
    }
    financials.time = Date.now()
    localStorage.setItem("financials", JSON.stringify(financials))
    console.log(`financials done (${Date(financials.time)})`)
  }
  return financials
}

const sdrInfo = ({ lt: last, nc: symbol }, rates) => {
  const sdrs = { HBBD: { ratio: 5, currency: "HKD", code: "9988" } }
  const { ratio, currency, code } = sdrs[symbol]
  const v = last * ratio * rates[currency]
  return { price: `${currency} ${v.toFixed(2)}`, code }
}

const updateDisplay = async (referenceTime = Date.now()) => {
  const rates = await getRates(referenceTime)
  const financials = await getFinancials(referenceTime)
  const [stocks, quotesTime] = await getQuotes()
  const totals = { reits: { total: 0, gain_loss: 0 }, stocks: { total: 0, gain_loss: 0 }, monitored: { total: 0, gain_loss: 0 } }
  const type = { adrs: "stocks", stocks: "stocks", reits: "reits", businesstrusts: "reits" }
  for (const symbol in stocks) {
    let avg_price, mkt_value, gain_loss = null
    if (symbol in portfolio) {
      const rate = stocks[symbol].n.trim().endsWith("USD") ? 1 / rates.USD : 1
      avg_price = portfolio[symbol].avg_price
      mkt_value = Math.floor(stocks[symbol].lt * portfolio[symbol].holdings * rate)
      gain_loss = Math.floor((stocks[symbol].lt - avg_price) * portfolio[symbol].holdings * rate)
      totals[type[stocks[symbol].type]].total += mkt_value
      totals[type[stocks[symbol].type]].gain_loss += gain_loss
    }
    stocks[symbol].avg_price = avg_price
    stocks[symbol].mkt_value = mkt_value
    stocks[symbol].gain_loss = gain_loss
    // what about PE/PB by last done
    Object.assign(stocks[symbol], financials[symbol])
    if (stocks[symbol].type == "adrs") {
      stocks[symbol].sdrInfo = sdrInfo(stocks[symbol], rates)
    }
  }

  totals.monitored.total = totals.reits.total + totals.stocks.total
  totals.monitored.gain_loss = totals.reits.gain_loss + totals.stocks.gain_loss

  totals.reits.meta = `1 USD = ${(1 / rates.USD).toFixed(3)} SGD`
  totals.stocks.meta = `1 SGD = ${rates.JPY.toFixed(3)} JPY`
  totals.monitored.meta = `10 CNY = ${((1 / rates.CNY) * 10).toFixed(3)} SGD`
  return [stocks, rates.time, financials.time, quotesTime, totals]
}

// alpinejs x-data
const data = () => {
  return {
    stocks: {},
    totals: {},
    time: {
      initial: Date.now(),
      rates: 0,
      financials: 0,
      quotes: 0,
      interval: 0,
    },
    intervalId: 0,
    async updateSelf(initial = false) {
      if (initial || updateDue(this.time.quotes, this.time.interval)) {
        // do not updateStocks(intervalTime) cos intervalTime == 0 for initial
        const [stocks, ratesTime, financialsTime, quotesTime, totals] = await updateDisplay()
        this.stocks = stocks
        this.totals = totals
        this.time.rates = ratesTime
        this.time.financials = financialsTime
        this.time.quotes = quotesTime
        this.time.interval = Date.now() // so that no -1 and 0 secs ago
      }
      // to simulate change in data on every interval update
      // for (symbol of Object.keys(portfolio).filter(() => Math.random() < 0.5)) {
      //   this.stocks[symbol].mkt_value++
      //   this.stocks[symbol].gain_loss++
      // }
    },
    async init() {
      await this.updateSelf(true)
      this.intervalId = setInterval(
        async () => {
          if (notSameday(this.time.initial, this.time.interval)) {
            location.reload()
          }
          this.time.interval = Date.now()
          if (this.time.interval - this.time.quotes > 10000) {
            // do only every 10s to cater for on going awaits
            await this.updateSelf()
          }
        }, 1000);
    }
  }
}



// html page table columns
const columns = [
  {
    label: "Company Name", alias: "n", type: "name", format: name => {
      const words = name.split(" ")
      if (words.length > 2) {
        name = words.slice(0, 3).join(" ")
        name = name.length > 16 ? words.slice(0, 2).join(" ") : name
      }
      return name
    }
  },

  { label: "Last", alias: "lt", type: "watched", format: num => num },
  { label: "Change", alias: "c", type: "watched", format: num => `<div class="${color(num)}">${num}</div>` },
  { label: "%", alias: "p", type: "watched", format: num => `<div class="${color(num)}">${num.toFixed(1)}</div>` },

  { label: "High", alias: "h", type: "default", format: num => num },
  { label: "Low", alias: "l", type: "default", format: num => num },

  {
    label: "52 week H/L", alias: "-", type: "52w",
    format: ({ fiftyTwoWeekHigh, fiftyTwoWeekLow, lt: last, h: high, l: low, type, sdrInfo }) => {
      if (type == "adrs") {
        return `(${sdrInfo.price})`
      }
      const pixel = (fiftyTwoWeekHigh - fiftyTwoWeekLow) / 50
      return `<div class="w-12">${fiftyTwoWeekHigh}</div>
      <div class="p-2">
      <svg class="bg-violet-900" width="50" height="10" xmlns="http://www.w3.org/2000/svg">
      <rect class="fill-current text-violet-400" height="10" 
      width="${(high - low) / pixel}" x="${(fiftyTwoWeekHigh - high) / pixel}" />
      <rect class="fill-current" width="1" height="10" x="${(fiftyTwoWeekHigh - last) / pixel}" />
      </svg>
      </div>
      <div class="text-left w-12">${fiftyTwoWeekLow}</div>`
    }
  },

  { label: "P/E", alias: "peRatio", type: "default", format: num => num ? num.toFixed(2) : "-" },
  { label: "P/B", alias: "priceBookValue", type: "default", format: num => num ? num.toFixed(2) : "-" },
  { label: "Avg Px", alias: "avg_price", type: "default", format: num => num ? num.toFixed(2) : "-" },

  { label: "Mkt Val", alias: "mkt_value", type: "watched", format: num => num ? numComma(num) : "-" },
  { label: "Gain/Loss", alias: "gain_loss", type: "watched", format: num => num !== null ? numComma(num, true) : "-" },
]

const links = [
  { name: "sgx", icon: "sgx.ico", ext: true },
  { name: "yahoo", icon: "yahoo.png", ext: true },
  { name: "google", icon: "google.png", ext: true },
  { name: "divsg", icon: "divsg.png", ext: true },
  { name: "counter", icon: "money.png", ext: false },
]

const numComma = (num, colored = false) => `<div class="${color(colored ? num : 0)}">${num.toLocaleString()}</div>`

const hhmmss = millisec => {
  let hr = 0
  let min = 0
  let sec = Math.floor(millisec / 1000)
  if (sec > 59) {
    min = Math.floor(sec / 60)
    sec = sec % 60
  }
  if (min > 59) {
    hr = Math.floor(min / 60)
    min = min % 60
  }
  return `${hr ? `${hr} hr ` : ""}${min ? `${min} min ` : ""}${sec} sec`
}

const timeDateStr = time => new Date(time).toLocaleTimeString() + " " + new Date(time).toDateString()

// css classes
const header = "pb-2 px-2 text-gray-400 whitespace-nowrap "
const border = "border-b border-r border-gray-400 "
const padding = "py-1 px-2 "
const text = "text-lg text-gray-400 text-right "
const base = border + padding + text
const green = "text-emerald-500"
const red = "text-rose-700"
const color = num => num > 0 ? green : num < 0 ? red : ""
const altBG = bool => bool ? "bg-slate-900" : "bg-stone-900"
const button = "bg-violet-900 hover:bg-violet-400 px-4 py-2 rounded-2xl"
const blink = bool => bool ? "animate-(--animate-true) " : "animate-(--animate-false) "
