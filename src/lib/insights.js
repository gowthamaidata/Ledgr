/** Smart insights — computed from real data, surfaced when meaningful */

export function findLikelyDuplicate(newTx, recentTxs, windowMinutes = 5) {
  if (!recentTxs?.length) return null
  const newTime = new Date(newTx.created_at).getTime()

  return recentTxs.find(tx => {
    if (tx.id === newTx.id) return false
    const timeDiff = Math.abs(newTime - new Date(tx.created_at).getTime())
    return (
      timeDiff < windowMinutes * 60 * 1000 &&
      Number(tx.amount) === Number(newTx.amount) &&
      tx.party === newTx.party &&
      tx.type === newTx.type
    )
  })
}

export function isAmountUnusual(amount, historicalAmounts) {
  if (!historicalAmounts?.length || historicalAmounts.length < 5) return false
  const sorted = [...historicalAmounts].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  if (median === 0) return false
  return Math.abs(amount) > median * 3
}

export function dailySummaryText(spent, avg, count) {
  if (count === 0) return 'No expenses today yet'
  const spentNum = Number(spent)
  const avgNum = Number(avg)

  if (avgNum === 0) return `${count} expense${count > 1 ? 's' : ''} today`

  const ratio = spentNum / avgNum
  if (ratio < 0.5) return 'Well below your daily average'
  if (ratio < 0.85) return 'Below your daily average'
  if (ratio <= 1.15) return 'About average for the day'
  if (ratio <= 1.5) return 'Slightly above your daily average'
  if (ratio <= 2) return 'Above your daily average'
  return 'Significantly above your daily average'
}

export function getTopCategories(transactions, limit = 5) {
  const map = {}
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    const cat = tx.category_name || 'Uncategorized'
    map[cat] = (map[cat] || 0) + Number(tx.amount)
  }
  return Object.entries(map)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function getSpendingTrend(dailyTotals) {
  if (!dailyTotals?.length || dailyTotals.length < 7) return null
  const recent = dailyTotals.slice(-7)
  const prev = dailyTotals.slice(-14, -7)
  if (!prev.length) return null

  const recentAvg = recent.reduce((s, d) => s + d, 0) / recent.length
  const prevAvg = prev.reduce((s, d) => s + d, 0) / prev.length

  if (prevAvg === 0) return null
  const change = ((recentAvg - prevAvg) / prevAvg) * 100
  return { change: Math.round(change), direction: change > 0 ? 'up' : 'down' }
}
