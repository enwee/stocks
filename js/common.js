export const PATHMOD = location.host === "enwee.github.io" ? "/stocks" : ""

export const classes = {
  header: "pb-2 px-2 text-gray-400 whitespace-nowrap ",
  border: "border border-gray-400 ",
  padding: "py-1 px-2 ",
  text: "text-lg text-gray-400 text-right ",
  base: function () { return this.border + this.padding + this.text },
  altBG: bool => bool ? "bg-slate-900 " : "bg-stone-900 ",
  green: "!text-emerald-500 ",
  red: "!text-rose-700 ",
}

export const fxLabelHTML = (str = "USD") => `<span class='relative'><div class='text-[8px] absolute -top-1 -right-3.5'>${str}</div></span>`
export const gainLossHTML = num => `<span class="${num > 0 ? classes.green : classes.red}">${num > 0 ? "+" : ""}${numComma(num)}</span>`
export const stringToElement = htmlString => {
  const container = document.createElement('div');
  container.innerHTML = htmlString;
  return container.firstChild;
}

// for storing; fix comma-ed string number, limit to 4 decimals
export const fixNum = num => {
  if (typeof (num) === "string") num = Number(num.replace(",", ""))
  return Number(num.toFixed(4))
}

// for display; comma-ed with default no decimals
export const numComma = (num, decimals = 0) => num.toLocaleString("en-SG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

export const sortByDate = dateKeyFn => (a, b) => {
  const aDate = new Date(a[dateKeyFn(a)])
  const bDate = new Date(b[dateKeyFn(b)])
  if (aDate < bDate) {
    return -1
  } else if (aDate > bDate) {
    return 1
  }
  return 0
}

export const getEl = id => document.getElementById(id)
export const changeText = (id, text) => getEl(id).textContent = text

export const newEl = (tag, attributes, ...content) => {
  const el = document.createElement(tag)
  const { id, css, span } = attributes
  if (id) el.id = id
  if (css) el.classList = css
  if (span) el.colSpan = span
  if (content[0] !== undefined) el.append(...content)
  return el
}

const tRows = (rows, type = "body") => {
  const colKeys = Object.keys(rows[0])
  rows = rows.map(row => {
    const tds = colKeys.map(key => {
      const { css, span, text, append } = row[key]
      const td = newEl(type === "head" ? "th" : "td", { css, span }, text)
      if (append) td.insertAdjacentHTML("beforeend", append)
      return td
    })
    return newEl("tr", {}, ...tds)
  })
  return newEl("t" + type, {}, ...rows) // <thead>, <tbody>, <tfoot>
}

export const tHead = cols => {
  return tRows([cols], "head")
}

export const tBody = rows => {
  return tRows(rows)
}

export const tFoot = cols => {
  return tRows([cols], "foot")
}
