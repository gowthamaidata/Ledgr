import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, PlusCircle, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatINR, formatDate, getMonthRange } from '../lib/money'
import { CATEGORY_ICONS, PAYMENT_METHODS } from '../lib/constants'
import { Card } from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const PAGE_SIZE = 20

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

const paymentLabel = (method) => {
  const found = PAYMENT_METHODS.find(p => p.value === method)
  return found ? found.label : method || ''
}

function groupByDate(transactions) {
  const groups = {}
  for (const tx of transactions) {
    const date = tx.transaction_date
    if (!groups[date]) groups[date] = []
    groups[date].push(tx)
  }
  return Object.entries(groups).map(([date, items]) => ({ date, items }))
}

function formatDateHeader(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today - d) / 86400000)

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const dayNum = d.getDate()
  const monthAbbr = monthNames[d.getMonth()]

  if (diff === 0) return `TODAY · ${monthAbbr} ${dayNum}`
  if (diff === 1) return `YESTERDAY · ${monthAbbr} ${dayNum}`

  const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  if (diff < 7) return `${weekdays[d.getDay()]} · ${monthAbbr} ${dayNum}`

  return `${monthAbbr} ${dayNum}, ${d.getFullYear()}`
}

export default function Transactions({ onEditTransaction, refreshKey }) {
  const { user } = useAuth()
  const toast = useToast()

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [totalSum, setTotalSum] = useState(0)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [monthOffset, setMonthOffset] = useState(0)
  const [showFilters, setShowFilters] = useState(true)
  const [localRefresh, setLocalRefresh] = useState(0)

  const monthRange = getMonthRange(monthOffset)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0)
    setTransactions([])
  }, [searchDebounced, typeFilter, monthOffset])

  // Reset when refreshKey or localRefresh changes (after QuickAdd saves or delete)
  useEffect(() => {
    setOffset(0)
    setTransactions([])
  }, [refreshKey, localRefresh])

  const fetchTransactions = useCallback(async (currentOffset, append = false) => {
    if (!user) return
    let mounted = true

    try {
      if (!append) setLoading(true)
      else setLoadingMore(true)

      let query = supabase
        .from('transactions')
        .select('*, categories(name, icon, color)', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('transaction_date', monthRange.start)
        .lte('transaction_date', monthRange.end)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (searchDebounced.trim()) {
        query = query.or(`party.ilike.%${searchDebounced}%,notes.ilike.%${searchDebounced}%`)
      }

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter)
      }

      const { data, error, count } = await query

      if (!mounted) return
      if (error) throw error

      const items = data || []
      if (append) {
        setTransactions(prev => [...prev, ...items])
      } else {
        setTransactions(items)
      }

      setTotalCount(count || 0)
      setHasMore(currentOffset + PAGE_SIZE < (count || 0))

      // Compute sum for the current filter set
      if (!append) {
        let sumQuery = supabase
          .from('transactions')
          .select('amount, type')
          .eq('user_id', user.id)
          .gte('transaction_date', monthRange.start)
          .lte('transaction_date', monthRange.end)

        if (searchDebounced.trim()) {
          sumQuery = sumQuery.or(`party.ilike.%${searchDebounced}%,notes.ilike.%${searchDebounced}%`)
        }
        if (typeFilter !== 'all') {
          sumQuery = sumQuery.eq('type', typeFilter)
        }

        const { data: allData } = await sumQuery
        if (mounted && allData) {
          const sum = allData.reduce((acc, t) => {
            return acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount))
          }, 0)
          setTotalSum(sum)
        }
      }
    } catch (err) {
      if (mounted) toast.error('Failed to load transactions')
      console.error(err)
    } finally {
      if (mounted) {
        setLoading(false)
        setLoadingMore(false)
      }
    }

    return () => { mounted = false }
  }, [user, searchDebounced, typeFilter, monthRange.start, monthRange.end, toast, localRefresh, refreshKey])

  useEffect(() => {
    fetchTransactions(offset, offset > 0)
  }, [offset, fetchTransactions])

  const handleLoadMore = () => {
    const next = offset + PAGE_SIZE
    setOffset(next)
  }

  const handleDelete = async (tx) => {
    const confirmed = await toast.confirm(
      `Delete this ${tx.type} of ${formatINR(tx.amount)}?`,
      { danger: true }
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', tx.id)
      .eq('user_id', user.id)

    if (error) {
      toast.error('Failed to delete transaction')
      console.error('Delete error:', error)
    } else {
      toast.success('Transaction deleted')
      // Bump localRefresh to trigger re-fetch via useEffect
      setLocalRefresh(prev => prev + 1)
    }
  }

  const groups = groupByDate(transactions)

  return (
    <div style={{ padding: '20px 16px 32px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <h1 style={{
          fontSize: '26px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: '-0.3px',
        }}>
          Transactions
        </h1>
        <button
          onClick={() => setShowFilters(prev => !prev)}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '10px',
            border: 'none',
            backgroundColor: 'var(--navy, #0F1729)',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.2px',
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          Filter
        </button>
      </div>

      {/* Search bar */}
      <div style={{
        position: 'relative',
        marginBottom: '14px',
      }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Search party or notes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px 12px 42px',
            fontSize: '14px',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: 'var(--surface-muted, #F3F4F6)',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Filter pills row */}
      {showFilters && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          {TYPE_FILTERS.map(f => {
            const isActive = typeFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                style={{
                  padding: '7px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '999px',
                  border: isActive ? 'none' : '1.5px solid var(--border)',
                  backgroundColor: isActive ? 'var(--navy, #0F1729)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                  letterSpacing: '0.1px',
                }}
              >
                {f.label}
              </button>
            )
          })}

          {/* This Month pill / month picker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            marginLeft: 'auto',
          }}>
            <button
              onClick={() => setMonthOffset(prev => prev - 1)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: monthOffset === 0 ? 'var(--navy, #0F1729)' : 'var(--text-secondary)',
              padding: '7px 8px',
              borderRadius: '999px',
              backgroundColor: monthOffset === 0 ? 'rgba(15, 23, 41, 0.08)' : 'transparent',
              whiteSpace: 'nowrap',
              letterSpacing: '0.1px',
            }}>
              {monthOffset === 0 ? 'This Month' : monthRange.label}
            </span>
            <button
              onClick={() => setMonthOffset(prev => prev + 1)}
              disabled={monthOffset >= 0}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: monthOffset >= 0 ? 'not-allowed' : 'pointer',
                color: 'var(--text-muted)',
                opacity: monthOffset >= 0 ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {!loading && totalCount > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          backgroundColor: 'var(--surface)',
          borderRadius: '14px',
          marginBottom: '20px',
          border: '1px solid var(--border)',
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-muted)',
          }}>
            {totalCount} transaction{totalCount !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontSize: '15px',
            fontWeight: 700,
            color: totalSum >= 0 ? 'var(--income)' : 'var(--expense)',
            letterSpacing: '-0.2px',
          }}>
            {totalSum >= 0 ? '+' : ''}{formatINR(Math.abs(totalSum))}
            {totalSum < 0 && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px', marginLeft: '4px' }}>
                net
              </span>
            )}
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width="44px" height="44px" style={{ borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height="14px" style={{ marginBottom: '6px' }} />
                  <Skeleton width="40%" height="12px" />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Skeleton width="70px" height="14px" style={{ marginBottom: '6px' }} />
                  <Skeleton width="40px" height="12px" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && transactions.length === 0 && (
        <EmptyState
          icon={PlusCircle}
          title="Add your first transaction"
          description="Start tracking your expenses and income to see them here."
          actionLabel={onEditTransaction ? 'Add Transaction' : undefined}
          onAction={onEditTransaction ? () => onEditTransaction(null) : undefined}
        />
      )}

      {/* Transaction list grouped by date */}
      {!loading && groups.map(group => (
        <div key={group.date} style={{ marginBottom: '24px' }}>
          {/* Date header */}
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            padding: '0 4px 10px',
          }}>
            {formatDateHeader(group.date)}
          </div>

          {/* Grouped card */}
          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            {group.items.map((tx, idx) => {
              const categoryName = tx.categories?.name || 'Other'
              const emoji = CATEGORY_ICONS[categoryName] || '📦'
              const isExpense = tx.type === 'expense'
              const isIncome = tx.type === 'income'

              return (
                <div
                  key={tx.id}
                  onClick={() => onEditTransaction && onEditTransaction(tx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    cursor: onEditTransaction ? 'pointer' : 'default',
                    borderBottom: idx < group.items.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background-color 0.1s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-muted, rgba(0,0,0,0.02))' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {/* Emoji icon circle */}
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--surface-muted, #F3F4F6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0,
                  }}>
                    {emoji}
                  </div>

                  {/* Middle: merchant/party + category */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      letterSpacing: '-0.1px',
                    }}>
                      {tx.party || categoryName}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginTop: '3px',
                      fontWeight: 500,
                    }}>
                      {categoryName}
                    </div>
                  </div>

                  {/* Right: amount + payment method badge */}
                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: isIncome ? 'var(--income)' : isExpense ? 'var(--expense)' : 'var(--text-primary)',
                      letterSpacing: '-0.2px',
                    }}>
                      {isIncome ? '+' : isExpense ? '-' : ''}{formatINR(tx.amount)}
                    </div>
                    {tx.payment_method && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--surface-muted, #F3F4F6)',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}>
                        {paymentLabel(tx.payment_method)}
                      </span>
                    )}
                  </div>

                  {/* Delete button (shows on hover via parent) */}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(tx) }}
                    className="tx-delete-btn"
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '6px',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: 'var(--expense)',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                      borderRadius: '6px',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}
                    aria-label="Delete transaction"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Load more */}
      {!loading && hasMore && (
        <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '24px' }}>
          <Button
            variant="secondary"
            size="sm"
            loading={loadingMore}
            onClick={handleLoadMore}
            style={{
              borderRadius: '12px',
              padding: '10px 28px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
