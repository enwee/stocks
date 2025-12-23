// from localStorage
const get = key => JSON.parse(localStorage.getItem(key))
const urls = get("urls")
const display = get("display")[get("use")] // used in alpinejs html page
const counters = [...new Set(Object.values(get("display")).map(d => Object.values(d).flat()).flat())]
const portfolio = Object.fromEntries(Object.entries(get("trades")).map(([k, v]) => [k, v.at(-1)]))
const sdrs = get("sdrs")
const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)

// datetime related
const EIGHTHRSMILLISECS = 8 * 60 * 60 * 1000
// time shifted back 8hrs to get Date change happening at 8am
const notSameday = (t1, t2, shiftBack = 0) => new Date(t1 - shiftBack).toDateString() !== new Date(t2 - shiftBack).toDateString()
const isWeekend = time => [0, 6].includes(new Date(time).getDay())
const isAfter = (hhmm, time) => {
  const now = new Date(time), hour = now.getHours(), minute = now.getMinutes()
  const hh = Math.floor(hhmm / 100), mm = hhmm % 100
  return hour > hh || (hour === hh && minute > mm)
}
const updateDue = (processedTime, intervalTime) => notSameday(processedTime, intervalTime) ? true :
  isWeekend(intervalTime) ? false :
    isAfter(1730, intervalTime) ? !isAfter(1730, processedTime) :
      isAfter(830, intervalTime) && (intervalTime - processedTime > 80000)
const dateNowAndStore = () => {
  const d = new Date()
  localStorage.setItem("lastIndex", JSON.stringify(d.toString()))
  return d.getTime()
}
const initialTime = newLoad => newLoad ? dateNowAndStore() : Date.parse(get("lastIndex"))


const getQuotes = async () => {
  console.log('getting quotes...')
  const resp = await fetch(useProxy(urls.quotes))
  const data = await resp.json()
  const q_temp = data.data.prices.filter(quote => counters.includes(quote.nc))
  const quotes = Object.fromEntries(q_temp.map(quote => [quote.nc, quote])) // v1 quotes

  const quotes_v2 = Object.fromEntries(q_temp.map(({ nc: code, n: name, lt: last, c: chng, p: pChng, h: high, l: low, vl: vol, pv: prev, type, trading_time }) =>
    [code, { code, name, last, chng, pChng, high, low, vol, prev, type, trading_time }]))
  localStorage.setItem("quotes", JSON.stringify(quotes_v2))

  console.log(`quotes done (${Date(data.meta.processedTime)})`)
  return [quotes, data.meta.processedTime]
}

// referenceTime = Date.now() default is needed for when directly calling this from console
const getRates = async (referenceTime = Date.now()) => {
  let rates = get("rates")
  if (!rates || referenceTime > Date.parse(rates.nextUpdateTime)) {
    console.log(`getting rates...`)
    rates = { time: 0, lastUpdateTime: "", nextUpdateTime: 0 }
    const resp = await fetch(urls.rates)
    const data = await resp.json()
    for (const rate of ["USD", "JPY", "CNY", "HKD", "SGD", "IDR", "EUR", "TWD"]) {
      rates[rate] = data.conversion_rates[rate]
    }
    rates.time = new Date().toString()
    rates.lastUpdateTime = new Date(data.time_last_update_unix * 1000).toString()
    rates.nextUpdateTime = new Date(data.time_next_update_unix * 1000).toString()
    localStorage.setItem("rates", JSON.stringify(rates))
    console.log(`rates done (${Date(rates.time)})`)
  }
  return rates
}

// referenceTime = Date.now() default is needed for when directly calling this from console
const getFinancials = async (referenceTime = Date.now()) => {
  let financials = get("financials")
  // need to check if financial.lastUpdatedTime is in utc or local. (23xx or +1 0700)
  if (!financials || notSameday(Date.parse(financials.time), referenceTime, EIGHTHRSMILLISECS)) {
    financials = { time: 0 }
    for (const symbol of counters) {
      console.log(`getting financials ${symbol}...`)
      const resp = await fetch(useProxy(urls.financials.replace("{CODE}", symbol)))
      const data = (await resp.json()).data[0] || {}
      for (const key in data) {
        // data[key] can be null // data itself can be {}
        data[key] = data[key] && key !== "lastUpdatedTime" ? Number(data[key]) : data[key]
      }
      financials[symbol] = data
    }
    financials.time = new Date().toString()
    localStorage.setItem("financials", JSON.stringify(financials))
    console.log(`financials done (${financials.time})`)
  }
  return financials
}

const sdrInfo = ({ lt: last, nc: symbol }, rates) => {
  const { ratio, currency } = sdrs[symbol]
  const v = last * ratio * rates[currency]
  return `${currency} ${flag[currency]} ${v.toFixed(2)}`
}

const updateDisplay = async (referenceTime = Date.now()) => {
  const rates = await getRates(referenceTime)
  const financials = await getFinancials(referenceTime)
  const [stocks, quotesTime] = await getQuotes()
  const totals = { reits: { total: 0, gain_loss: 0 }, stocks: { total: 0, gain_loss: 0 }, monitored: { total: 0, gain_loss: 0 } }
  const type = { adrs: "stocks", stocks: "stocks", reits: "reits", businesstrusts: "reits" }
  for (const symbol in stocks) {
    let mkt_value = null, gain_loss = null, usd = null
    if (symbol in portfolio) {
      usd = stocks[symbol].n.trim().endsWith("USD")
      const rate = usd ? 1 / rates.USD : 1
      const { holdings, avgPrice } = portfolio[symbol]
      mkt_value = Math.floor(stocks[symbol].lt * holdings * rate)
      gain_loss = Math.floor((stocks[symbol].lt - avgPrice) * holdings * rate)
      totals[type[stocks[symbol].type]].total += mkt_value
      totals[type[stocks[symbol].type]].gain_loss += gain_loss
    }
    // what about PE/PB by last done
    Object.assign(stocks[symbol], financials[symbol], portfolio[symbol], { mkt_value, gain_loss, usd })
    if (stocks[symbol].type === "adrs") {
      stocks[symbol].sdrInfo = sdrInfo(stocks[symbol], rates)
    }
  }

  totals.monitored.total = totals.reits.total + totals.stocks.total
  totals.monitored.gain_loss = totals.reits.gain_loss + totals.stocks.gain_loss

  totals.reits.meta = `1 USD ${flag.USD} = ${(1 / rates.USD).toFixed(3)} SGD ${flag.SGD}`
  totals.stocks.meta = `1 SGD ${flag.SGD} = ${rates.JPY.toFixed(3)} JPY ${flag.JPY}`
  totals.monitored.meta = `10 CNY ${flag.CNY} = ${((1 / rates.CNY) * 10).toFixed(3)} SGD ${flag.SGD}`
  return [stocks, rates.time, financials.time, quotesTime, totals]
}

// alpinejs x-data
const xData = () => ({
  stocks: {},
  totals: {},
  time: {
    rates: 0,
    financials: 0,
    quotes: 0,
    interval: 0,
  },
  intervalId: 0,
  use: get("use"),
  async updateSelf(initial = false) {
    if (initial || updateDue(this.time.quotes, this.time.interval)) {
      // do not updateStocks(intervalTime) cos intervalTime === 0 for initial
      initialTime(true)
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
        if (notSameday(initialTime(), this.time.interval)) {
          // if (this.time.interval - initialTime() > 5000) {
          const d = dateNowAndStore()
          // becos location.reload almost always doesnt get new from server
          location.replace(location.origin + location.pathname + `?${d}`)
        }
        this.time.interval = Date.now()
        if (this.time.interval - this.time.quotes > 10000) {
          // do only every 10s to cater for on going awaits
          await this.updateSelf()
        }
      }, 1000);
  }
})



// html page table columns
const columns = [
  {
    label: "", alias: "n", type: "name", format: name => {
      const words = name.split(" ")
      const firstWord = words[0]
      if (firstWord.length > 9) {
        for (let i = 7; i < firstWord.length; i++) {
          if (firstWord[i] === firstWord[i].toUpperCase()) {
            words.splice(0, 1, firstWord.slice(0, i), firstWord.slice(i))
            name = words.join(" ")
            break
          }
        }
      }

      if (words.length > 2) {
        name = words.slice(0, 3).join(" ")
        name = name.length > 17 ? words.slice(0, 2).join(" ") : name
      }
      return name
    }
  },

  { label: "Last", alias: "lt", type: "watched", format: ({ lt: num, usd, pv }) => `<div class="${css.color(num, pv)}">${num}</div>` + (usd ? currency() : "") },
  { label: "Change", alias: "c", type: "watched", format: ({ c: num, usd }) => `<div class="${css.color(num)}">${num}</div>` + (usd ? currency() : "") },
  { label: "%", alias: "p", type: "watched", format: ({ p: num }) => `<div class="${css.color(num)}">${num.toFixed(1)}</div>` },

  { label: "High", alias: "h", type: "default", format: ({ h: high, usd }) => high + (usd ? currency() : "") },
  { label: "Low", alias: "l", type: "default", format: ({ l: low, usd }) => low + (usd ? currency() : "") },
  // { label: "Vol(000)", alias: "vl", type: "watched", format: ({vl}) => vl ? numComma(Math.round(vl * 10) / 10) : "-" },

  {
    label: "52 week H/L", alias: "-", type: "52w",
    format: ({ fiftyTwoWeekHigh, fiftyTwoWeekLow, lt: last, h: high, l: low, type, sdrInfo, usd }) => {
      if (type === "adrs") {
        return `(${sdrInfo})`
      }
      const pixel = (fiftyTwoWeekHigh - fiftyTwoWeekLow) / 40
      return pixel ? `<div class="w-10">${fiftyTwoWeekHigh}</div>
      <div class="p-1">
      <svg class="bg-violet-900" width="40" height="10" xmlns="http://www.w3.org/2000/svg">
      <rect class="fill-current text-violet-400" height="10"
      width="${(high - low) / pixel}" x="${(fiftyTwoWeekHigh - high) / pixel}" />
      <rect class="fill-current" width="1" height="10" x="${(fiftyTwoWeekHigh - last) / pixel}" />
      </svg>
      </div>
      <div class="text-left w-10">${fiftyTwoWeekLow}</div>${usd ? currency() : ""}` : "-"
    }
  },

  { label: "P/E", alias: "peRatio", type: "default", format: ({ lt: last, pv: prev, peRatio: pe }) => pe ? (last * pe / prev).toFixed(2) : "-" },
  { label: "P/B", alias: "priceBookValue", type: "default", format: ({ lt: last, pv: prev, priceBookValue: pb }) => pb ? (last * pb / prev).toFixed(2) : "-" },
  // { label: "Shares", alias: "holdings", type: "default", format: ({holdings:num}) => num ? numComma(num) : "-" },
  { label: "Avg Px", alias: "avgPrice", type: "default", format: ({ avgPrice: num, usd }) => num ? num.toFixed(2) + (usd ? currency() : "") : "-" },

  { label: "Mkt Val", alias: "mkt_value", type: "watched", format: ({ mkt_value: num, usd }) => num ? numComma(num) + (usd ? currency("SGD") : "") : "-" },
  { label: "Gain/Loss", alias: "gain_loss", type: "watched", format: ({ gain_loss: num, usd }) => num !== null ? numComma(num, true) + (usd ? currency("SGD") : "") : "-" },
]

const links = [
  { name: "sgx", icon: "sgx.ico" },
  { name: "yahoo", icon: "yahoo.png" },
  { name: "google", icon: "google.png" },
  { name: "divsg", icon: "divsg.png" },
]

const numComma = (num, colored = false) => `<div class="${css.color(colored ? num : 0)}">${num.toLocaleString()}</div>`

const hhmmss = millisec => {
  let hr = 0, min = 0, sec = Math.floor(millisec / 1000)
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

const currency = (str = "USD") => `<div class='${css.cornerText}'>${str}</div>`

const flag = { USD: "🇺🇸", SGD: "🇸🇬", JPY: "🇯🇵", CNY: "🇨🇳", HKD: "🇭🇰" }
