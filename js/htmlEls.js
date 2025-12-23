import { classes, numComma } from "./common.js"

const htmlToElement = htmlString => {
  const container = document.createElement('div');
  container.innerHTML = htmlString;
  return container.firstChild;
}

export const fxLabelHTML = (config = { asEl: false }) => {
  const { curr = "USD", inline = true, asEl } = config
  const html = inline ? `<sup class="align-super text-[8px]">${curr}</sup>` :
    `<span class='relative'><div class='text-[8px] absolute -top-1 -right-3.5'>${curr}</div></span>`
  return asEl ? htmlToElement(html) : html
}

// with !important css, do i still need this gainLoss <span> ?
export const gainLossHTML = (num, asEl = false) => {
  const html = `<span class="${num > 0 ? classes.green : classes.red}">${num > 0 ? "+" : ""}${numComma(num)}</span>`
  return asEl ? htmlToElement(html) : html
}

export const getEl = id => document.getElementById(id)
export const changeText = (id, text) => getEl(id).textContent = text

export const newEl = (tag, attributes, ...content) => {
  const el = document.createElement(tag)
  const { id, css, span, open, name } = attributes
  if (id) el.id = id
  if (css) el.classList = css
  if (span) el.colSpan = span
  if (open) el.open = open
  if (name) el.name = name
  if (content[0] !== undefined) el.append(...content)
  return el
}

const tRowsEl = (rows, type = "body") => {
  const colKeys = Object.keys(rows[0])
  rows = rows.map(row => {
    const tds = colKeys.map(key => {
      const { css, span, text, html } = row[key]
      // TOREVIEW fxLabelHTML({asEl:true}) -> ...[text, html(asEl)]
      const td = newEl(type === "head" ? "th" : "td", { css, span }, text)
      // TOREVIEW no need insertAdjacentHTML
      if (html) td.insertAdjacentHTML("beforeend", html)
      return td
    })
    return newEl("tr", {}, ...tds)
  })
  return newEl("t" + type, {}, ...rows) // <thead>, <tbody>, <tfoot>
}

export const tHeadEl = ({ css, cols, fxLabel }) => {

  const headData = {}
  for (const key of Object.keys(cols)) {
    headData[key] = {
      css: css.head,
      text: cols[key].label,
      html: cols[key].fxLabel && fxLabel?.required && fxLabelHTML({ inline: false, curr: fxLabel?.label })
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

export const detailsEl = (table, name, open, ...summaryNodes) => {
  const summary = newEl("summary", { css: classes.summaryDetail }, ...summaryNodes)
  return newEl("details", { css: "py-1 w-max", name, open }, summary, table)
}