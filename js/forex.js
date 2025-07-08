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

const exchange = async ({ val1, cur1, cur2 }) => {
    const rates = await getRates()
    let val2 = val1 * (1 / rates[cur1]) / (1 / rates[cur2])
    val2 = val2 > 100 ? Math.round(val2) : Math.round(val2 * 100) / 100
    return val2
}

const xData = () => ({
    val1: 10,
    cur1: "CNY",
    val2: null,
    cur2: "SGD",
    async init() {
        this.val2 = await exchange(this)
    }
})

const flags = { CNY: "🇨🇳", JPY: "🇯🇵", SGD: "🇸🇬", USD: "🇺🇸", HKD: "🇭🇰" }