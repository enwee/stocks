const reader = new FileReader()

const xData = () => ({
  key: '',
  value: '',
  page: 'index',
  msg: "Data",
  async getFile() {
    // Open file picker and destructure the result of first handle
    const [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    reader.readAsText(file)
    reader.onload = () => handleFile(file, this)
  }
})

const handleFile = (file, xData) => {
  switch (file.type) {
    case "application/json": {
      const data = JSON.parse(reader.result)
      for (const key in data) {
        localStorage.setItem(key, JSON.stringify(data[key]))
      }
      xData.msg = "json processed"
      break
    }
    case "text/csv":
      xData.msg = handleCSV(reader.result)
      break
    default:
      xData.msg = "Not JSON/CSV, logged to console"
      console.log(reader.result)
  }
}

const handleCSV = rawStr => {
  let msg = null
  const rawLines = rawStr.trimEnd().split("\n")
  const header = rawLines.shift().trimEnd().split(",")
  switch (JSON.stringify(header)) {
    case JSON.stringify(["name", "shares", "price", "date", "symbol"]):
      msg = handleTrades(rawLines)
      break
    case JSON.stringify(["example", "ex", "pay", "rate", "symbol"]):
      break
    default: {
      const rows = []
      for (const rawLine of rawLines) {
        const rowArray = rawLine.trimEnd().split(",")
        const rowObject = {}
        for (const [index, key] of header.entries()) {
          rowObject[key] = rowArray[index]
        }
        rows.push(rowObject)
      }
      msg = "Not known CSV, logged to console"
      console.log(rows)
    }
  }
  return msg
}

const handleTrades = rawLines => {
  const symbolName = {}, trades = {}, portfolio = {} // going to localStorage
  let stockCode = "", tradesOfaStock = [], prevDate = "1-Jan-2000", prevHoldings = 0, prevTotalCost = 0
  for (const rawLine of rawLines) {
    let [name, shares, price, date, code] = rawLine.trimEnd().split(',')
    if (name && code) {
      if (tradesOfaStock.length > 0) {
        trades[stockCode] = tradesOfaStock // store previous stock trades[]
        // legacy; to change
        portfolio[stockCode] = { holdings: tradesOfaStock.at(-1).holdings, avg_price: tradesOfaStock.at(-1).avgPrice }
      }
      stockCode = code, symbolName[code] = name
      tradesOfaStock = [], prevDate = "1-Jan-2000", prevHoldings = 0, prevTotalCost = 0
    }
    if (new Date(date) < new Date(prevDate)) {
      return `Error: ${stockCode} prev:${prevDate} current:${date} `
    }
    shares = Number(shares)
    price = Number(price)
    const tradeCost = shares ? shares * price : price
    const totalCost = prevTotalCost + tradeCost
    const holdings = prevHoldings + shares
    const avgPrice = totalCost / holdings
    prevDate = date
    prevHoldings = holdings
    prevTotalCost = totalCost
    tradesOfaStock.push({ date, shares, price, tradeCost, holdings, avgPrice, totalCost })
  }
  trades[stockCode] = tradesOfaStock
  // legacy; to change
  portfolio[stockCode] = { holdings: tradesOfaStock.at(-1).holdings, avg_price: tradesOfaStock.at(-1).avgPrice } // legacy to change

  localStorage.setItem("names", JSON.stringify(symbolName))
  localStorage.setItem("trades", JSON.stringify(trades))
  localStorage.setItem("portfolio", JSON.stringify(portfolio))
  return "trades processed"
}

