import { css, getEl, newEl, tHead, tBody, numComma, numFixed } from "./common.js"
import { getNames, getTrades } from "./storage.js"

const symbol = location.search.slice(1)
if (symbol) document.title = symbol

const name = (await getNames())[symbol]
getEl("counterName").textContent = `${name} (${symbol})`

const USD = name.includes("USD")

const tableConfig = {
  tradeDate: {
    label: "Date", format: str => { // d-m-y -> "d m 20y"
      const dMy = str.split("-")
      dMy[2] = "20" + dMy[2]
      return dMy.join(" ")
    }
  },
  shares: { label: "Shares", format: numComma },
  price: { label: "Price", format: numFixed, fxLabel: true },
  tradeCost: { label: "Cost", format: numComma, fxLabel: true },
  "": { label: "", format: () => "⟶" },
  holdings: { label: "Holdings", format: numComma },
  avgPrice: { label: "Avg Px", format: numFixed, fxLabel: true },
  totalCost: { label: "Total Cost", format: numComma, fxLabel: true },
}

const fxLabelHTML = (str = "USD") => `<span class='relative'><div class='text-[8px] absolute -top-1 -right-3.5'>${str}</div></span>`

const trades = getTrades(symbol)
const cur = trades.at(-1)

const tradesHeadData = Object.fromEntries(
  Object.keys(tableConfig).map(key => [key,
    {
      css: css.header,
      text: tableConfig[key].label,
      append: tableConfig[key].fxLabel && USD && fxLabelHTML()
    }])
)

const tradesBodyData = trades.map((trade, index) => {
  const data = {}
  for (const key of Object.keys(tableConfig)) {
    data[key] = {
      text: tableConfig[key].format(trade[key]),
      css: css.base() + css.altBG(index % 2)
    }
  }
  return data
})


const thead = tHead(tradesHeadData)
const tbody = tBody(tradesBodyData)

getEl("tradesHistory").append(newEl("table", {}, thead, tbody))
getEl("tradesSummary").innerHTML =
  `Trade History (${numComma(cur.holdings)} shares @ $${numFixed(cur.avgPrice)}${USD ? fxLabelHTML() + " " : ""})`

