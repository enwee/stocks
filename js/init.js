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
  },
  save() {
    localStorage.setItem(this.key.trim(), this.value)
    setTimeout((key) => this.key = key, 1000, this.key)
    this.key = '', this.value = ''
  }
})

const handleFile = (file, xData) => {
  switch (file.type) {
    case "application/json": {
      const data = JSON.parse(reader.result)
      let index = 1
      for (const key in data) {
        localStorage.setItem(key, JSON.stringify(data[key]))
        setTimeout(key => xData.key = key, index * 1000, key)
        index += 2
      }
      xData.msg = "json processed"
      setTimeout(() => xData.msg = "Data", 2000)
      break
    }
    case "text/csv":
      xData.msg = handleCSV(reader.result)
      setTimeout(() => xData.msg = "Data", 2000)
      break
    default:
      xData.msg = "Not JSON/CSV, logged to console"
      setTimeout(() => xData.msg = "Data", 2000)
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

  const storePrevious = () => {
    const { holdings, avgPrice } = tradesOfaStock.at(-1)
    trades[stockCode] = tradesOfaStock
    portfolio[stockCode] = { holdings, avgPrice }
    tradesOfaStock = [], prevDate = "1-Jan-2000", prevHoldings = 0, prevTotalCost = 0
  }

  for (const rawLine of rawLines) {
    let [name, shares, price, date, code] = rawLine.trimEnd().split(',')
    if (name && code) { // initial stock no storePrevious but MUST assign name/code
      if (tradesOfaStock.length > 0) storePrevious()
      stockCode = code, symbolName[code] = name // only assign this AFTER storePrevious()
    }
    if (new Date(date) < new Date(prevDate)) {
      return `Error: ${stockCode} prev:${prevDate} current:${date} `
    }
    shares = Number(shares)
    price = Number(price)
    const tradeCost = shares ? shares * price : price
    const totalCost = prevTotalCost + tradeCost
    const holdings = prevHoldings + shares
    const avgPrice = holdings ? totalCost / holdings : 0
    prevDate = date
    prevHoldings = holdings
    prevTotalCost = totalCost
    tradesOfaStock.push({ date, shares, price, tradeCost, holdings, avgPrice, totalCost })
    if (rawLine === rawLines.at(-1)) storePrevious() // store when final iteration
  }

  localStorage.setItem("names", JSON.stringify(symbolName))
  localStorage.setItem("trades", JSON.stringify(trades))
  localStorage.setItem("portfolio", JSON.stringify(portfolio))
  return "trades processed"
}

