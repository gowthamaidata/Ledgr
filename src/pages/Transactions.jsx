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

export default function Transactions({ onEditTransaction }) {
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
  }, [user, searchDebounced, typeFilter, monthRange.start, monthRange.end, toast])

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
    } else {
      toast.success('Transaction deleted')
      setOffset(0)
      setTransactions([])
    }
  }

  const groups = groupByDate(transactions)

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <h1 style={{
        fontSize: '24px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        margin: '0 0 20px',
      }}>
        Transactions
      </h1>

      {/* Search bar */}
      <div style={{
        position: 'relative',
        marginBottom: '12px',
      }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '12px',
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
            padding: '10px 12px 10px 40px',
            fontSize: '14px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Type pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              style={{
                padding: '5px 14px',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '999px',
                border: '1px solid',
                borderColor: typeFilter === f.value ? 'var(--accent)' : 'var(--border)',
                backgroundColor: typeFilter === f.value ? 'var(--accent-light)' : 'var(--surface)',
                color: typeFilter === f.value ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Month picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setMonthOffset(prev => prev - 1)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            minWidth: '120px',
            textAlign: 'center',
          }}>
            {monthRange.label}
          </span>
          <button
            onClick={() => setMonthOffset(prev => prev + 1)}
            disabled={monthOffset >= 0}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px',
              cursor: monthOffset >= 0 ? 'not-allowed' : 'pointer',
              color: 'var(--text-secondary)',
              opacity: monthOffset >= 0 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && totalCount > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          backgroundColor: 'var(--surface-muted)',
          borderRadius: 'var(--radius)',
          marginBottom: '16px',
          fontSize: '13px',
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {totalCount} transaction{totalCount !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontWeight: 600,
            color: totalSum >= 0 ? 'var(--income)' : 'var(--expense)',
          }}>
            {totalSum >= 0 ? '+' : ''}{formatINR(Math.abs(totalSum))}
            {totalSum < 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> net</span>}
          </span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width="40px" height="40px" style={{ borderRadius: '50%', flexShrink: 0 }} />
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
        <div key={group.date} style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '0 4px 8px',
          }}>
            {formatDate(group.date, 'relative')}
          </div>

          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
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
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-muted)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {/* Category emoji circle */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--surface-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}>
                    {emoji}
                  </div>

                  {/* Middle: party + category */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {tx.party || categoryName}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                    }}>
                      {categoryName}
                    </div>
                  </div>

                  {/* Right: amount + payment method */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isIncome ? 'var(--income)' : isExpense ? 'var(--expense)' : 'var(--text-primary)',
                    }}>
                      {isIncome ? '+' : isExpense ? '-' : ''}{formatINR(tx.amount)}
                    </div>
                    {tx.payment_method && (
                      <Badge
                        variant="default"
                        style={{ fontSize: '11px', padding: '1px 8px', marginTop: '3px' }}
                      >
                        {paymentLabel(tx.payment_method)}
                      </Badge>
                    )}
                  </div>

                  {/* Delete icon on hover */}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(tx) }}
                    className="tx-delete-btn"
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '4px',
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: 'var(--expense)',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                      borderRadius: 'var(--radius-sm)',
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
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
