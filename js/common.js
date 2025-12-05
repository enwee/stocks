export const css = {
  header: "pb-2 px-2 text-gray-400 whitespace-nowrap ",
  border: "border border-gray-400 ",
  padding: "py-1 px-2 ",
  text: "text-lg text-gray-400 text-right ",
  base: function () { return this.border + this.padding + this.text },
  altBG: bool => bool ? "bg-slate-900" : "bg-stone-900"
}

// storing; fix comma-ed string number, limit to 4 decimals
export const fixNum = num => {
  if (typeof (num) === "string") num = Number(num.replace(",", ""))
  return Number(num.toFixed(4))
}

// displaying; comma-ed with no decimals, limit to 3 decimals
export const numComma = num => Math.floor(num).toLocaleString()
export const numFixed = num => num.toFixed(3)

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
  const { id, css } = attributes
  if (id) el.id = id
  if (css) el.classList = css
  el.append(...content)
  return el
}

export const tBody = (rows, isHead) => {
  const colKeys = Object.keys(rows[0])
  rows = rows.map(row => {
    const tds = colKeys.map(key => {
      const { css, text, append } = row[key]
      const td = newEl(isHead ? "th" : "td", { css: css }, text)
      if (append) td.insertAdjacentHTML("beforeend", append)
      return td
    })
    return newEl("tr", {}, ...tds)
  })
  return newEl(isHead ? "thead" : "tbody", {}, ...rows)
}

export const tHead = cols => {
  return tBody([cols], true)
}
