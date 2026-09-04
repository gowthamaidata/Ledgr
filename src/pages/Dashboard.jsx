import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import { formatINR, formatMonth, formatDate, todayISO } from '../lib/money';
import { CATEGORY_ICONS } from '../lib/constants';

const COLORS = {
  navy: '#0F1729', navyLight: '#1A2540', navyMid: '#152036',
  gold: '#D4A853', goldLight: '#E8C97A',
  income: '#10B981', expense: '#EF4444', accent: '#3B82F6',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Resolve a category name → emoji.
 * The DB may store Lucide icon name strings ("car", "smile", "briefcase").
 * We NEVER render those raw — always fall back to the emoji map.
 */
function resolveCategoryEmoji(categoryName) {
  if (!categoryName) return '💳';
  // Look up by exact name first (our CATEGORY_ICONS uses display names like "Food", "Transport")
  const direct = CATEGORY_ICONS[categoryName];
  if (direct) return direct;
  // Fuzzy: lowercase partial match
  const lc = categoryName.toLowerCase();
  const FALLBACKS = {
    food: '🍽️', rent: '🏠', loan: '🏦', emi: '🏦', bills: '💡',
    transport: '🚗', shopping: '🛍️', health: '💊', travel: '✈️',
    family: '🎁', gifts: '🎁', education: '📚', personal: '💇',
    entertainment: '🎬', savings: '📈', investment: '📈', salary: '💰',
    interest: '🏦', bonus: '🎉', other: '📦', income: '💰',
    petrol: '⛽', grocery: '🛒', groceries: '🛒',
  };
  for (const [key, val] of Object.entries(FALLBACKS)) {
    if (lc.includes(key)) return val;
  }
  return '📦';
}

/* ── Stat card ── */
function StatCard({ icon: Icon, iconBg, label, amount, color }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, background: 'var(--surface)', borderRadius: 16, padding: '16px 14px', border: '1px solid var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{formatINR(amount || 0)}</div>
    </div>
  );
}

/* ── Recent transaction row — clean, no broken icons ── */
function TxnRow({ tx, isLast }) {
  const isExpense  = tx.type === 'expense';
  const isIncome   = tx.type === 'income';
  const catName    = tx.categories?.name || 'Other';
  const emoji      = resolveCategoryEmoji(catName);
  // Primary display: merchant/party if set, otherwise category name
  const title      = tx.merchant || tx.party || catName;
  const dateLabel  = formatDate(tx.transaction_date, 'relative');
  const sign       = isIncome ? '+' : isExpense ? '−' : '';
  const amtColor   = isIncome ? COLORS.income : isExpense ? COLORS.expense : 'var(--text-primary)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 18px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      {/* Emoji icon — strictly capped, overflow hidden */}
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        backgroundColor: isIncome ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, lineHeight: 1,
        overflow: 'hidden', // prevents any text overflow
      }}>
        {emoji}
      </div>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {catName} · {dateLabel}
        </div>
      </div>

      {/* Amount */}
      <div style={{ fontSize: 15, fontWeight: 700, color: amtColor, flexShrink: 0, letterSpacing: '-0.01em' }}>
        {sign}{formatINR(tx.amount)}
      </div>
    </div>
  );
}

/* ── Category bar row ── */
function CategoryBar({ name, amount, maxAmount }) {
  const pct = maxAmount > 0 ? Math.min((amount / maxAmount) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatINR(amount)}</span>
      </div>
      <div style={{ height: 5, backgroundColor: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: COLORS.gold, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function Dashboard({ refreshKey }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [monthlySummary, setMonthlySummary] = useState(null);
  const [recentTxns, setRecentTxns] = useState(null);
  const [topCategories, setTopCategories] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [error, setError] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const displayYear  = now.getFullYear();
  const displayMonth = now.getMonth() + 1 + monthOffset;
  // normalise month overflow
  const d = new Date(displayYear, displayMonth - 1, 1);
  const yr  = d.getFullYear();
  const mo  = d.getMonth() + 1;
  const monthStart = `${yr}-${String(mo).padStart(2,'0')}-01`;
  const monthEnd   = new Date(yr, mo, 0).toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchData() {
      try {
        const [monthlyRes, txnRes, budgetRes] = await Promise.all([
          supabase.rpc('get_monthly_summary', { p_year: yr, p_month: mo }),
          supabase
            .from('transactions')
            .select('*, categories(name, icon, color)')
            .eq('user_id', user.id)
            .gte('transaction_date', monthStart)
            .lte('transaction_date', monthEnd)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('budgets').select('amount').eq('user_id', user.id),
        ]);

        if (cancelled) return;

        setMonthlySummary(
          typeof monthlyRes.data === 'string'
            ? JSON.parse(monthlyRes.data)
            : monthlyRes.data
        );
        setRecentTxns(txnRes.data || []);

        const budget = (budgetRes.data || []).reduce((s, b) => s + Number(b.amount), 0);
        setTotalBudget(budget);

        // Compute top spending categories from monthly txns
        const allMonthTxns = (await supabase
          .from('transactions')
          .select('type, amount, categories(name)')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('transaction_date', monthStart)
          .lte('transaction_date', monthEnd)
        ).data || [];

        const catMap = {};
        for (const t of allMonthTxns) {
          const name = t.categories?.name || 'Other';
          catMap[name] = (catMap[name] || 0) + Number(t.amount);
        }
        const sorted = Object.entries(catMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, amount]) => ({ name, amount }));
        setTopCategories(sorted);

      } catch (err) {
        if (!cancelled) setError(err.message);
        console.error('Dashboard fetch error:', err);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [user, refreshKey, yr, mo]);

  const summary = monthlySummary || {};
  const income   = Number(summary.total_income  || 0);
  const expenses = Number(summary.total_expenses || 0);
  const savings  = income - expenses;
  const monthLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const maxCat   = topCategories[0]?.amount || 1;

  const firstName = (profile?.full_name || '').split(' ')[0] || 'there';

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* ── Navy hero ── */}
      <div style={{
        background: `linear-gradient(160deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 100%)`,
        borderRadius: '0 0 28px 28px',
        padding: '20px 20px 32px',
        marginBottom: -16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{getGreeting()}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginTop: 2 }}>{firstName}</div>
          </div>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setMonthOffset(o => o - 1)}
              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
              disabled={monthOffset === 0}
              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: monthOffset === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)', color: monthOffset === 0 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: monthOffset === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
        </div>

        {/* Net balance hero */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Net Cash Flow</div>
          {monthlySummary === null ? (
            <Skeleton height="48px" width="180px" style={{ margin: '0 auto', borderRadius: 12 }} />
          ) : (
            <div style={{ fontSize: 44, fontWeight: 800, color: savings >= 0 ? COLORS.goldLight : '#fca5a5', letterSpacing: '-0.03em' }}>
              {savings >= 0 ? '+' : '−'}{formatINR(Math.abs(savings))}
            </div>
          )}
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{monthLabel}</div>
        </div>

        {/* Budget bar if configured */}
        {totalBudget > 0 && expenses > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{Math.round((expenses/totalBudget)*100)}% spent</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                {expenses > totalBudget ? '−' : ''}{formatINR(Math.abs(totalBudget - expenses))} {expenses > totalBudget ? 'over' : 'remaining'}
              </span>
            </div>
            <div style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min((expenses/totalBudget)*100,100)}%`, backgroundColor: expenses > totalBudget ? '#EF4444' : COLORS.gold, borderRadius: 99 }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'flex', gap: 10, padding: '24px 16px 0' }}>
        <StatCard icon={TrendingUp}   iconBg="rgba(16,185,129,0.12)"  label="Income"   amount={income}   color={COLORS.income}  />
        <StatCard icon={TrendingDown} iconBg="rgba(239,68,68,0.10)"   label="Expenses" amount={expenses} color={COLORS.expense} />
        <StatCard icon={ArrowRight}   iconBg="rgba(59,130,246,0.10)"  label="Savings"  amount={savings}  color={savings >= 0 ? COLORS.income : COLORS.expense} />
      </div>

      {/* ── Recent Transactions ── */}
      <div style={{ padding: '28px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recent Transactions</h2>
          <button onClick={() => navigate('/transactions')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: COLORS.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            See all <ChevronRight size={14} />
          </button>
        </div>

        {recentTxns === null ? (
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '8px 0' }}>
            <SkeletonRows n={5} />
          </div>
        ) : recentTxns.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No transactions yet this month
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {recentTxns.map((tx, i) => (
              <TxnRow key={tx.id} tx={tx} isLast={i === recentTxns.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* ── Top Categories ── */}
      {topCategories.length > 0 && (
        <div style={{ padding: '28px 16px 0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Top Categories</h2>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '18px 18px 4px' }}>
            {topCategories.map(cat => (
              <CategoryBar key={cat.name} name={cat.name} amount={cat.amount} maxAmount={maxCat} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
