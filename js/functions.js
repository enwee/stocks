import { sortByDate } from "./common.js";

export const yearTotal = (yy, allCountersDividends) => {
    const totalsArray = []
    let total = 0
    for (const [k, v] of Object.entries(allCountersDividends)) {
        v.forEach(i => {
            if (i.payDate.endsWith(yy)) { // yy string; e.g. 2022 -> "22"
                total += i.amt
                totalsArray.push({
                    c: k,
                    p: i.payDate,
                    r: i.rate,
                    a: i.amt
                })

            }
        });
    }

    totalsArray.sort(sortByDate(() => "p"))
    // console.log(totalsArray)
    return Number(total.toFixed(4))
}
