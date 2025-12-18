export const PATHMOD = location.host === "enwee.github.io" ? "/stocks" : ""

export const classes = {
  header: "pb-2 px-2 text-gray-400 whitespace-nowrap ",
  border: "border border-gray-400 ",
  padding: "py-1 px-2 ",
  text: "text-lg text-gray-400 text-right ",
  base: function () { return this.border + this.padding + this.text },
  altBG: bool => bool ? "bg-slate-900 " : "bg-stone-900 ",
  green: "!text-emerald-500 ",
  red: "!text-rose-700 "
}

export const fxLabelHTML = (config = {}) => {
  const { curr = "USD", inline = true } = config
  return inline ? `<sup class="align-super text-[8px]">${curr}</sup>` :
    `<span class='relative'><div class='text-[8px] absolute -top-1 -right-3.5'>${curr}</div></span>`
}

export const gainLossHTML = num => `<span class="${num > 0 ? classes.green : classes.red}">${num > 0 ? "+" : ""}${numComma(num)}</span>`
export const htmlToElement = htmlString => {
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

const tRowsEl = (rows, type = "body") => {
  const colKeys = Object.keys(rows[0])
  rows = rows.map(row => {
    const tds = colKeys.map(key => {
      const { css, span, text, html } = row[key]
      const td = newEl(type === "head" ? "th" : "td", { css, span }, text)
      if (html) td.insertAdjacentHTML("beforeend", html)
      return td
    })
    return newEl("tr", {}, ...tds)
  })
  return newEl("t" + type, {}, ...rows) // <thead>, <tbody>, <tfoot>
}

export const tHeadEl = ({ css, cols, fxLabel: { required, label } }) => {
  const headData = {}
  for (const key of Object.keys(cols)) {
    headData[key] = {
      css: css.head,
      text: cols[key].label,
      html: cols[key].fxLabel && required && fxLabelHTML({ inline: false, curr: label })
    }
  }
  return tRowsEl([headData], "head")
}

export const tBodyEl = ({ css, cols }, tableRows) => {
  const bodyData = tableRows.map((row, index) => {
    const data = {}
    for (const [key, { format, css: colCss }] of Object.entries(cols)) {
      const addnCss = colCss ? colCss(row[key]) : ""
      data[key] = {
        text: format(row[key]),
        css: css.rows + css.indexed(index) + addnCss
      }
    }
    return data
  })
  return tRowsEl(bodyData)
}

export const tFootEl = ({ css, foot }, data) => {
  const footData = {}
  for (const [key, { span, text, format }] of Object.entries(foot)) {
    const td = { css: css.foot }
    if (span) td.span = span
    if (text) td.text = text
    if (format) td.text = format(data[key])
    footData[key] = td
  }
  return tRowsEl([footData], "foot")
}
