import { useState, useEffect } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatINR, todayISO, formatDate } from '../lib/money'
import { dailySummaryText } from '../lib/insights'
import { CATEGORY_ICONS, DEFAULT_CATEGORY_COLORS } from '../lib/constants'
import { Card } from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'

function dateShift(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function DailyReview() {
  const { user } = useAuth()
  const toast = useToast()

  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewed, setReviewed] = useState(false)

  const isToday = selectedDate === todayISO()
  const isFuture = selectedDate > todayISO()

  useEffect(() => {
    setReviewed(false)
    let mounted = true

    async function load() {
      if (!user) return
      setLoading(true)

      try {
        // Fetch transactions for selected date
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*, categories(name, icon, color)')
          .eq('transaction_date', selectedDate)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!mounted) return
        if (txError) throw txError
        setTransactions(txData || [])

        // Fetch today summary via RPC
        try {
          const { data: summaryData } = await supabase.rpc('get_today_summary', {
            p_date: selectedDate,
          })
          if (mounted && summaryData) {
            setSummary(summaryData)
          } else if (mounted) {
            // Fallback: compute from transactions
            const expenses = (txData || []).filter(t => t.type === 'expense')
            const totalSpent = expenses.reduce((s, t) => s + Number(t.amount), 0)
            setSummary({
              total_spent: totalSpent,
              transaction_count: expenses.length,
              daily_average: 0,
            })
          }
        } catch {
          // RPC may not exist yet, compute locally
          if (!mounted) return
          const expenses = (txData || []).filter(t => t.type === 'expense')
          const totalSpent = expenses.reduce((s, t) => s + Number(t.amount), 0)
          setSummary({
            total_spent: totalSpent,
            transaction_count: expenses.length,
            daily_average: 0,
          })
        }
      } catch (err) {
        if (mounted) toast.error('Failed to load daily review')
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [user, selectedDate, toast])

  // Category breakdown for expenses
  const categoryBreakdown = (() => {
    const map = {}
    for (const tx of transactions) {
      if (tx.type !== 'expense') continue
      const name = tx.categories?.name || 'Other'
      if (!map[name]) {
        map[name] = {
          name,
          total: 0,
          color: tx.categories?.color || DEFAULT_CATEGORY_COLORS[name] || '#9ca3af',
          icon: CATEGORY_ICONS[name] || '📦',
        }
      }
      map[name].total += Number(tx.amount)
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  })()

  const totalExpenses = categoryBreakdown.reduce((s, c) => s + c.total, 0)

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px',
      }}>
        <CalendarCheck size={24} style={{ color: 'var(--accent)' }} />
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          Daily Review
        </h1>
      </div>

      {/* Date navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <button
          onClick={() => setSelectedDate(prev => dateShift(prev, -1))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontFamily: 'inherit',
          }}
        >
          <ChevronLeft size={14} />
          Yesterday
        </button>

        <span style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {isToday ? 'Today' : formatDate(selectedDate, 'medium')}
        </span>

        <button
          onClick={() => setSelectedDate(prev => dateShift(prev, 1))}
          disabled={isToday || isFuture}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            cursor: isToday || isFuture ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontFamily: 'inherit',
            opacity: isToday || isFuture ? 0.4 : 1,
          }}
        >
          Tomorrow
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card>
            <Skeleton width="40%" height="14px" style={{ marginBottom: '10px' }} />
            <Skeleton width="60%" height="28px" style={{ marginBottom: '8px' }} />
            <Skeleton width="80%" height="12px" />
          </Card>
          <Card>
            <Skeleton width="30%" height="14px" style={{ marginBottom: '12px' }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <Skeleton width="36px" height="36px" style={{ borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="50%" height="13px" style={{ marginBottom: '4px' }} />
                  <Skeleton width="30%" height="11px" />
                </div>
                <Skeleton width="60px" height="13px" />
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {/* Completion state */}
          {reviewed && (
            <Card style={{
              textAlign: 'center',
              padding: '32px 20px',
              marginBottom: '20px',
              borderColor: 'var(--income)',
              backgroundColor: 'var(--income-light)',
            }}>
              <CheckCircle
                size={40}
                style={{ color: 'var(--income)', marginBottom: '12px' }}
              />
              <h3 style={{
                margin: '0 0 6px',
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                You're all caught up
              </h3>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                {isToday ? "Today's" : formatDate(selectedDate, 'short') + "'s"} expenses have been reviewed.
              </p>
            </Card>
          )}

          {/* Summary card */}
          {summary && (
            <Card style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 500,
              }}>
                Total Spent
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 700,
                color: summary.total_spent > 0 ? 'var(--expense)' : 'var(--text-primary)',
                marginBottom: '6px',
              }}>
                {formatINR(summary.total_spent || 0)}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}>
                <Badge variant="default">
                  {summary.transaction_count || 0} transaction{(summary.transaction_count || 0) !== 1 ? 's' : ''}
                </Badge>
                <span style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}>
                  {dailySummaryText(
                    summary.total_spent || 0,
                    summary.daily_average || 0,
                    summary.transaction_count || 0
                  )}
                </span>
              </div>
            </Card>
          )}

          {/* Transaction list for the day */}
          {transactions.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No transactions"
              description={isToday
                ? "You haven't logged any transactions today."
                : `No transactions on ${formatDate(selectedDate, 'short')}.`
              }
            />
          ) : (
            <Card style={{ marginBottom: '16px', padding: 0 }}>
              <div style={{
                padding: '14px 16px 10px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: '1px solid var(--border)',
              }}>
                Transactions
              </div>
              {transactions.map((tx, idx) => {
                const categoryName = tx.categories?.name || 'Other'
                const emoji = CATEGORY_ICONS[categoryName] || '📦'
                const isExpense = tx.type === 'expense'
                const isIncome = tx.type === 'income'

                return (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: idx < transactions.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--surface-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0,
                    }}>
                      {emoji}
                    </div>
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
                        marginTop: '1px',
                      }}>
                        {categoryName}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isIncome ? 'var(--income)' : isExpense ? 'var(--expense)' : 'var(--text-primary)',
                      flexShrink: 0,
                    }}>
                      {isIncome ? '+' : isExpense ? '-' : ''}{formatINR(tx.amount)}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <Card style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '14px',
              }}>
                Category Breakdown
              </div>

              {/* Mini bar chart */}
              {totalExpenses > 0 && (
                <div style={{
                  display: 'flex',
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '14px',
                }}>
                  {categoryBreakdown.map((cat) => (
                    <div
                      key={cat.name}
                      style={{
                        width: `${(cat.total / totalExpenses) * 100}%`,
                        backgroundColor: cat.color,
                        minWidth: '3px',
                      }}
                      title={`${cat.name}: ${formatINR(cat.total)}`}
                    />
                  ))}
                </div>
              )}

              {/* Category list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {categoryBreakdown.map(cat => (
                  <div
                    key={cat.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                      <span style={{
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                      }}>
                        {cat.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}>
                        {formatINR(cat.total)}
                      </span>
                      {totalExpenses > 0 && (
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          minWidth: '36px',
                          textAlign: 'right',
                        }}>
                          {Math.round((cat.total / totalExpenses) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Mark as reviewed button */}
          {!reviewed && transactions.length > 0 && (
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Button
                variant="primary"
                icon={CheckCircle}
                onClick={() => setReviewed(true)}
              >
                Mark as reviewed
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
