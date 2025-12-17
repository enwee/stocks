import { classes, fxLabelHTML, gainLossHTML, stringToElement, getEl, newEl, tHead, tBody, tFoot, numComma } from "./common.js"
import { getQuotesPromise, getNames, getTrades, getDivs, getTradeDivInSync } from "./storage.js"

const symbol = location.search.slice(1)
if (symbol) document.title = symbol

const trades = getTrades(symbol)
const cur = trades.at(-1)

const quote = (await getQuotesPromise())[symbol]
const name = quote ? quote.name : getNames(symbol)
const USD = name.includes("USD")
getEl("counterName").textContent = `${name} (${symbol})`

const divsByYear = getDivs(symbol)
const totalDivs = divsByYear.total
delete divsByYear.total
const tradeDivInSync = getTradeDivInSync()
const dividends = tradeDivInSync ?
  `dividends: $${numComma(totalDivs)}${USD ? fxLabelHTML("SGD") : ""}` : "(dividends out of sync)"

// not that many trade rows; ok to do extra loop for profitLoss
let profitLossExists = false
for (const trade of trades) {
  if ("profitLoss" in trade) { profitLossExists = true; break }
}
const accumPL = profitLossExists ?
  trades.reduce((acc, { carriedOver, accumPL }) => carriedOver !== undefined ? acc + accumPL : acc, 0) : NaN
const profitLoss = Number.isNaN(accumPL) ? "" : `SOLD profit/loss: $${gainLossHTML(accumPL)}`

if (quote) {
  const lastDone = `last done: $${quote.last}${USD ? fxLabelHTML() : ""}`
  const mktValue = `mkt value: $${numComma(cur.holdings * quote.last)}${USD ? fxLabelHTML() : ""}`
  const gainLoss = gainLossHTML((cur.holdings * quote.last) - cur.totalCost) + `${USD ? fxLabelHTML() : ""}`
  getEl("info").innerHTML = `| ${lastDone} | ${mktValue} (${gainLoss}) | ${dividends} | ${profitLoss}`
} else {
  getEl("info").innerHTML = `| ${dividends} | ${profitLoss} |`
}

const tradesTable = {
  tradeDate: { label: "Date", format: i => i },
  shares: { label: "Shares", format: numComma },
  price: { label: "Price", format: num => numComma(num, 3), fxLabel: true },
  tradeCost: { label: "Cost", format: numComma, fxLabel: true },
  "⟶": { label: "", format: () => "⟶" },
  holdings: { label: "Holdings", format: numComma },
  avgPrice: { label: "Avg Px", format: num => numComma(num, 3), fxLabel: true },
  totalCost: { label: "Total Cost", format: numComma, fxLabel: true },
  profitLoss: { label: "Profit/Loss", format: num => num !== undefined ? numComma(num) : "", css: num => num > 0 ? classes.green : classes.red }
}
if (!profitLossExists) delete tradesTable.profitLoss

const tradesHeadData = Object.fromEntries(
  Object.keys(tradesTable).map(key => [key,
    {
      css: classes.header,
      text: tradesTable[key].label,
      append: tradesTable[key].fxLabel && USD && fxLabelHTML()
    }])
)

const tradesBodyData = trades.map((trade, index) => {
  const data = {}
  for (const [key, { format, css }] of Object.entries(tradesTable)) {
    const classList = css ? css(trade[key]) : ""
    data[key] = {
      text: format(trade[key]),
      css: classes.base() + classes.altBG(index % 2) + classList
    }
  }
  return data
})

const thead = tHead(tradesHeadData)
const tbody = tBody(tradesBodyData)

getEl("tradesHistory").append(newEl("table", {}, thead, tbody))
getEl("tradesSummary").innerHTML =
  `Trade History (${numComma(cur.holdings)} shares @ $${numComma(cur.avgPrice, 3)}${USD ? fxLabelHTML() + " " : ""})`



const divsTable = {
  payDate: { label: "Pay Date", format: i => i },
  rate: { label: "Rate", format: i => i, fxLabel: true },
  shares: { label: "Holdings", format: numComma },
  amt: { label: "Amount", format: num => numComma(num, 2), fxLabel: true }
}
// const divsFooter = [{ colspan: 2 }, {}]

if (tradeDivInSync) {
  for (const [year, { divs, total }] of Object.entries(divsByYear).reverse()) {

    const divsHeadData = Object.fromEntries(
      Object.keys(divsTable).map(key => [key,
        {
          css: classes.header,
          text: divsTable[key].label,
          append: divsTable[key].fxLabel && USD && fxLabelHTML("SGD")
        }])
    )
    const divsBodyData = divs.map((div, index) => {
      const data = {}
      for (const key of Object.keys(divsTable)) {
        data[key] = {
          css: classes.base() + classes.altBG(index % 2),
          text: divsTable[key].format(div[key])
        }
      }
      return data
    })
    const divsFootData = {
      1: { span: 2 },
      2: { css: classes.text + classes.padding, text: "Total:" },
      3: { css: classes.text + classes.padding, text: numComma(total, 2) }
    }
    const thead = tHead(divsHeadData)
    const tbody = tBody(divsBodyData)
    const tfoot = tFoot(divsFootData)
    const table = newEl("table", {}, thead, tbody, tfoot)

    const summary = newEl("summary", { css: "py-1 text-xl text-violet-400" }, `${year} Dividends ($${numComma(total)}`, USD ? stringToElement(fxLabelHTML("SGD")) : "", USD ? " )" : ")")
    const details = newEl("details", { css: "py-1 w-max" }, summary, table)
    getEl("rootDiv").append(details)
  }
}