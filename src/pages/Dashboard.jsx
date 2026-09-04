import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/Skeleton';
import { formatINR, formatDate } from '../lib/money';
import { CATEGORY_ICONS } from '../lib/constants';

const NAVY = '#0F1729';
const GOLD = '#D4A853';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Safe emoji resolver — never renders raw Lucide name strings
function resolveEmoji(categoryName) {
  if (!categoryName) return '📦';
  const direct = CATEGORY_ICONS[categoryName];
  if (direct) return direct;
  const lc = categoryName.toLowerCase();
  const map = {
    food:'🍽️', petrol:'⛽', fuel:'⛽', rent:'🏠', loan:'🏦', emi:'🏦',
    bills:'💡', transport:'🚗', shopping:'🛍️', health:'💊', travel:'✈️',
    family:'🎁', gift:'🎁', education:'📚', personal:'💇', entertainment:'🎬',
    savings:'📈', investment:'📈', salary:'💰', interest:'🏦', bonus:'🎉',
    grocery:'🛒', subscript:'💳', insurance:'🛡️', other:'📦', income:'💰',
    transfer:'↔️', misc:'📦',
  };
  for (const [k, v] of Object.entries(map)) if (lc.includes(k)) return v;
  return '📦';
}

function TxnRow({ tx, isLast }) {
  const isIncome = tx.type === 'income';
  const isExpense = tx.type === 'expense';
  const catName = tx.categories?.name || 'Other';
  const emoji = resolveEmoji(catName);
  const title = tx.party || tx.merchant || catName;
  const sign = isIncome ? '+' : isExpense ? '−' : '';
  const amtColor = isIncome ? '#10B981' : isExpense ? '#EF4444' : 'var(--text-primary)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      {/* Icon — strictly sized, no overflow */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: isIncome ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, overflow: 'hidden',
      }}>{emoji}</div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {catName} · {formatDate(tx.transaction_date, 'relative')}
        </div>
      </div>

      {/* Amount */}
      <div style={{ fontSize: 14, fontWeight: 700, color: amtColor, flexShrink: 0 }}>
        {sign}{formatINR(tx.amount)}
      </div>
    </div>
  );
}

function CategoryBar({ name, amount, maxAmount }) {
  const pct = maxAmount > 0 ? Math.min((amount / maxAmount) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{name}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatINR(amount)}</span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: GOLD, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

export default function Dashboard({ refreshKey }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [monthOffset, setMonthOffset] = useState(0);
  const [summary, setSummary] = useState(null);
  const [recentTxns, setRecentTxns] = useState(null);
  const [topCats, setTopCats] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);

  // Compute the display month
  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() + monthOffset, 1);
  const yr = baseDate.getFullYear();
  const mo = baseDate.getMonth() + 1;
  const pad = n => String(n).padStart(2, '0');
  const monthStart = `${yr}-${pad(mo)}-01`;
  const monthEnd = new Date(yr, mo, 0).toISOString().split('T')[0];
  const monthLabel = baseDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const shortLabel = baseDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const [monthlyRes, txnRes, budgetRes, catRes] = await Promise.all([
        supabase.rpc('get_monthly_summary', { p_year: yr, p_month: mo }),
        supabase.from('transactions').select('*, categories(name, icon)')
          .eq('user_id', user.id)
          .gte('transaction_date', monthStart).lte('transaction_date', monthEnd)
          .order('transaction_date', { ascending: false }).order('created_at', { ascending: false })
          .limit(5),
        supabase.from('budgets').select('amount').eq('user_id', user.id),
        supabase.from('transactions').select('amount, categories(name)')
          .eq('user_id', user.id).eq('type', 'expense')
          .gte('transaction_date', monthStart).lte('transaction_date', monthEnd),
      ]);
      if (cancelled) return;

      const s = typeof monthlyRes.data === 'string' ? JSON.parse(monthlyRes.data) : (monthlyRes.data || {});
      setSummary(s);
      setRecentTxns(txnRes.data || []);
      setTotalBudget((budgetRes.data || []).reduce((sum, b) => sum + Number(b.amount), 0));

      const catMap = {};
      for (const t of (catRes.data || [])) {
        const n = t.categories?.name || 'Other';
        catMap[n] = (catMap[n] || 0) + Number(t.amount);
      }
      setTopCats(Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount })));
    }

    setSummary(null); setRecentTxns(null); setTopCats([]);
    load();
    return () => { cancelled = true; };
  }, [user, refreshKey, yr, mo]);

  const income = Number(summary?.total_income || 0);
  const expenses = Number(summary?.total_expenses || 0);
  const savings = income - expenses;
  const savingsPositive = savings >= 0;
  const budgetPct = totalBudget > 0 ? Math.min((expenses / totalBudget) * 100, 100) : 0;
  const overBudget = totalBudget > 0 && expenses > totalBudget;
  const firstName = (profile?.full_name || '').split(' ')[0] || 'there';
  const maxCat = topCats[0]?.amount || 1;

  return (
    <div style={{ paddingBottom: 32 }}>

      {/* ── Hero header ── */}
      <div style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, #1A2540 100%)`,
        borderRadius: '0 0 24px 24px',
        padding: '20px 20px 36px',
        marginBottom: -18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500, letterSpacing: '0.03em' }}>{getGreeting()}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginTop: 3 }}>{firstName}</div>
          </div>
          {/* Month navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setMonthOffset(o => o - 1)}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500, minWidth: 68, textAlign: 'center' }}>{shortLabel}</span>
            <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
              disabled={monthOffset === 0}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: monthOffset === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)', color: monthOffset === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)', cursor: monthOffset === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Net cash flow */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Net Cash Flow</div>
          {summary === null ? (
            <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 120, height: 44, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
            </div>
          ) : (
            <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', color: savingsPositive ? '#E8C97A' : '#fca5a5', lineHeight: 1 }}>
              {savingsPositive ? '+' : '−'}{formatINR(Math.abs(savings))}
            </div>
          )}
        </div>

        {/* Budget bar — only if configured and sensible */}
        {totalBudget > 0 && summary !== null && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                {formatINR(expenses)} of {formatINR(totalBudget)} budget
              </span>
              <span style={{ fontSize: 11, color: overBudget ? '#fca5a5' : 'rgba(255,255,255,0.35)' }}>
                {overBudget ? `${formatINR(expenses - totalBudget)} over` : `${formatINR(totalBudget - expenses)} left`}
              </span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${budgetPct}%`, background: overBudget ? '#EF4444' : GOLD, borderRadius: 99 }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: 10, padding: '26px 16px 0' }}>
        {[
          { label: 'Income',   amount: income,   color: '#10B981', Icon: TrendingUp },
          { label: 'Expenses', amount: expenses, color: '#EF4444', Icon: TrendingDown },
          { label: 'Savings',  amount: savings,  color: savingsPositive ? '#10B981' : '#EF4444', Icon: savingsPositive ? TrendingUp : Minus },
        ].map(({ label, amount, color, Icon }) => (
          <div key={label} style={{ flex: '1 1 0', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 12px' }}>
            {summary === null ? (
              <div style={{ height: 44, background: 'var(--border)', borderRadius: 8 }} />
            ) : (<>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{formatINR(amount)}</div>
            </>)}
          </div>
        ))}
      </div>

      {/* ── Recent Transactions ── */}
      <div style={{ padding: '28px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Transactions</h2>
          <button onClick={() => navigate('/transactions')}
            style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: GOLD, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            See all <ChevronRight size={13} />
          </button>
        </div>

        {recentTxns === null ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ display: 'flex', gap: 13, padding: '13px 16px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--border)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, width: '55%', background: 'var(--border)', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ height: 11, width: '35%', background: 'var(--border)', borderRadius: 4 }} />
                </div>
                <div style={{ height: 14, width: 60, background: 'var(--border)', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : recentTxns.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💳</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No transactions yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add your first transaction with the + button</div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {recentTxns.map((tx, i) => <TxnRow key={tx.id} tx={tx} isLast={i === recentTxns.length - 1} />)}
          </div>
        )}
      </div>

      {/* ── Top Categories ── */}
      {topCats.length > 0 && (
        <div style={{ padding: '28px 16px 0' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Top Categories</h2>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 18px 4px' }}>
            {topCats.map(c => <CategoryBar key={c.name} name={c.name} amount={c.amount} maxAmount={maxCat} />)}
          </div>
        </div>
      )}
    </div>
  );
}
