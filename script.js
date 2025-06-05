const get = key => JSON.parse(localStorage.getItem(key))

const urls = get("urls")
const useProxy = url => urls.proxy + "?url=" + encodeURIComponent(url)

const display = get("display")
const counters = Object.values(display).flat()

const get_quotes = async () => {
  const resp = await fetch(useProxy(urls.quotes))
  const data = await resp.json()
  const quotes = data.data.prices.filter(quote => counters.includes(quote.nc))
    .reduce((acc, quote) => {
      acc[quote.nc] = quote
      return acc
    }, {})
  return [quotes, data.meta.processedTime]
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
  { label: "Change", alias: "c", format: num => `<div class="${color(num)}" >${num}</div>` },
  { label: "%", alias: "p", format: num => `<div class="${color(num)}" >${num.toFixed(1)}</div>` },
  { label: "High", alias: "h", format: num => num },
  { label: "Low", alias: "l", format: num => num },
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
