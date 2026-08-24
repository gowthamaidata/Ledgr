import React, { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, PieChart as PieChartIcon, BarChart3, ArrowUpDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatINR, getMonthRange } from '../lib/money'
import { getSpendingTrend } from '../lib/insights'
import { Card, CardHeader } from '../components/Card'
import { Skeleton, SkeletonCards } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { DEFAULT_CATEGORY_COLORS, CATEGORY_ICONS } from '../lib/constants'

const OTHER_COLOR = '#9ca3af'

function CustomTooltip({ active, payload, type }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>
        {type === 'pie' ? d.name : `Day ${d.payload.day}`}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
        {formatINR(d.value)}
      </div>
    </div>
  )
}

export default function Insights() {
  const { user } = useAuth()
  const toast = useToast()

  const [monthOffset, setMonthOffset] = useState(0)
  const [categoryData, setCategoryData] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const month = getMonthRange(monthOffset)
  const prevMonth = getMonthRange(monthOffset - 1)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const [catRes, dailyRes, prevCatRes, prevDailyRes] = await Promise.all([
        supabase.rpc('get_category_spending', { p_start: month.start, p_end: month.end }),
        supabase.rpc('get_daily_spending', { p_start: month.start, p_end: month.end }),
        supabase.rpc('get_category_spending', { p_start: prevMonth.start, p_end: prevMonth.end }),
        supabase.rpc('get_daily_spending', { p_start: prevMonth.start, p_end: prevMonth.end }),
      ])

      if (catRes.error) throw catRes.error
      if (dailyRes.error) throw dailyRes.error

      // Category data
      const rawCats = (catRes.data || []).map(c => ({
        name: c.category_name || 'Uncategorized',
        value: Math.abs(Number(c.total || 0)),
      })).sort((a, b) => b.value - a.value)

      const totalSpend = rawCats.reduce((s, c) => s + c.value, 0)

      // Group small categories into "Other"
      const significant = []
      let otherTotal = 0
      for (const c of rawCats) {
        if (totalSpend > 0 && (c.value / totalSpend) < 0.03) {
          otherTotal += c.value
        } else {
          significant.push(c)
        }
      }
      if (otherTotal > 0) {
        significant.push({ name: 'Other', value: otherTotal })
      }
      setCategoryData(significant)

      // Daily data
      setDailyData((dailyRes.data || []).map(d => ({
        day: new Date(d.date).getDate(),
        amount: Math.abs(Number(d.total || 0)),
      })))

      // Comparison
      const curIncome = (catRes.data || [])
        .filter(c => Number(c.total || 0) > 0)
        .reduce((s, c) => s + Number(c.total), 0)
      const curExpense = totalSpend
      const prevExpense = (prevCatRes.data || [])
        .filter(c => Number(c.total || 0) <= 0)
        .reduce((s, c) => s + Math.abs(Number(c.total)), 0) ||
        (prevCatRes.data || []).reduce((s, c) => s + Math.abs(Number(c.total || 0)), 0)
      const prevIncome = (prevCatRes.data || [])
        .filter(c => Number(c.total || 0) > 0)
        .reduce((s, c) => s + Number(c.total), 0)

      // Use daily totals for trend
      const dailyTotals = (dailyRes.data || []).map(d => Math.abs(Number(d.total || 0)))
      const trend = getSpendingTrend(dailyTotals)

      setComparison({
        curExpense,
        prevExpense,
        curIncome,
        prevIncome,
        expenseChange: prevExpense > 0 ? Math.round(((curExpense - prevExpense) / prevExpense) * 100) : null,
        incomeChange: prevIncome > 0 ? Math.round(((curIncome - prevIncome) / prevIncome) * 100) : null,
        trend,
      })
    } catch (err) {
      console.error('Insights fetch error:', err)
      setError('Failed to load insights')
      toast.error('Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [user, monthOffset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalSpend = categoryData.reduce((s, c) => s + c.value, 0)

  return (
    <div style={{ padding: '20px', maxWidth: 600, margin: '0 auto' }}>
      {/* Month selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <button
          onClick={() => setMonthOffset(m => m - 1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)', cursor: 'pointer',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 style={{
          margin: 0, fontSize: 18, fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {month.label}
        </h2>
        <button
          onClick={() => setMonthOffset(m => m + 1)}
          disabled={monthOffset >= 0}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
            color: monthOffset >= 0 ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: monthOffset >= 0 ? 'not-allowed' : 'pointer',
            opacity: monthOffset >= 0 ? 0.5 : 1,
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {error && (
        <Card style={{ marginBottom: 16, backgroundColor: 'var(--expense-light)', borderColor: 'var(--expense)' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--expense)' }}>{error}</p>
        </Card>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <Skeleton height="14px" width="40%" style={{ marginBottom: 16 }} />
            <Skeleton height="200px" style={{ borderRadius: 'var(--radius)' }} />
          </Card>
          <Card>
            <Skeleton height="14px" width="40%" style={{ marginBottom: 16 }} />
            <Skeleton height="180px" style={{ borderRadius: 'var(--radius)' }} />
          </Card>
          <SkeletonCards n={1} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Spending by Category */}
          <Card>
            <CardHeader title="Spending by Category" />
            {categoryData.length === 0 ? (
              <EmptyState
                icon={PieChartIcon}
                title="No spending data"
                description="No expenses recorded for this month yet."
              />
            ) : (
              <>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={entry.name === 'Other' ? OTHER_COLOR : (DEFAULT_CATEGORY_COLORS[entry.name] || OTHER_COLOR)}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip type="pie" />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Total in center label */}
                <div style={{ textAlign: 'center', marginTop: -8, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total: </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatINR(totalSpend)}
                  </span>
                </div>
                {/* Category list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {categoryData.map(cat => {
                    const pct = totalSpend > 0 ? Math.round((cat.value / totalSpend) * 100) : 0
                    const color = cat.name === 'Other' ? OTHER_COLOR : (DEFAULT_CATEGORY_COLORS[cat.name] || OTHER_COLOR)
                    const icon = CATEGORY_ICONS[cat.name] || '📦'
                    return (
                      <div key={cat.name} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg)',
                      }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          backgroundColor: color, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 14 }}>{icon}</span>
                        <span style={{
                          flex: 1, fontSize: 14, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {formatINR(cat.value)}
                        </span>
                        <span style={{
                          fontSize: 12, color: 'var(--text-muted)',
                          minWidth: 36, textAlign: 'right',
                        }}>
                          {pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>

          {/* Daily Spending Trend */}
          <Card>
            <CardHeader title="Daily Spending Trend" />
            {dailyData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No daily data"
                description="No expenses recorded for this month yet."
              />
            ) : (
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v}
                    />
                    <Tooltip content={<CustomTooltip type="bar" />} cursor={{ fill: 'var(--surface-muted)', opacity: 0.5 }} />
                    <Bar dataKey="amount" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Monthly Comparison */}
          <Card>
            <CardHeader title="Monthly Comparison" />
            {comparison && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ComparisonRow
                  label="Expenses"
                  current={comparison.curExpense}
                  change={comparison.expenseChange}
                  invertColor
                />
                <ComparisonRow
                  label="Income"
                  current={comparison.curIncome}
                  change={comparison.incomeChange}
                />
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: 12,
                }}>
                  <ComparisonRow
                    label="Net"
                    current={comparison.curIncome - comparison.curExpense}
                    change={
                      comparison.prevIncome - comparison.prevExpense !== 0
                        ? Math.round((((comparison.curIncome - comparison.curExpense) - (comparison.prevIncome - comparison.prevExpense)) / Math.abs(comparison.prevIncome - comparison.prevExpense)) * 100)
                        : null
                    }
                  />
                </div>
                {comparison.trend && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-muted)',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    {comparison.trend.direction === 'up'
                      ? <TrendingUp size={14} style={{ color: 'var(--expense)' }} />
                      : <TrendingDown size={14} style={{ color: 'var(--income)' }} />
                    }
                    7-day spending trend: {comparison.trend.direction === 'up' ? '+' : ''}{comparison.trend.change}% vs previous week
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function ComparisonRow({ label, current, change, invertColor = false }) {
  const isUp = change > 0
  const isNeutral = change === 0 || change === null

  // For expenses, up is bad (red). For income/net, up is good (green).
  let changeColor = 'var(--text-muted)'
  if (!isNeutral) {
    if (invertColor) {
      changeColor = isUp ? 'var(--expense)' : 'var(--income)'
    } else {
      changeColor = isUp ? 'var(--income)' : 'var(--expense)'
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatINR(Math.abs(current))}
        </span>
        {change !== null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 12, fontWeight: 500, color: changeColor,
            padding: '2px 8px', borderRadius: '999px',
            backgroundColor: isNeutral ? 'var(--surface-muted)' : undefined,
          }}>
            {isNeutral ? (
              <Minus size={12} />
            ) : isUp ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {isNeutral ? '0%' : `${Math.abs(change)}%`}
          </span>
        )}
      </div>
    </div>
  )
}
