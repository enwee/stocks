
const get = key => JSON.parse(localStorage.getItem(key))

const urls = get("urls")
const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)

const display = get("display")
const counters = Object.values(display).flat()

const portfolio = get("portfolio")

// time shifted back 8hrs can get Date change to happen at 8am
const eightHrMsecs = 8 * 60 * 60 * 1000

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

const getRates = async (referenceTime = Date.now()) => {
  let rates = get("rates")
  if (!rates || notSameday(rates.time, referenceTime, eightHrMsecs)) {
    console.log(`getting rates...`)
    rates = {}
    const resp = await fetch(urls.rates)
    const data = await resp.json()
    for (const rate of ["USD", "JPY", "CNY", "HKD"]) {
      rates[rate] = data.conversion_rates[rate]
    }
    rates.time = data.time_last_update_unix * 1000 + eightHrMsecs // store in local time
    localStorage.setItem("rates", JSON.stringify(rates))
    console.log(`rates done (${Date(rates.time)})`)
  }
  return rates
}

const getFinancials = async (referenceTime = Date.now()) => {
  let financials = get("financials")
  if (!financials || notSameday(financials.time, referenceTime, eightHrMsecs)) {
    financials = {}
    for (const symbol of counters) {
      console.log(`getting financials ${symbol}...`)
      const resp = await fetch(useProxy(urls.financials.replace("{CODE}", symbol)))
      const data = (await resp.json()).data[0] || {}
      for (key in data) {
        data[key] = data[key] ? Number(data[key]) : data[key]
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
  const sdrs = { HBBD: { ratio: 5, currency: "HKD" } }
  const { ratio, currency } = sdrs[symbol]
  const v = last * ratio * rates[currency] * 0.99 // apply 1% lower rate
  return `${currency} ${v.toFixed(2)}`
}

const updateStocks = async (referenceTime = Date.now()) => {
  const rates = await getRates(referenceTime)
  const financials = await getFinancials(referenceTime)
  const [stocks, time] = await getQuotes()
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
  return [stocks, referenceTime, totals]
}

const data = () => {
  return {
    stocks: {},
    totals: {},
    processedTime: 0,
    intervalTime: 0,
    intervalId: 0,
    async updateSelf(initial = false) {
      this.intervalTime = Date.now()
      if (initial || updateDue(this.processedTime, this.intervalTime)) {
        [stocks, time, totals] = await updateStocks(this.intervalTime)
        this.stocks = stocks
        this.totals = totals
        this.processedTime = time
        this.intervalTime = Date.now() // so that no -1 and 0 secs ago
      }
      // to simulate change in data on every interval update
      // for (symbol of Object.keys(portfolio).filter(() => Math.random() < 0.5)) {
      //   this.stocks[symbol].mkt_value++
      //   this.stocks[symbol].gain_loss++
      // }
    },
    init() {
      this.updateSelf(true)
      this.intervalId = setInterval(async () => await this.updateSelf(), 1000);
      // do something to make interval cater for awaits
    }
  }
}

const columns = [
  {
    label: "Company Name", alias: "n", type: "name", format: ({ n: name, nc: code }) => {
      const words = name.split(" ")
      if (words.length > 2) {
        name = words.slice(0, 3).join(" ")
        name = name.length > 16 ? words.slice(0, 2).join(" ") : name
      }
      return `<div class="text-violet-400 text-left text-sm/4" 
      onclick="window.open('${urls.sgx.replace('{CODE}', code)}')">${name}</div>`
      // onclick buttons bar, sgx,hkex page for sdrInfo, divs.sg, own calculated div page
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
        return `(${sdrInfo})`
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

const numComma = (num, colored = false) => `<div class="${color(colored ? num : 0)}">${num.toLocaleString()}</div>`

// css classes
const header = "pb-2 px-2 text-gray-400 whitespace-nowrap"
const border = "border border-gray-400 "
const padding = "py-1 px-2 "
const text = "text-lg text-gray-400 text-right "
const base = border + padding + text
const green = "text-emerald-500"
const red = "text-rose-700"
const color = num => num > 0 ? green : num < 0 ? red : ""
const button = "bg-violet-900 hover:bg-violet-400 px-4 rounded-full"
const blink = bool => bool ? "animate-(--animate-true)" : "animate-(--animate-false)"
