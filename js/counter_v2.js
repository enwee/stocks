import { css, fxLabelHTML, gainLossHTML, getEl, newEl, tHead, tBody, tFoot, numComma, numFixed } from "./common.js"
import { getQuotes, getTrades, getDivs } from "./storage.js"

const symbol = location.search.slice(1)
if (symbol) document.title = symbol

const trades = getTrades(symbol)
const cur = trades.at(-1)

const quote = (await getQuotes())[symbol]
const USD = quote.name.includes("USD")

const divsByYear = getDivs(symbol)
const totalDivs = divsByYear.total
delete divsByYear.total

const lastDone = `last done: $${quote.last}${USD ? fxLabelHTML() : ""}`
const mktValue = `mkt value: $${numComma(cur.holdings * quote.last)}${USD ? fxLabelHTML() : ""}`
const gainLoss = gainLossHTML((cur.holdings * quote.last) - cur.totalCost) + `${USD ? fxLabelHTML() : ""}`
const dividends = `dividends: $${numComma(totalDivs)}${USD ? fxLabelHTML("SGD") : ""}`

getEl("counterName").textContent = `${quote.name} (${symbol})`
getEl("quote").innerHTML = `${lastDone} | ${mktValue} (${gainLoss}) | ${dividends}`


const tradesTable = {
  tradeDate: { label: "Date", format: i => i },
  shares: { label: "Shares", format: numComma },
  price: { label: "Price", format: numFixed, fxLabel: true },
  tradeCost: { label: "Cost", format: numComma, fxLabel: true },
  "": { label: "", format: () => "⟶" },
  holdings: { label: "Holdings", format: numComma },
  avgPrice: { label: "Avg Px", format: numFixed, fxLabel: true },
  totalCost: { label: "Total Cost", format: numComma, fxLabel: true },
}

const tradesHeadData = Object.fromEntries(
  Object.keys(tradesTable).map(key => [key,
    {
      css: css.header,
      text: tradesTable[key].label,
      append: tradesTable[key].fxLabel && USD && fxLabelHTML()
    }])
)

const tradesBodyData = trades.map((trade, index) => {
  const data = {}
  for (const key of Object.keys(tradesTable)) {
    data[key] = {
      text: tradesTable[key].format(trade[key]),
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

const divsTable = {
  payDate: { label: "Pay Date", format: i => i },
  rate: { label: "Rate", format: i => i, fxLabel: true },
  shares: { label: "Holdings", format: numComma },
  amt: { label: "Amount", format: num => numComma(num, 2), fxLabel: true }
}
// const divsFooter = [{ colspan: 2 }, {}]


for (const { divs, total } of Object.values(divsByYear).reverse()) {

  const divsHeadData = Object.fromEntries(
    Object.keys(divsTable).map(key => [key,
      {
        css: css.header,
        text: divsTable[key].label,
        append: divsTable[key].fxLabel && USD && fxLabelHTML("SGD")
      }])
  )
  const divsBodyData = divs.map((div, index) => {
    const data = {}
    for (const key of Object.keys(divsTable)) {
      data[key] = {
        css: css.base() + css.altBG(index % 2),
        text: divsTable[key].format(div[key])
      }
    }
    return data
  })
  const divsFootData = {
    1: { span: 2 },
    2: { css: css.text + css.padding, text: "Total:" },
    3: { css: css.text + css.padding, text: numComma(total, 2) }
  }
  const thead = tHead(divsHeadData)
  const tbody = tBody(divsBodyData)
  const tfoot = tFoot(divsFootData)

  getEl("rootDiv").append(newEl("table", {}, thead, tbody, tfoot))
}
