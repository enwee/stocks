import XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"
import { get, save, deleet } from "./storage.js"
import { fixNum, sortByDate, getEl, changeText } from "./common.js"
// import { yearTotal } from "./functions.js"

const INFO_LINE = "infoLine"
const DISPLAY_PANE = "displayPane"
const FILE_INPUT = "fileInput"
const KEY_INPUT = "keyInput"
const DELETE_BUTTON = "deleteBtn"

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
  const allCounterTrades = {}
  let counterTrades = []
  let symbol = ""
  for (const row of buys) {
    if ("Symbol" in row) {
      if (symbol && counterTrades.length) allCounterTrades[symbol] = counterTrades
      symbol = row["Symbol"]
      counterTrades = []
    }
    if ("Shares" in row) {
      const tradeDate = row["Buy Date"].replace("-", " ").replace("-", " 20")
      const shares = fixNum(row["Shares"])
      const price = fixNum(row["Price/share"])
      if ([shares, price].includes(NaN)) {
        changeText(DISPLAY_PANE, `error: NaN encountered at ${symbol} ${row["Buy Date"]}`)
        return
      }
      const tradeCost = shares ? fixNum(shares * price) : price
      const holdings = "Symbol" in row ? shares : counterTrades.at(-1).holdings + shares
      const totalCost = "Symbol" in row ? tradeCost : fixNum(counterTrades.at(-1).totalCost + tradeCost)
      const avgPrice = holdings ? fixNum(totalCost / holdings) : 0
      counterTrades.push({
        tradeDate, shares, price, tradeCost, holdings, avgPrice, totalCost
      })
    }
  }
  allCounterTrades[symbol] = counterTrades
  save("trades", allCounterTrades)
  changeText(DISPLAY_PANE, "trades processed")
}

const processDividends = workbook => {
  changeText(DISPLAY_PANE, "processing dividends...")
  const counters = workbook.SheetNames.slice(1)
  const allCountersDividends = {}
  const trades = get("trades")
  if (!trades) {
    changeText(DISPLAY_PANE, "cannot process dividends: no trades found!")
    return
  }
  for (const counter of counters) {
    if (counter in trades) {
      let counterDivs = XLSX.utils.sheet_to_json(workbook.Sheets[counter], { raw: false })
      counterDivs.forEach(row => row.Rate = Number(row.Rate))
      const combined = trades[counter].concat(counterDivs)
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
      const counterDivsByYear = {}
      for (const div of counterDivs) {
        const year = div.payDate.slice(-4)
        if (year in counterDivsByYear === false) counterDivsByYear[year] = []
        counterDivsByYear[year].push(div)
      }

      allCountersDividends[counter] = counterDivsByYear
    }
  }
  save("dividends", allCountersDividends)
  changeText(DISPLAY_PANE, "dividends processed")
  // console.log(yearTotal("24", allCountersDividends))
}

getEl(FILE_INPUT).addEventListener("change", handleFile)
getEl(KEY_INPUT).addEventListener("input", handleKeyInput)
getEl(DELETE_BUTTON).addEventListener("click", handleDelete)
