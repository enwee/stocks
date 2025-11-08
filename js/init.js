const reader = new FileReader()

const xData = () => ({
  key: '',
  value: '',
  page: 'index',
  msg: "",
  async getFile() {
    // Open file picker and destructure the result of first handle
    const [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    reader.readAsText(file)
    reader.onload = () => handleFile(file, this.setMsg.bind(this)) // else this in setMsg goes to window object
  },
  save() {
    localStorage.setItem(this.key.trim(), this.value)
    if (this.key === "trades") handleTrades(JSON.parse(this.value))
    setTimeout((key) => this.key = key, 1000, this.key)
    this.key = '', this.value = ''
  },
  setMsg(msg, clear = true) {
    this.msg = msg
    if (clear && !msg.startsWith("Error")) setTimeout(() => this.msg = "", 4000)
  }
})

const handleFile = (file, setMsg) => {
  setMsg(`processing [${file.name}] ...`, false)
  switch (file.type) {
    case "application/json":
      setMsg(handleJSON(reader.result))
      break
    case "text/csv":
      setMsg(handleCSV(reader.result))
      break
    default:
      setMsg("Not JSON/CSV, logged to console")
      console.log(reader.result)
  }
}

const handleJSON = rawStr => {
  let msg = ""
  const data = JSON.parse(rawStr)
  for (const key in data) {
    switch (key) {
      case "trades":
        msg = handleTrades(data[key])
        break
      default:
        localStorage.setItem(key, JSON.stringify(data[key]))
    }
  }
  msg = msg || `[${Object.keys(data)}] stored`
  return msg
}

const handleCSV = rawStr => {
  let msg = ""
  const rawLines = rawStr.trimEnd().split("\n")
  const header = rawLines.shift().trimEnd().split(",")
  switch (JSON.stringify(header)) {
    // prev when trades stored in csv
    case JSON.stringify(["name", "shares", "price", "date", "symbol"]):
      // msg = handleTrades(rawLines)
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
      msg = "Not known CSV type, rows logged to console"
      console.log(rows)
    }
  }
  return msg
}

const handleTrades = trades => {
  let msg = ""
  for (const [symbol, csvTrades] of Object.entries(trades)) {
    const { rows } = csvsToObject(csvTrades)
    let prevDate = "1-Jan-2000", prevHoldings = 0, prevTotalCost = 0
    trades[symbol] = rows.map(({ tradeDate, shares, price }) => {
      if (new Date(tradeDate) < new Date(prevDate)) {
        msg = `Error: ${symbol} prev:${prevDate} current:${tradeDate}`
        return {}
      }
      const tradeCost = shares ? shares * price : price
      const totalCost = prevTotalCost + tradeCost
      const holdings = prevHoldings + shares
      const avgPrice = holdings ? totalCost / holdings : 0
      prevDate = tradeDate
      prevHoldings = holdings
      prevTotalCost = totalCost
      return { tradeDate, shares, price, tradeCost, holdings, avgPrice, totalCost }
    })
  }
  localStorage.setItem("trades", JSON.stringify(trades))
  return msg
}

const csvsToObject = csvs => {
  const header = csvs.shift().split(",")
  const meta = header.pop()
  const rows = csvs.map(csv => {
    const obj = {}
    for (const [index, data] of csv.split(",").entries()) {
      obj[header[index]] = header[index].endsWith("Date") ? data : Number(data)
    }
    return obj
  })
  return { meta, rows }
}
