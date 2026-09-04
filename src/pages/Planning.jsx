import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Target, Wallet, RefreshCw, Calendar, ArrowUpCircle, ArrowDownCircle,
  ToggleLeft, ToggleRight, Trash2, TrendingUp,
} from 'lucide-react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatINR, formatDate, getMonthRange, burnPercent, burnColor } from '../lib/money'
import { Card, CardHeader } from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { Skeleton, SkeletonCards } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { CATEGORY_ICONS, DEFAULT_CATEGORY_COLORS } from '../lib/constants'

/* ─── Design Tokens ─── */
const NAVY = '#0F1729'
const NAVY_LIGHT = '#1A2340'
const NAVY_MID = '#243052'
const GOLD = '#D4A853'
const GOLD_LIGHT = '#E8C97A'
const WHITE = '#FFFFFF'
const WHITE_60 = 'rgba(255,255,255,0.6)'
const WHITE_80 = 'rgba(255,255,255,0.8)'

const TABS = [
  { key: 'budgets', label: 'Budgets', icon: Wallet },
  { key: 'goals', label: 'Goals', icon: Target },
  { key: 'recurring', label: 'Recurring', icon: RefreshCw },
]

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const currentMonthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

export default function Planning() {
  const [activeTab, setActiveTab] = useState('budgets')
  const navigate = useNavigate()

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Clean page header - consistent with rest of app */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Planning</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{currentMonthLabel}</span>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Clean tab bar */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '12px 8px',
                  borderRadius: 0,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid #D4A853' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'budgets' && <BudgetsTab />}
        {activeTab === 'goals' && <GoalsTab />}
        {activeTab === 'recurring' && <RecurringTab />}
      </div>
    </div>
  )
}

/* ─── Budgets Tab ─── */

function BudgetsTab() {
  const { user } = useAuth()
  const toast = useToast()
  const [budgets, setBudgets] = useState([])
  const [spending, setSpending] = useState({})
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const month = getMonthRange(0)

  const fetchBudgets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [budgetRes, catRes] = await Promise.all([
        supabase.from('budgets').select('*, categories(name, icon, color)').eq('user_id', user.id),
        supabase.from('categories').select('id, name, icon, color').eq('user_id', user.id),
      ])
      if (budgetRes.error) throw budgetRes.error
      if (catRes.error) throw catRes.error

      setBudgets(budgetRes.data || [])
      setCategories(catRes.data || [])

      // Fetch spent amounts per category for current month
      const spendMap = {}
      for (const b of budgetRes.data || []) {
        const { data } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('category_id', b.category_id)
          .eq('type', 'expense')
          .gte('transaction_date', month.start)
          .lte('transaction_date', month.end)
        const total = (data || []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        spendMap[b.category_id] = total
      }
      setSpending(spendMap)
    } catch (err) {
      console.error('Budgets fetch error:', err)
      toast.error('Failed to load budgets')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  async function handleAddBudget(e) {
    e.preventDefault()
    if (!formCategoryId || !formAmount) return
    setSaving(true)
    try {
      const { error } = await supabase.from('budgets').insert({
        user_id: user.id,
        category_id: formCategoryId,
        amount: parseFloat(formAmount),
        period: 'monthly',
      })
      if (error) throw error
      toast.success('Budget added')
      setShowModal(false)
      setFormCategoryId('')
      setFormAmount('')
      fetchBudgets()
    } catch (err) {
      toast.error(err.message || 'Failed to add budget')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBudget(id) {
    const ok = await toast.confirm('Delete this budget?', { danger: true })
    if (!ok) return
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error
      toast.success('Budget deleted')
      fetchBudgets()
    } catch (err) {
      toast.error('Failed to delete budget')
    }
  }

  if (loading) return <SkeletonCards n={3} />

  const usedCategoryIds = new Set(budgets.map(b => b.category_id))
  const availableCategories = categories.filter(c => !usedCategoryIds.has(c.id))

  // Compute totals for Budget Overview card
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0)
  const totalSpent = budgets.reduce((s, b) => s + (spending[b.category_id] || 0), 0)
  const overallPct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0

  return (
    <>
      {budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No budgets yet"
          description="Set monthly budgets by category to track your spending limits."
          actionLabel="Add Budget"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Budget Overview Card */}
          <div style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 50%, ${NAVY_MID} 100%)`,
            borderRadius: 16,
            padding: '20px 20px 18px',
            color: WHITE,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: WHITE_60, marginBottom: 8, letterSpacing: '0.02em' }}>
              Budget Overview
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {formatINR(totalSpent)}
              </span>
              <span style={{ fontSize: 16, fontWeight: 400, color: WHITE_60 }}>
                / {formatINR(totalBudget)}
              </span>
            </div>
            {/* Gold Gradient Progress Bar */}
            <div style={{
              width: '100%', height: 8,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 4,
              overflow: 'hidden',
              marginTop: 12,
              marginBottom: 8,
            }}>
              <div style={{
                width: `${overallPct}%`, height: '100%',
                background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, color: WHITE_60 }}>
              {overallPct}% of budget used
            </div>
          </div>

          {/* Category Budgets Section */}
          <div style={{ marginTop: 4 }}>
            <div style={{
              fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
              marginBottom: 12, letterSpacing: '-0.01em',
            }}>
              Category Budgets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {budgets.map(budget => {
                const catName = budget.categories?.name || 'Unknown'
                const catIcon = CATEGORY_ICONS[catName] || budget.categories?.icon || '📦'
                const spent = spending[budget.category_id] || 0
                const pct = burnPercent(spent, budget.amount)
                const isOver = pct > 100
                const barColor = isOver ? 'var(--expense, #EF4444)' : 'var(--income, #22C55E)'
                const barWidth = Math.min(pct, 100)

                return (
                  <div key={budget.id} style={{
                    backgroundColor: 'var(--surface, #FFFFFF)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    border: '1px solid var(--border, #E5E7EB)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          backgroundColor: `${DEFAULT_CATEGORY_COLORS[catName] || NAVY}15`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18,
                        }}>
                          {catIcon}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{catName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                            {formatINR(spent)} of {formatINR(budget.amount)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isOver && (
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: 'var(--expense, #EF4444)',
                            backgroundColor: 'rgba(239,68,68,0.1)',
                            padding: '3px 8px', borderRadius: 6,
                          }}>
                            Over budget
                          </span>
                        )}
                        {!isOver && (
                          <Badge variant={pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'success'}>
                            {pct}%
                          </Badge>
                        )}
                        <button
                          onClick={() => handleDeleteBudget(budget.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 'var(--radius-sm, 6px)',
                            border: 'none', backgroundColor: 'transparent',
                            color: 'var(--text-muted)', cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{
                      width: '100%', height: 6,
                      backgroundColor: 'var(--surface-muted, #F3F4F6)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${barWidth}%`, height: '100%',
                        backgroundColor: barColor,
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Button
            variant="secondary"
            icon={Plus}
            fullWidth
            onClick={() => setShowModal(true)}
            disabled={availableCategories.length === 0}
            style={{ marginTop: 4 }}
          >
            Add Budget
          </Button>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Budget">
        <form onSubmit={handleAddBudget}>
          <Select
            label="Category"
            placeholder="Select category"
            value={formCategoryId}
            onChange={e => setFormCategoryId(e.target.value)}
            options={availableCategories.map(c => ({ value: c.id, label: `${CATEGORY_ICONS[c.name] || ''} ${c.name}` }))}
          />
          <Input
            label="Monthly Budget Amount"
            type="number"
            min="1"
            step="any"
            placeholder="e.g. 5000"
            value={formAmount}
            onChange={e => setFormAmount(e.target.value)}
          />
          <Button type="submit" fullWidth loading={saving} disabled={!formCategoryId || !formAmount}>
            Add Budget
          </Button>
        </form>
      </Modal>
    </>
  )
}

/* ─── Goals Tab ─── */

function GoalsTab() {
  const { user } = useAuth()
  const toast = useToast()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '0', target_date: '', notes: '' })
  const [adjustGoal, setAdjustGoal] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustType, setAdjustType] = useState('add')

  const fetchGoals = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (error) throw error
      setGoals(data || [])
    } catch (err) {
      console.error('Goals fetch error:', err)
      toast.error('Failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  async function handleAddGoal(e) {
    e.preventDefault()
    if (!form.name || !form.target_amount) return
    setSaving(true)
    try {
      const { error } = await supabase.from('goals').insert({
        user_id: user.id,
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        target_date: form.target_date || null,
        notes: form.notes || null,
      })
      if (error) throw error
      toast.success('Goal created')
      setShowModal(false)
      setForm({ name: '', target_amount: '', current_amount: '0', target_date: '', notes: '' })
      fetchGoals()
    } catch (err) {
      toast.error(err.message || 'Failed to create goal')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdjustGoal() {
    if (!adjustGoal || !adjustAmount) return
    const delta = parseFloat(adjustAmount)
    if (isNaN(delta) || delta <= 0) return
    const newAmount = adjustType === 'add'
      ? Number(adjustGoal.current_amount) + delta
      : Math.max(0, Number(adjustGoal.current_amount) - delta)

    try {
      const { error } = await supabase
        .from('goals')
        .update({ current_amount: newAmount })
        .eq('id', adjustGoal.id)
      if (error) throw error
      toast.success(`${adjustType === 'add' ? 'Added' : 'Withdrawn'} ${formatINR(delta)}`)
      setAdjustGoal(null)
      setAdjustAmount('')
      fetchGoals()
    } catch (err) {
      toast.error('Failed to update goal')
    }
  }

  async function handleDeleteGoal(id) {
    const ok = await toast.confirm('Delete this goal?', { danger: true })
    if (!ok) return
    try {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
      toast.success('Goal deleted')
      fetchGoals()
    } catch (err) {
      toast.error('Failed to delete goal')
    }
  }

  if (loading) return <SkeletonCards n={3} />

  return (
    <>
      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No savings goals"
          description="Set targets for things you're saving towards."
          actionLabel="Add Goal"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section header */}
          <div style={{
            fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            Savings Goals
          </div>

          {/* Goal Cards with Circular Progress Rings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {goals.map(goal => {
              const pct = burnPercent(Number(goal.current_amount), Number(goal.target_amount))
              const clampedPct = Math.min(pct, 100)
              const ringSize = 80
              const innerSize = ringSize - 14

              return (
                <div key={goal.id} style={{
                  backgroundColor: 'var(--surface, #FFFFFF)',
                  borderRadius: 16,
                  padding: '18px 14px 14px',
                  border: '1px solid var(--border, #E5E7EB)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  position: 'relative',
                }}>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: 6,
                      border: 'none', backgroundColor: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>

                  {/* Conic Gradient Circular Progress Ring */}
                  <div style={{
                    width: ringSize, height: ringSize,
                    borderRadius: '50%',
                    background: `conic-gradient(${GOLD} 0% ${clampedPct}%, #E5E7EB ${clampedPct}% 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 12,
                  }}>
                    <div style={{
                      width: innerSize, height: innerSize,
                      borderRadius: '50%',
                      backgroundColor: 'var(--surface, #FFFFFF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700,
                      color: pct >= 100 ? 'var(--income, #22C55E)' : NAVY,
                    }}>
                      {pct}%
                    </div>
                  </div>

                  {/* Goal Name */}
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                    textAlign: 'center', marginBottom: 4,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    width: '100%',
                  }}>
                    {goal.name}
                  </div>

                  {/* Amount */}
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)',
                    textAlign: 'center', marginBottom: 10,
                  }}>
                    {formatINR(goal.current_amount)} of {formatINR(goal.target_amount)}
                  </div>

                  {/* Target date */}
                  {goal.target_date && (
                    <div style={{
                      fontSize: 10, color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 3, marginBottom: 8,
                    }}>
                      <Calendar size={10} />
                      {formatDate(goal.target_date, 'short')}
                    </div>
                  )}

                  {/* Add / Withdraw buttons */}
                  <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                    <button
                      onClick={() => { setAdjustGoal(goal); setAdjustType('add'); setAdjustAmount('') }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                        padding: '5px 6px', borderRadius: 8,
                        border: '1px solid var(--border, #E5E7EB)', backgroundColor: 'var(--surface, #FFFFFF)',
                        color: 'var(--income, #22C55E)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                        fontWeight: 500,
                      }}
                    >
                      <ArrowUpCircle size={12} /> Add
                    </button>
                    <button
                      onClick={() => { setAdjustGoal(goal); setAdjustType('withdraw'); setAdjustAmount('') }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                        padding: '5px 6px', borderRadius: 8,
                        border: '1px solid var(--border, #E5E7EB)', backgroundColor: 'var(--surface, #FFFFFF)',
                        color: 'var(--expense, #EF4444)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                        fontWeight: 500,
                      }}
                    >
                      <ArrowDownCircle size={12} /> Out
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <Button variant="secondary" icon={Plus} fullWidth onClick={() => setShowModal(true)}>
            Add Goal
          </Button>
        </div>
      )}

      {/* Add Goal Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Savings Goal">
        <form onSubmit={handleAddGoal}>
          <Input
            label="Goal Name"
            placeholder="e.g. Emergency Fund"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Target Amount"
            type="number"
            min="1"
            step="any"
            placeholder="e.g. 100000"
            value={form.target_amount}
            onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
          />
          <Input
            label="Current Amount (optional)"
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={form.current_amount}
            onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))}
          />
          <Input
            label="Target Date (optional)"
            type="date"
            value={form.target_date}
            onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
          />
          <Input
            label="Notes (optional)"
            placeholder="Any notes..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <Button type="submit" fullWidth loading={saving} disabled={!form.name || !form.target_amount}>
            Create Goal
          </Button>
        </form>
      </Modal>

      {/* Adjust Goal Modal */}
      <Modal
        open={!!adjustGoal}
        onClose={() => setAdjustGoal(null)}
        title={adjustType === 'add' ? 'Add to Goal' : 'Withdraw from Goal'}
      >
        {adjustGoal && (
          <div>
            <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
              <strong>{adjustGoal.name}</strong> — Current: {formatINR(adjustGoal.current_amount)}
            </div>
            <Input
              label="Amount"
              type="number"
              min="1"
              step="any"
              placeholder="Enter amount"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
            />
            <Button
              fullWidth
              onClick={handleAdjustGoal}
              disabled={!adjustAmount || parseFloat(adjustAmount) <= 0}
              variant={adjustType === 'add' ? 'primary' : 'danger'}
            >
              {adjustType === 'add' ? 'Add Funds' : 'Withdraw Funds'}
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}

/* ─── Recurring Tab ─── */

function RecurringTab() {
  const { user } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    description: '', amount: '', category_id: '', frequency: 'monthly', start_date: '', account_id: '',
  })

  const fetchRecurring = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [recRes, catRes, accRes] = await Promise.all([
        supabase.from('recurring_transactions').select('*, categories(name, icon, color)').eq('user_id', user.id).order('next_due_date', { ascending: true }),
        supabase.from('categories').select('id, name, icon, color').eq('user_id', user.id),
        supabase.from('accounts').select('id, name').eq('user_id', user.id),
      ])
      if (recRes.error) throw recRes.error
      setItems(recRes.data || [])
      setCategories(catRes.data || [])
      setAccounts(accRes.data || [])
    } catch (err) {
      console.error('Recurring fetch error:', err)
      toast.error('Failed to load recurring transactions')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchRecurring()
  }, [fetchRecurring])

  async function handleAddRecurring(e) {
    e.preventDefault()
    if (!form.description || !form.amount) return
    setSaving(true)
    try {
      const { error } = await supabase.from('recurring_transactions').insert({
        user_id: user.id,
        description: form.description,
        amount: parseFloat(form.amount),
        category_id: form.category_id || null,
        frequency: form.frequency,
        start_date: form.start_date || new Date().toISOString().split('T')[0],
        next_due_date: form.start_date || new Date().toISOString().split('T')[0],
        account_id: form.account_id || null,
        type: 'expense',
        is_active: true,
      })
      if (error) throw error
      toast.success('Recurring transaction added')
      setShowModal(false)
      setForm({ description: '', amount: '', category_id: '', frequency: 'monthly', start_date: '', account_id: '' })
      fetchRecurring()
    } catch (err) {
      toast.error(err.message || 'Failed to add recurring transaction')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(item) {
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)
      if (error) throw error
      toast.success(item.is_active ? 'Paused' : 'Activated')
      fetchRecurring()
    } catch (err) {
      toast.error('Failed to update')
    }
  }

  async function handleDeleteRecurring(id) {
    const ok = await toast.confirm('Delete this recurring transaction?', { danger: true })
    if (!ok) return
    try {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
      if (error) throw error
      toast.success('Deleted')
      fetchRecurring()
    } catch (err) {
      toast.error('Failed to delete')
    }
  }

  if (loading) return <SkeletonCards n={3} />

  return (
    <>
      {items.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No recurring transactions"
          description="Add bills, subscriptions, or regular payments that repeat automatically."
          actionLabel="Add Recurring"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => {
            const catName = item.categories?.name || 'Uncategorized'
            const catIcon = CATEGORY_ICONS[catName] || item.categories?.icon || '📦'
            const isOverdue = item.next_due_date && new Date(item.next_due_date + 'T00:00:00') < new Date(new Date().toISOString().split('T')[0] + 'T00:00:00')
            return (
              <div key={item.id} style={{
                backgroundColor: 'var(--surface, #FFFFFF)',
                borderRadius: 14,
                padding: '14px 16px',
                border: '1px solid var(--border, #E5E7EB)',
                opacity: item.is_active ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: `${DEFAULT_CATEGORY_COLORS[catName] || NAVY}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {catIcon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.description}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--expense, #EF4444)' }}>
                          {formatINR(item.amount)}
                        </span>
                        <Badge>{item.frequency}</Badge>
                        {item.next_due_date && (
                          <span style={{
                            fontSize: 12, color: isOverdue ? 'var(--expense, #EF4444)' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <Calendar size={11} />
                            {isOverdue ? 'Overdue' : `Due ${formatDate(item.next_due_date, 'short')}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleToggleActive(item)}
                      title={item.is_active ? 'Pause' : 'Activate'}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: 8,
                        border: 'none', backgroundColor: 'transparent',
                        color: item.is_active ? 'var(--income, #22C55E)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {item.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button
                      onClick={() => handleDeleteRecurring(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: 6,
                        border: 'none', backgroundColor: 'transparent',
                        color: 'var(--text-muted)', cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <Button variant="secondary" icon={Plus} fullWidth onClick={() => setShowModal(true)}>
            Add Recurring
          </Button>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Recurring Transaction">
        <form onSubmit={handleAddRecurring}>
          <Input
            label="Description"
            placeholder="e.g. Netflix Subscription"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <Input
            label="Amount"
            type="number"
            min="1"
            step="any"
            placeholder="e.g. 649"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
          <Select
            label="Category (optional)"
            placeholder="Select category"
            value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            options={categories.map(c => ({ value: c.id, label: `${CATEGORY_ICONS[c.name] || ''} ${c.name}` }))}
          />
          <Select
            label="Frequency"
            value={form.frequency}
            onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
            options={FREQUENCY_OPTIONS}
          />
          <Input
            label="Start Date"
            type="date"
            value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
          />
          {accounts.length > 0 && (
            <Select
              label="Account (optional)"
              placeholder="Select account"
              value={form.account_id}
              onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
              options={accounts.map(a => ({ value: a.id, label: a.name }))}
            />
          )}
          <Button type="submit" fullWidth loading={saving} disabled={!form.description || !form.amount}>
            Add Recurring
          </Button>
        </form>
      </Modal>
    </>
  )
}
