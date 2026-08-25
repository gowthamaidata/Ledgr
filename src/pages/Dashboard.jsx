import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader } from '../components/Card';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import { formatINR, formatMonth, formatDate, todayISO } from '../lib/money';
import { dailySummaryText, getTopCategories } from '../lib/insights';

/* ── CSS Variables ──────────────────────────────────────────────── */
const COLORS = {
  navy: '#0F1729',
  navyLight: '#1A2540',
  navyMid: '#152036',
  gold: '#D4A853',
  goldLight: '#E8C97A',
  income: '#10B981',
  expense: '#EF4444',
  accent: '#3B82F6',
};

/* ── Greeting helper ────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Avatar with gold gradient ring ─────────────────────────────── */
function GoldAvatar({ name }) {
  const initial = (name || '?')[0].toUpperCase();
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.navy }}>{initial}</span>
    </div>
  );
}

/* ── Stat card (Income / Expenses / Savings) ────────────────────── */
function StatCard({ icon, label, amount, color }) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        background: 'var(--surface)',
        borderRadius: 16,
        padding: '18px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {amount}
        </div>
      </div>
    </div>
  );
}

/* ── Category icon map (emoji fallback) ─────────────────────────── */
const CATEGORY_ICONS = {
  food: '🍔',
  transport: '🚗',
  shopping: '🛍️',
  entertainment: '🎬',
  health: '🏥',
  bills: '💱',
  education: '🎓',
  travel: '✈️',
  salary: '💰',
  investment: '📈',
  default: '💳',
};

function getCategoryEmoji(categoryName, icon) {
  if (icon) return icon;
  if (!categoryName) return CATEGORY_ICONS.default;
  const key = categoryName.toLowerCase();
  return CATEGORY_ICONS[key] || CATEGORY_ICONS.default;
}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function Dashboard({ refreshKey }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [todaySummary, setTodaySummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [recentTxns, setRecentTxns] = useState(null);
  const [topCategories, setTopCategories] = useState(null);
  const [totalBudget, setTotalBudget] = useState(0);
  const [error, setError] = useState(null);

  /* ── Data fetching ────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchData() {
      try {
        const [todayRes, monthlyRes, txnRes, budgetRes] = await Promise.all([
          supabase.rpc('get_today_summary'),
          supabase.rpc('get_monthly_summary'),
          supabase
            .from('transactions')
            .select('*, categories(name, icon, color)')
            .eq('user_id', user.id)
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('budgets').select('amount').eq('user_id', user.id),
        ]);

        if (cancelled) return;

        if (todayRes.error) throw todayRes.error;
        if (monthlyRes.error) throw monthlyRes.error;
        if (txnRes.error) throw txnRes.error;

        setTodaySummary(todayRes.data);
        setMonthlySummary(monthlyRes.data);
        setRecentTxns(txnRes.data || []);

        // Sum user's budgets for the budget bar
        const budgetTotal = (budgetRes.data || []).reduce((s, b) => s + Number(b.amount || 0), 0);
        setTotalBudget(budgetTotal);

        // Fetch monthly transactions for top categories
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0];

        const { data: monthTxns } = await supabase
          .from('transactions')
          .select('type, amount, categories(name)')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('transaction_date', monthStart)
          .lte('transaction_date', monthEnd);

        if (cancelled) return;

        if (monthTxns) {
          const mapped = monthTxns.map((t) => ({
            type: t.type,
            amount: t.amount,
            category_name: t.categories?.name || 'Uncategorized',
          }));
          setTopCategories(getTopCategories(mapped, 3));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Dashboard fetch error:', err);
          setError('Failed to load dashboard data');
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  /* ── Error state ────────────────────────────────────────────── */
  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        {error}
      </div>
    );
  }

  /* ── Derived values ─────────────────────────────────────────── */
  const monthlyIncome = Number(monthlySummary?.total_income || 0);
  const monthlyExpense = Number(monthlySummary?.total_expenses || monthlySummary?.total_expense || 0);
  const monthlySavings = monthlyIncome - monthlyExpense;
  const monthlyBalance = monthlyIncome - monthlyExpense;
  const budget = totalBudget;
  const progressPct = budget > 0 ? Math.min((monthlyExpense / budget) * 100, 100) : 0;
  const displayName = profile?.full_name || 'there';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ═══ NAVY HEADER SECTION ═══════════════════════════════════ */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 100%)`,
          padding: '28px 20px 80px 20px',
          margin: '-16px -16px 0 -16px',
          borderRadius: '0 0 32px 32px',
        }}
      >
        {/* Greeting row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
              {getGreeting()},
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>
              {displayName}
            </div>
          </div>
          <GoldAvatar name={displayName} />
        </div>

        {/* ═══ HERO BALANCE CARD ═══════════════════════════════════ */}
        <div
          style={{
            background: `linear-gradient(145deg, ${COLORS.navyMid} 0%, ${COLORS.navyLight} 100%)`,
            borderRadius: 20,
            padding: '24px 22px',
            border: `1px solid rgba(212, 168, 83, 0.15)`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}
        >
          {!monthlySummary ? (
            <div>
              <Skeleton height="14px" width="40%" style={{ marginBottom: 12, opacity: 0.3 }} />
              <Skeleton height="40px" width="60%" style={{ marginBottom: 8, opacity: 0.3 }} />
              <Skeleton height="12px" width="50%" style={{ opacity: 0.3 }} />
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 500,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Monthly Balance
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  lineHeight: 1.1,
                  marginBottom: 6,
                }}
              >
                {formatINR(monthlyBalance)}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 20,
                }}
              >
                of {formatINR(budget)} budget
              </div>

              {/* Gold progress bar */}
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    borderRadius: 4,
                    background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                <span>{Math.round(progressPct)}% spent</span>
                <span>{formatINR(budget - monthlyExpense)} remaining</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ STAT CARDS ROW ════════════════════════════════════════ */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: -44,
          padding: '0 4px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {!monthlySummary ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flex: '1 1 0',
                  background: 'var(--surface)',
                  borderRadius: 16,
                  padding: '18px 14px',
                  border: '1px solid var(--border)',
                }}
              >
                <Skeleton height="36px" width="36px" style={{ borderRadius: 10, marginBottom: 10 }} />
                <Skeleton height="10px" width="60%" style={{ marginBottom: 6 }} />
                <Skeleton height="16px" width="80%" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard
              icon={<TrendingUp size={18} color={COLORS.income} />}
              label="Income"
              amount={formatINR(monthlyIncome)}
              color={COLORS.income}
            />
            <StatCard
              icon={<TrendingDown size={18} color={COLORS.expense} />}
              label="Expenses"
              amount={formatINR(monthlyExpense)}
              color={COLORS.expense}
            />
            <StatCard
              icon={<ArrowRight size={18} color={COLORS.accent} />}
              label="Savings"
              amount={formatINR(monthlySavings)}
              color={COLORS.accent}
            />
          </>
        )}
      </div>

      {/* ═══ RECENT TRANSACTIONS ═══════════════════════════════════ */}
      <div style={{ marginTop: 24, padding: '0 2px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Recent Transactions
          </span>
          <button
            onClick={() => navigate('/transactions')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: COLORS.gold,
              fontWeight: 600,
              padding: 0,
              fontFamily: 'inherit',
            }}
          >
            See all
            <ChevronRight size={14} />
          </button>
        </div>

        {!recentTxns ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 16,
              border: '1px solid var(--border)',
            }}
          >
            <SkeletonRows n={4} gap={16} />
          </div>
        ) : recentTxns.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 14,
              border: '1px solid var(--border)',
            }}
          >
            No transactions yet
          </div>
        ) : (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            {recentTxns.map((tx, idx) => {
              const isExpense = tx.type === 'expense';
              const category = tx.categories;
              const emoji = getCategoryEmoji(category?.name, category?.icon);
              const displayName = tx.merchant || tx.party || category?.name || 'Uncategorized';
              const categoryLabel = category?.name || 'Uncategorized';

              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    borderBottom: idx < recentTxns.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Emoji icon */}
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: isExpense
                        ? 'rgba(239,68,68,0.08)'
                        : 'rgba(16,185,129,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {emoji}
                  </div>

                  {/* Name & category */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {displayName}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 2,
                      }}
                    >
                      {categoryLabel}
                      {' · '}
                      {formatDate(tx.transaction_date, 'relative')}
                    </div>
                  </div>

                  {/* Amount */}
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: isExpense ? COLORS.expense : COLORS.income,
                      flexShrink: 0,
                    }}
                  >
                    {isExpense ? '-' : '+'}
                    {formatINR(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ TOP CATEGORIES (preserved) ════════════════════════════ */}
      <div style={{ marginTop: 24, padding: '0 2px', paddingBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            Top Categories
          </span>
        </div>
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 16,
            padding: '18px 18px',
            border: '1px solid var(--border)',
          }}
        >
          {!topCategories ? (
            <SkeletonRows n={3} />
          ) : topCategories.length === 0 ? (
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '12px 0',
              }}
            >
              No expense data yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {topCategories.map((cat) => {
                const maxTotal = topCategories[0].total;
                const pct = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          color: 'var(--text-secondary)',
                          fontWeight: 500,
                        }}
                      >
                        {cat.name}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                        }}
                      >
                        {formatINR(cat.total)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(212,168,83,0.12)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 3,
                          background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.goldLight})`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
