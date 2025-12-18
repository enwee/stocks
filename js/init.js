import XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"
import { get, save, deleet } from "./storage.js"
import { PATHMOD, fixNum, sortByDate, getEl, changeText } from "./common.js"

const MAIN_BUTTON = "mainBtn"
const FILE_INPUT = "fileInput"
const KEY_INPUT = "keyInput"
const DELETE_BUTTON = "deleteBtn"
const VALUE_INPUT = "valueInput"
const SAVE_BUTTON = "saveBtn"
const INFO_LINE = "infoLine"
const DISPLAY_PANE = "displayPane"

const backToMain = () => location.href = location.origin + PATHMOD

const handleKeyInput = () => {
  const key = getEl(KEY_INPUT).value
  changeText(INFO_LINE, key)
  changeText(DISPLAY_PANE, JSON.stringify(get(key), null, 2))
}

const handleDelete = () => {
  const key = getEl(KEY_INPUT).value
  getEl(KEY_INPUT).value = ""
  if (key !== "ALL" && get(key) === null) {
    changeText(INFO_LINE, `[${key}] no such key to delete!`)
  } else if (confirm(`${key === "ALL" ? "EVERYTHING" : `[${key}]`} will be deleted!\nAre you sure?`)) {
    deleet(key)
    const msg = key === "ALL" ? "EVERYTHING deleted" : `[${key}] deleted`
    changeText(INFO_LINE, msg)
    changeText(DISPLAY_PANE, "")
  }
}

const handleSave = () => {
  const key = getEl(KEY_INPUT).value
  const value = getEl(VALUE_INPUT).value
  if (key) {
    try {
      const json = JSON.parse(value)
      if (confirm(`[${key}:${value}] will be saved!\nAre you sure?`)) {
        save(key, json)
        getEl(VALUE_INPUT).value = ""
        handleKeyInput()
      }
    } catch {
      changeText(INFO_LINE, "not valid JSON")
    }
  } else {
    changeText(INFO_LINE, "no key input")
  }
}

const reader = new FileReader()
reader.onerror = e => {
  console.error("Error reading file:", e);
  changeText(INFO_LINE, "Error reading file.")
};

const handleFile = e => {
  getEl(KEY_INPUT).value = ""
  const file = e.target.files[0]
  if (file) {
    switch (file.type) {
      case "application/json":
        changeText(INFO_LINE, "handling json file...")
        reader.onload = e => {
          changeText(DISPLAY_PANE, e.target.result)
          const keys = ["urls", "sdrs", "exceptions", "display"]
          const data = JSON.parse(e.target.result)
          const saved = []
          for (const key of keys) {
            if (key in data) {
              save(key, data[key])
              saved.push(key)
            }
          }
          changeText(INFO_LINE, `[${saved}] saved`)
        }
        reader.readAsText(file)
        break

      case "text/csv":
        changeText(INFO_LINE, "handling csv file...")
        reader.onload = e => {
          changeText(DISPLAY_PANE, e.target.result)
        }
        reader.readAsText(file)
        break

      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        changeText(INFO_LINE, "handling xlsx file...")
        reader.onload = e => {
          const workbook = XLSX.read(e.target.result)
          if (workbook.SheetNames.includes("Buys")) {
            processTrades(workbook)
            save("use", file.name.slice(0, -5).slice(-4))
          } else if (file.name === "dividend_dates.xlsx") {
            processDividends(workbook)
          } else {
            changeText(DISPLAY_PANE, `sheets:\n${workbook.SheetNames}`)
          }
        }
        reader.readAsArrayBuffer(file)
        break

      default:
        changeText(INFO_LINE, file.type)
        reader.onload = e => {
          changeText(DISPLAY_PANE, e.target.result);
        }
        reader.readAsText(file)
    }
  } else {
    changeText(DISPLAY_PANE, "No file selected.")
  }
}

const processTrades = workbook => {
  changeText(DISPLAY_PANE, "processing trades...")
  const buys = XLSX.utils.sheet_to_json(workbook.Sheets["Buys"], { raw: false })
  const sells = XLSX.utils.sheet_to_json(workbook.Sheets["Sells"], { raw: false })
  const tradeRows = sells.concat(buys) // sells before buys for stable sort
  const allCounterTrades = {}
  const names = {}
  let counterTrades = []
  let symbol = ""
  for (const row of tradeRows) {
    if ("Symbol" in row) { // start of counter
      // save previous
      if (symbol && counterTrades.length) allCounterTrades[symbol] = counterTrades
      // setup for new
      symbol = row["Symbol"]
      counterTrades = symbol in allCounterTrades ? allCounterTrades[symbol] : []
      if (symbol !== "IGNORE") names[symbol] = row["Name"]
    }
    if (symbol === "IGNORE") continue
    // normal non-SOLD -negative shares trade is dollarCostAveraged; avgPrice is recalculated
    // SOLD -negative shares trade is selling holdings of current avgPrice; taking a profit/loss
    if ("Shares" in row) {
      const sold = "Name" in row && row["Name"].startsWith("SOLD") // "SOLD (interim)" and "SOLD"
      const tradeDate = row["Date"].replace("-", " ").replace("-", " 20")
      const shares = fixNum(row["Shares"]) * (sold ? -1 : 1)
      const price = fixNum(row["Price/share"])
      if ([shares, price].includes(NaN)) {
        changeText(DISPLAY_PANE, `error: NaN encountered at ${symbol} ${row["Date"]}`)
        return
      }
      const tradeCost = shares ? fixNum(shares * price) : price
      const holdings = "Symbol" in row ? shares : counterTrades.at(-1).holdings + shares
      let totalCost, avgPrice
      if (!sold) { // dollar cost averaged
        totalCost = "Symbol" in row ? tradeCost : fixNum(counterTrades.at(-1).totalCost + tradeCost)
        avgPrice = holdings ? fixNum(totalCost / holdings) : 0
      } else { // SOLD does not change avgPrice
        avgPrice = counterTrades.at(-1).avgPrice
        totalCost = fixNum(avgPrice * holdings)
      }
      const counterTrade = {
        tradeDate, shares, price, tradeCost, holdings, avgPrice, totalCost
      }
      if (sold) {
        const profitLoss = fixNum((price - avgPrice) * (-shares))
        const accumPL = counterTrades.at(-1).accumPL
        counterTrade.profitLoss = profitLoss
        counterTrade.accumPL = accumPL ? accumPL + profitLoss : profitLoss
        if (row["Name"] === "SOLD") { // final "SOLD" vs "SOLD (interim)""
          counterTrade.carriedOver = counterTrade.holdings
          counterTrade.holdings = 0
          counterTrade.profitLoss = fixNum(counterTrade.profitLoss - totalCost)
        }
      }
      counterTrades.push(counterTrade)
    }
  }
  allCounterTrades[symbol] = counterTrades
  save("trades", allCounterTrades)
  save("names", names)
  changeText(DISPLAY_PANE, "trades processed")
}

const processDividends = workbook => {
  changeText(DISPLAY_PANE, "processing dividends...")
  const trades = get("trades")
  if (!trades) {
    changeText(DISPLAY_PANE, "cannot process dividends: no trades found!")
    return
  }
  const allCountersDividends = {}
  for (const [counter, counterTrades] of Object.entries(trades)) {
    let counterDivs = XLSX.utils.sheet_to_json(workbook.Sheets[counter], { raw: false })
    counterDivs.forEach(row => row.Rate = Number(row.Rate))
    const combined = counterTrades.concat(counterDivs)
    combined.sort(sortByDate(row => "tradeDate" in row ? "tradeDate" : "Ex"))
    counterDivs = []
    let holdings = 0
    for (const row of combined) {
      if ("tradeDate" in row) {
        holdings = row.holdings
      } else if (holdings !== 0) {
        counterDivs.push({
          exDate: row.Ex.replace("-", " ").replace("-", " 20"),
          payDate: row.Pay.replace("-", " ").replace("-", " 20"),
          rate: row.Rate,
          shares: holdings,
          amt: fixNum(row.Rate * holdings)
        })
      }
    }
    // yes deliberate extra for loop cycle, easier to understand
    const counterDivsByYear = { total: 0 }
    for (const div of counterDivs) {
      const year = div.payDate.slice(-4)
      if (year in counterDivsByYear === false) counterDivsByYear[year] = { divs: [], total: 0 }
      counterDivsByYear[year].divs.push(div)
      counterDivsByYear[year].total += div.amt
      counterDivsByYear.total += div.amt
    }
    allCountersDividends[counter] = counterDivsByYear
  }

  save("dividends", allCountersDividends)
  save("used", get("use"))
  changeText(DISPLAY_PANE, "dividends processed")
}

getEl(MAIN_BUTTON).addEventListener("click", backToMain)
getEl(FILE_INPUT).addEventListener("change", handleFile)
getEl(KEY_INPUT).addEventListener("input", handleKeyInput)
getEl(DELETE_BUTTON).addEventListener("click", handleDelete)
getEl(SAVE_BUTTON).addEventListener("click", handleSave)
