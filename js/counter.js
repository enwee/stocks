import { classes, numComma } from "./common.js"
import { getQuotesPromise, getNames, getTrades, getDivs, getTradeDivInSync } from "./storage.js"
import { fxLabelHTML, gainLossHTML, getEl, newEl, tHeadEl, tBodyEl, tFootEl, detailsEl } from "./htmlEls.js"

const params = new URLSearchParams(location.search)
const symbol = params.get("code")
const open = params.get("open")
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
  `dividends: $${numComma(totalDivs)}${USD ? fxLabelHTML({ curr: "SGD" }) : ""}` : "(dividends out of sync)"

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
  getEl("info").innerHTML = `| ${dividends} | ${profitLoss} |` // TOREVIEW innerHTML
}

const tradesTableConfig = {
  css: {
    head: classes.header,
    rows: classes.base(),
    indexed: i => classes.altBG(i % 2)
  },
  cols: {
    tradeDate: { label: "Date", format: i => i },
    shares: { label: "Shares", format: numComma },
    price: { label: "Price", format: num => numComma(num, 3), fxLabel: true },
    tradeCost: { label: "Cost", format: numComma, fxLabel: true },
    "⟶": { label: "", format: () => "⟶" },
    holdings: { label: "Holdings", format: numComma },
    avgPrice: { label: "Avg Px", format: num => numComma(num, 3), fxLabel: true },
    totalCost: { label: "Total Cost", format: numComma, fxLabel: true },
    profitLoss: {
      label: "Profit/Loss", format: num => num !== undefined ? numComma(num) : "",
      css: num => num > 0 ? classes.green : classes.red // TOREVIEW gainLossHTML
    }
  },
  fxLabel: { required: USD }
}
if (!profitLossExists) delete tradesTableConfig.cols.profitLoss

const thead = tHeadEl(tradesTableConfig)
const tbody = tBodyEl(tradesTableConfig, trades)
const table = newEl("table", {}, thead, tbody)
const details = detailsEl(table, "", false, // table, group name, open
  `Trade History (${numComma(cur.holdings)} shares @ $${numComma(cur.avgPrice, 3)}`,
  USD ? fxLabelHTML({ asEl: true }) : "",
  ")")
getEl("rootDiv").append(details)

if (tradeDivInSync) {
  const divsTableConfig = {
    css: {
      head: classes.header,
      rows: classes.base(),
      indexed: i => classes.altBG(i % 2),
      foot: classes.text + classes.padding
    },
    cols: {
      payDate: { label: "Pay Date", format: i => i },
      rate: { label: "Rate", format: i => i, fxLabel: true },
      shares: { label: "Holdings", format: numComma },
      amt: { label: "Amount", format: num => numComma(num, 2), fxLabel: true }
    },
    fxLabel: { required: USD, label: "SGD" },
    foot: {
      1: { span: 2 },
      2: { text: "Total:" },
      3: { format: num => numComma(num, 2) }
    }
  }

  for (const [year, { divs, total }] of Object.entries(divsByYear).reverse()) {
    const thead = tHeadEl(divsTableConfig)
    const tbody = tBodyEl(divsTableConfig, divs.reverse())
    const tfoot = tFootEl(divsTableConfig, { 3: total })
    const table = newEl("table", {}, thead, tbody, tfoot)
    const details = detailsEl(table, symbol, open === year, // table, group name, open
      `${year} Dividends ($${numComma(total)}`,
      USD ? fxLabelHTML({ asEl: true, curr: "SGD" }) : "",
      ")")
    getEl("rootDiv").append(details)
  }
}
