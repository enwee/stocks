import { getEl, newEl, sortByDate, numComma } from "./common.js";
import { getTradeDivSync, getDivs, getQuotes, getUnquoted } from "./storage.js";

const divSyncState = getTradeDivSync()
if (!divSyncState) {
  getEl("pageHeader").append("(not in sync)")
} else {
  const annual = {}
  const quotes = await getQuotes()
  const unquoted = getUnquoted()
  for (const [counter, divsByYear] of Object.entries(getDivs())) {
    for (const [year, { divs, total }] of Object.entries(divsByYear)) {
      if (year === "total") continue // exit this iteration only
      if (!(year in annual)) annual[year] = { divs: [], total: 0 }
      for (const div of divs) {
        annual[year].divs.push({
          date: div.payDate,
          name: quotes[counter]?.name || unquoted[counter],
          amt: div.amt,
        })
      };
      annual[year].total += total
    }
  }

  for (const [year, { divs, total }] of Object.entries(annual).reverse()) {
    divs.sort(sortByDate(() => "date"))
    getEl("rootDiv").append(newEl("pre", {}, `\n${year}: $${numComma(total, 2)}`))
    getEl("rootDiv").append(newEl("pre", {}, ...divs.map(div => JSON.stringify(div) + "\n")))
  }

}


