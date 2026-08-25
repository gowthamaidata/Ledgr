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

export const CATEGORY_ICONS = {
  'Food & Dining': '🍽️',
  'Groceries': '🛒',
  'Transport': '🚗',
  'Auto & Fuel': '⛽',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Health & Fitness': '💊',
  'Bills & Utilities': '💡',
  'Rent': '🏠',
  'Education': '📚',
  'Personal Care': '💇',
  'Clothing': '👔',
  'Travel': '✈️',
  'Gifts & Donations': '🎁',
  'Investments': '📈',
  'Insurance': '🛡️',
  'EMI & Loans': '🏦',
  'Subscriptions': '📱',
  'Home & Maintenance': '🔧',
  'Kids & Family': '👨‍👩‍👧',
  'Pets': '🐾',
  'Taxes': '📋',
  'Salary': '💰',
  'Freelance': '💻',
  'Other': '📦',
}

export const DEFAULT_CATEGORY_COLORS = {
  'Food & Dining': '#ef4444',
  'Groceries': '#f97316',
  'Transport': '#eab308',
  'Auto & Fuel': '#84cc16',
  'Shopping': '#ec4899',
  'Entertainment': '#a855f7',
  'Health & Fitness': '#14b8a6',
  'Bills & Utilities': '#f59e0b',
  'Rent': '#6366f1',
  'Education': '#0ea5e9',
  'Personal Care': '#f472b6',
  'Clothing': '#e879f9',
  'Travel': '#06b6d4',
  'Gifts & Donations': '#fb923c',
  'Investments': '#22c55e',
  'Insurance': '#64748b',
  'EMI & Loans': '#78716c',
  'Subscriptions': '#8b5cf6',
  'Home & Maintenance': '#a3a3a3',
  'Kids & Family': '#fbbf24',
  'Pets': '#d97706',
  'Taxes': '#94a3b8',
  'Salary': '#10b981',
  'Freelance': '#3b82f6',
  'Other': '#9ca3af',
}

export const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome to Ledgr' },
  { id: 'currency', title: 'Currency' },
  { id: 'accounts', title: 'Your Accounts' },
  { id: 'categories', title: 'Categories' },
  { id: 'done', title: 'All Set' },
]

export const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: 'Home' },
  { path: '/transactions', label: 'Transactions', icon: 'ArrowUpDown' },
  { path: '/insights', label: 'Insights', icon: 'BarChart3' },
  { path: '/planning', label: 'Planning', icon: 'Target' },
  { path: '/settings', label: 'Settings', icon: 'Settings' },
]
