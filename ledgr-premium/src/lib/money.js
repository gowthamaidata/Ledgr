/** Currency formatting — INR with lakh system as default */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const inrFormatterDecimals = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatINR(amount, { decimals = false, sign = false } = {}) {
  if (amount == null || isNaN(amount)) return '₹0'
  const num = Number(amount)
  const formatted = decimals ? inrFormatterDecimals.format(Math.abs(num)) : inrFormatter.format(Math.abs(num))
  if (sign && num > 0) return '+' + formatted
  if (num < 0) return '-' + formatted
  return formatted
}

export function formatCompact(amount) {
  if (amount == null || isNaN(amount)) return '₹0'
  const num = Math.abs(Number(amount))
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr'
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1).replace(/\.0$/, '') + 'L'
  if (num >= 1000) return '₹' + (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return '₹' + num
}

export function parseAmount(str) {
  if (!str) return 0
  const cleaned = String(str).replace(/[₹,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.round(num * 100) / 100
}

/** Date helpers */
export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function formatDate(dateStr, style = 'medium') {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today - d) / 86400000)

  if (style === 'relative') {
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' })
  }

  if (style === 'short') {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatMonth(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function getMonthRange(offset = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  }
}

/** Budget helpers */
export function burnPercent(spent, budget) {
  if (!budget || budget <= 0) return 0
  return Math.min(Math.round((spent / budget) * 100), 100)
}

export function burnColor(percent) {
  if (percent >= 90) return 'var(--expense)'
  if (percent >= 70) return 'var(--warning)'
  return 'var(--income)'
}
