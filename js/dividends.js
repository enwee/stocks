import { sortByDate, numComma, classes } from "./common.js";
import { getTradeDivInSync, getDivs, getQuotesPromise, getNames } from "./storage.js";
import { getEl, newEl, tHeadEl, tBodyEl, tFootEl, detailsEl } from "./htmlEls.js";

const divSyncState = getTradeDivInSync()
if (!divSyncState) {
  getEl("pageHeader").append("(not in sync)")
} else {
  const annual = {}
  const quotes = await getQuotesPromise()
  const names = getNames()
  for (const [symbol, divsByYear] of Object.entries(getDivs())) {
    for (const [year, { divs, total }] of Object.entries(divsByYear)) {
      if (year === "total") continue // exit this iteration only
      if (!(year in annual)) annual[year] = { divs: [], total: 0 }
      for (const div of divs) {
        annual[year].divs.push({
          date: div.payDate,
          name: quotes[symbol]?.name || names[symbol],
          amt: div.amt,
          symbol
        })
      };
      annual[year].total += total
    }
  }

  const divsTableConfig = {
    css: {
      head: classes.header,
      rows: classes.base("smaller"),
      indexed: i => classes.altBG(i % 2),
      foot: classes.text + classes.padding
    },
    cols: {
      date: { label: "Date", format: i => i },
      name: { label: "Stock Name", format: i => i, css: () => "!text-left " }, // TOREVIEW <div text-left>
      amt: { label: "Amount", format: num => numComma(num, 2) }
    },
    foot: {
      1: {},
      2: { text: "Total:" },
      3: { format: num => numComma(num, 2) }
    }
  }

  for (const [year, { divs, total }] of Object.entries(annual).reverse()) {
    divs.sort(sortByDate(() => "date")).reverse()
    const thead = tHeadEl(divsTableConfig)
    const tbody = tBodyEl(divsTableConfig, divs)
    const tfoot = tFootEl(divsTableConfig, { 3: total })
    const table = newEl("table", {}, thead, tbody, tfoot)
    const details = detailsEl(table, "annual", false, // table, group name, open
      `${year} Dividends - $${numComma(total)} ($${numComma(total / 12)}/mth)`)
    getEl("rootDiv").append(details)
  }

}
