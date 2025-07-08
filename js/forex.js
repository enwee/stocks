const get = key => JSON.parse(localStorage.getItem(key))
const urls = get("urls")

// referenceTime = Date.now() default is needed for when directly calling this from console
const getRates = async (referenceTime = Date.now()) => {
  let rates = get("rates")
  if (!rates || referenceTime > rates.nextUpdateTime) {
    console.log(`getting rates...`)
    rates = { time: 0, lastUpdateTime: "", nextUpdateTime: 0 }
    const resp = await fetch(urls.rates)
    const data = await resp.json()
    for (const rate of ["USD", "JPY", "CNY", "HKD", "SGD"]) {
      rates[rate] = data.conversion_rates[rate]
    }
    rates.time = Date.now()
    rates.lastUpdateTime = new Date(data.time_last_update_unix * 1000).toString()
    rates.nextUpdateTime = data.time_next_update_unix * 1000
    localStorage.setItem("rates", JSON.stringify(rates))
    console.log(`rates done (${Date(rates.time)})`)
  }
  return rates
}

const exchange = async (val, fromCur, toCur) => {
  const rates = await getRates()
  const amt = val * (1 / rates[fromCur]) / (1 / rates[toCur])
  return amt > 1000 ? Math.round(amt) : Math.round(amt * 100) / 100
}

const save = xData => {
  // xData is from alpinejs $data and cannot do object spread.
  const data = JSON.parse(JSON.stringify(xData)); // copy of xData
  ["val2", "val4"].forEach(key => data[key] = null)
  localStorage.setItem("lastForex", JSON.stringify(data))
}


const xData = () => get("lastForex") || ({
  val1: 10,
  cur1: "CNY",
  val2: null,
  cur2: "SGD",
  val3: 1,
  cur3: "SGD",
  val4: null,
  cur4: "JPY",
})

const flags = { CNY: "🇨🇳", JPY: "🇯🇵", SGD: "🇸🇬", USD: "🇺🇸", HKD: "🇭🇰" }
