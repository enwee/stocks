export const get = key => JSON.parse(localStorage.getItem(key))
export const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))
export const deleet = key => key === "ALL" ? localStorage.clear() : localStorage.removeItem(key)

export const fixNum = i => {
    let num = i
    if (typeof (i) === "string") num = Number(i.replace(",", ""))
    return Number(num.toFixed(4))
}

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

export const html = id => document.getElementById(id)
export const changeText = (id, text) => html(id).textContent = text
