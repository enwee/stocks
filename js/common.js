export const PATHMOD = location.hostname === "enwee.github.io" ? "/stocks" : ""

export const classes = {
  header: "pb-2 px-2 text-gray-400 whitespace-nowrap ",
  border: "border border-gray-400 ",
  padding: "py-1 px-2 ",
  text: "text-gray-400 text-right ",
  base: function () { return this.border + this.padding + this.text },
  altBG: bool => bool ? "bg-slate-900 " : "bg-stone-900 ",
  summaryDetail: "py-1 text-violet-400 ",
  green: "!text-emerald-500 ",
  red: "!text-rose-700 "
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

// add/use name shortening function from stocks.js