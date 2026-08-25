/** App constants */

export const APP_NAME = 'Ledgr'

export const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

// 14 Expense categories + 5 Income categories (exact spec)
export const CATEGORY_ICONS = {
  // Expense (14)
  'Food': '🍽️',
  'Rent': '🏠',
  'Loan/EMI': '🏦',
  'Bills': '💡',
  'Transport': '🚗',
  'Shopping': '🛍️',
  'Health': '💊',
  'Travel': '✈️',
  'Family & Gifts': '🎁',
  'Education': '📚',
  'Personal': '💇',
  'Entertainment': '🎬',
  'Savings & Investment': '📈',
  'Other': '📦',
  // Income (5)
  'Salary': '💰',
  'Interest': '🏦',
  'Trading/Investment Income': '📊',
  'Bonus': '🎉',
}

export const DEFAULT_CATEGORY_COLORS = {
  // Expense (14)
  'Food': '#ef4444',
  'Rent': '#6366f1',
  'Loan/EMI': '#78716c',
  'Bills': '#f59e0b',
  'Transport': '#eab308',
  'Shopping': '#ec4899',
  'Health': '#14b8a6',
  'Travel': '#06b6d4',
  'Family & Gifts': '#fb923c',
  'Education': '#0ea5e9',
  'Personal': '#f472b6',
  'Entertainment': '#a855f7',
  'Savings & Investment': '#22c55e',
  'Other': '#9ca3af',
  // Income (5)
  'Salary': '#10b981',
  'Interest': '#3b82f6',
  'Trading/Investment Income': '#8b5cf6',
  'Bonus': '#f59e0b',
}

export const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome to Ledgr' },
  { id: 'accounts', title: 'Your Accounts' },
  { id: 'done', title: 'All Set' },
]

export const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'Home' },
  { path: '/transactions', label: 'Transactions', icon: 'ArrowUpDown' },
  { path: '/insights', label: 'Insights', icon: 'BarChart3' },
  { path: '/planning', label: 'Planning', icon: 'Target' },
  { path: '/settings', label: 'Settings', icon: 'Settings' },
]
