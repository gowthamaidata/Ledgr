import React, { useState, useEffect, useCallback } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, PieChart as PieChartIcon, BarChart3, ArrowUpDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatINR, formatCompact, getMonthRange } from '../lib/money'
import { getSpendingTrend } from '../lib/insights'
import { Card, CardHeader } from '../components/Card'
import { Skeleton, SkeletonCards } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { DEFAULT_CATEGORY_COLORS, CATEGORY_ICONS } from '../lib/constants'

/* ── Premium palette ─────────────────────────────────────────────── */
const NAVY = '#0F1729'
const NAVY_LIGHT = '#1A2540'
const NAVY_MID = '#152036'
const GOLD = '#D4A853'
const GOLD_LIGHT = '#E8C97A'
const INCOME_GREEN = '#10B981'
const EXPENSE_RED = '#EF4444'
const SAVINGS_BLUE = '#3B82F6'
const OTHER_COLOR = '#9ca3af'

/* ── Sub-components ──────────────────────────────────────────────── */

function CustomTooltip({ active, payload, type }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      backgroundColor: NAVY_LIGHT,
      border: `1px solid ${GOLD}33`,
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 3 }}>
        {type === 'pie' ? d.name : `Day ${d.payload.day}`}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
        {formatINR(d.value)}
      </div>
    </div>
  )
}

function ComparisonRow({ label, current, change, invertColor = false }) {
  const isUp = change > 0
  const isNeutral = change === 0 || change === null

  // For expenses, up is bad (red). For income/net, up is good (green).
  let changeColor = '#94a3b8'
  let changeBg = 'rgba(148,163,184,0.12)'
  if (!isNeutral) {
    if (invertColor) {
      changeColor = isUp ? EXPENSE_RED : INCOME_GREEN
      changeBg = isUp ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'
    } else {
      changeColor = isUp ? INCOME_GREEN : EXPENSE_RED
      changeBg = isUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: NAVY_LIGHT,
      borderRadius: 12,
    }}>
      <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
          {formatINR(Math.abs(current))}
        </span>
        {change !== null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 12, fontWeight: 600, color: changeColor,
            padding: '3px 10px', borderRadius: '999px',
            backgroundColor: changeBg,
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

/* ── Main Insights page ──────────────────────────────────────────── */

export default function Insights() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

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

  /* ── Compact month label for header (e.g., "Aug 2026") ────────── */
  const shortMonthLabel = (() => {
    const d = new Date(month.start + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  })()

  /* ── Top merchants from category data (simulated from categories) */
  const topMerchants = categoryData
    .filter(c => c.name !== 'Other')
    .slice(0, 5)

  const topMerchantMax = topMerchants.length > 0 ? topMerchants[0].value : 1

  /* ── Monthly trend data (last 6 months) ────────────────────────── */
  const monthlyTrendData = (() => {
    const data = []
    for (let i = 5; i >= 0; i--) {
      const m = getMonthRange(monthOffset - i)
      const d = new Date(m.start + 'T00:00:00')
      const label = d.toLocaleDateString('en-IN', { month: 'short' })
      if (i === 0 && comparison) {
        data.push({ month: label, expense: comparison.curExpense, income: comparison.curIncome })
      } else if (i === 1 && comparison) {
        data.push({ month: label, expense: comparison.prevExpense, income: comparison.prevIncome })
      } else {
        data.push({ month: label, expense: 0, income: 0 })
      }
    }
    return data
  })()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: NAVY }}>
      {/* ── Navy header bar ─────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_MID} 100%)`,
        padding: '16px 20px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: `1px solid ${GOLD}15`,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10,
            border: 'none', backgroundColor: 'rgba(255,255,255,0.08)',
            color: '#fff', cursor: 'pointer',
          }}
        >
          <ChevronLeft size={20} />
        </button>

        <h1 style={{
          margin: 0, fontSize: 18, fontWeight: 700,
          color: '#fff', letterSpacing: '-0.02em',
        }}>
          Insights
        </h1>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <button
            onClick={() => setMonthOffset(m => m - 1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: GOLD, cursor: 'pointer', padding: 0,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            fontSize: 14, fontWeight: 600, color: GOLD,
            minWidth: 80, textAlign: 'center',
          }}>
            {shortMonthLabel}
          </span>
          <button
            onClick={() => setMonthOffset(m => m + 1)}
            disabled={monthOffset >= 0}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: monthOffset >= 0 ? '#475569' : GOLD,
              cursor: monthOffset >= 0 ? 'not-allowed' : 'pointer',
              padding: 0,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <div style={{
          margin: '12px 20px 0',
          padding: '12px 16px',
          borderRadius: 12,
          backgroundColor: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.25)',
        }}>
          <p style={{ margin: 0, fontSize: 14, color: EXPENSE_RED }}>{error}</p>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 100px', maxWidth: 600, margin: '0 auto' }}>

        {loading ? (
          <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary skeleton */}
            <div style={{
              display: 'flex', gap: 10,
            }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  flex: 1, padding: '14px 12px', borderRadius: 14,
                  backgroundColor: NAVY_LIGHT,
                }}>
                  <Skeleton height="10px" width="50%" style={{ marginBottom: 8, opacity: 0.3 }} />
                  <Skeleton height="20px" width="70%" style={{ opacity: 0.3 }} />
                </div>
              ))}
            </div>
            <div style={{
              padding: 20, borderRadius: 16, backgroundColor: NAVY_LIGHT,
            }}>
              <Skeleton height="14px" width="40%" style={{ marginBottom: 16, opacity: 0.3 }} />
              <Skeleton height="200px" style={{ borderRadius: 12, opacity: 0.2 }} />
            </div>
            <div style={{
              padding: 20, borderRadius: 16, backgroundColor: NAVY_LIGHT,
            }}>
              <Skeleton height="14px" width="40%" style={{ marginBottom: 16, opacity: 0.3 }} />
              <Skeleton height="180px" style={{ borderRadius: 12, opacity: 0.2 }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>

            {/* ── Summary strip ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Income */}
              <div style={{
                flex: 1, padding: '14px 12px', borderRadius: 14,
                backgroundColor: NAVY_LIGHT,
                borderLeft: `3px solid ${INCOME_GREEN}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Income
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: INCOME_GREEN }}>
                  {comparison ? formatCompact(comparison.curIncome) : '--'}
                </div>
              </div>
              {/* Expenses */}
              <div style={{
                flex: 1, padding: '14px 12px', borderRadius: 14,
                backgroundColor: NAVY_LIGHT,
                borderLeft: `3px solid ${EXPENSE_RED}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Expenses
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: EXPENSE_RED }}>
                  {comparison ? formatCompact(comparison.curExpense) : '--'}
                </div>
              </div>
              {/* Savings */}
              <div style={{
                flex: 1, padding: '14px 12px', borderRadius: 14,
                backgroundColor: NAVY_LIGHT,
                borderLeft: `3px solid ${SAVINGS_BLUE}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Savings
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: SAVINGS_BLUE }}>
                  {comparison ? formatCompact(comparison.curIncome - comparison.curExpense) : '--'}
                </div>
              </div>
            </div>

            {/* ── Monthly Trend (Bar chart) ──────────────────────────────── */}
            <div style={{
              padding: 20, borderRadius: 16,
              backgroundColor: NAVY_LIGHT,
              border: `1px solid rgba(255,255,255,0.06)`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 18,
              }}>
                <BarChart3 size={18} color={GOLD} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  Monthly Trend
                </h3>
              </div>
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
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : v}
                      />
                      <Tooltip content={<CustomTooltip type="bar" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="amount" fill={NAVY} radius={[4, 4, 0, 0]}>
                        {dailyData.map((entry, i) => (
                          <Cell key={i} fill={i === dailyData.length - 1 ? GOLD : GOLD + '88'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ── Spending by Category (Donut) ───────────────────────────── */}
            <div style={{
              padding: 20, borderRadius: 16,
              backgroundColor: NAVY_LIGHT,
              border: `1px solid rgba(255,255,255,0.06)`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 18,
              }}>
                <PieChartIcon size={18} color={GOLD} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  Spending by Category
                </h3>
              </div>
              {categoryData.length === 0 ? (
                <EmptyState
                  icon={PieChartIcon}
                  title="No spending data"
                  description="No expenses recorded for this month yet."
                />
              ) : (
                <>
                  <div style={{ width: '100%', height: 220, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
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
                    {/* Center total overlay */}
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center', pointerEvents: 'none',
                    }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>
                        {formatCompact(totalSpend)}
                      </div>
                    </div>
                  </div>

                  {/* Category list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {categoryData.map(cat => {
                      const pct = totalSpend > 0 ? Math.round((cat.value / totalSpend) * 100) : 0
                      const color = cat.name === 'Other' ? OTHER_COLOR : (DEFAULT_CATEGORY_COLORS[cat.name] || OTHER_COLOR)
                      const icon = CATEGORY_ICONS[cat.name] || '\u{1F4E6}'
                      return (
                        <div key={cat.name} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 10,
                          backgroundColor: NAVY_MID,
                        }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            backgroundColor: color, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 15 }}>{icon}</span>
                          <span style={{
                            flex: 1, fontSize: 14, fontWeight: 500, color: '#e2e8f0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {cat.name}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                            {formatINR(cat.value)}
                          </span>
                          <span style={{
                            fontSize: 12, color: '#64748b', fontWeight: 500,
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
            </div>

            {/* ── Top Merchants (progress bars) ──────────────────────────── */}
            {topMerchants.length > 0 && (
              <div style={{
                padding: 20, borderRadius: 16,
                backgroundColor: NAVY_LIGHT,
                border: `1px solid rgba(255,255,255,0.06)`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 18,
                }}>
                  <ArrowUpDown size={18} color={GOLD} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    Top Merchants
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {topMerchants.map((m, i) => {
                    const barWidth = topMerchantMax > 0 ? Math.max((m.value / topMerchantMax) * 100, 4) : 4
                    const icon = CATEGORY_ICONS[m.name] || '\u{1F4E6}'
                    return (
                      <div key={m.name}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 6,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14 }}>{icon}</span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>{m.name}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                            {formatINR(m.value)}
                          </span>
                        </div>
                        <div style={{
                          width: '100%', height: 6, borderRadius: 3,
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${barWidth}%`, height: '100%', borderRadius: 3,
                            background: i === 0
                              ? `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`
                              : `linear-gradient(90deg, ${GOLD}88, ${GOLD}55)`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Monthly Comparison ─────────────────────────────────────── */}
            <div style={{
              padding: 20, borderRadius: 16,
              backgroundColor: NAVY_LIGHT,
              border: `1px solid rgba(255,255,255,0.06)`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 18,
              }}>
                <ArrowUpDown size={18} color={GOLD} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  Monthly Comparison
                </h3>
              </div>
              {comparison && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: 8,
                    marginTop: 4,
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
                      padding: '12px 14px',
                      borderRadius: 10,
                      backgroundColor: NAVY_MID,
                      fontSize: 13,
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 4,
                    }}>
                      {comparison.trend.direction === 'up'
                        ? <TrendingUp size={14} style={{ color: EXPENSE_RED, flexShrink: 0 }} />
                        : <TrendingDown size={14} style={{ color: INCOME_GREEN, flexShrink: 0 }} />
                      }
                      <span>
                        7-day spending trend: {comparison.trend.direction === 'up' ? '+' : ''}{comparison.trend.change}% vs previous week
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
