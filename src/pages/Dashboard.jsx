import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader } from '../components/Card';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import { formatINR, formatMonth, formatDate, todayISO } from '../lib/money';
import { dailySummaryText, getTopCategories } from '../lib/insights';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [todaySummary, setTodaySummary] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [recentTxns, setRecentTxns] = useState(null);
  const [topCategories, setTopCategories] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchData() {
      try {
        const [todayRes, monthlyRes, txnRes] = await Promise.all([
          supabase.rpc('get_today_summary'),
          supabase.rpc('get_monthly_summary'),
          supabase
            .from('transactions')
            .select('*, categories(name, icon, color)')
            .order('transaction_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (cancelled) return;

        if (todayRes.error) throw todayRes.error;
        if (monthlyRes.error) throw monthlyRes.error;
        if (txnRes.error) throw txnRes.error;

        setTodaySummary(todayRes.data);
        setMonthlySummary(monthlyRes.data);
        setRecentTxns(txnRes.data || []);

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
  }, [user]);

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Today Summary */}
      <Card>
        <CardHeader title="Today" />
        {!todaySummary ? (
          <div>
            <Skeleton height="36px" width="50%" style={{ marginBottom: '8px' }} />
            <Skeleton height="14px" width="70%" />
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
                marginBottom: '6px',
              }}
            >
              {formatINR(todaySummary.total_spent || 0)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {todaySummary.transaction_count > 0 && (
                <span>
                  {todaySummary.transaction_count} transaction
                  {todaySummary.transaction_count !== 1 ? 's' : ''}
                  {' · '}
                </span>
              )}
              {dailySummaryText(
                todaySummary.total_spent,
                todaySummary.daily_average,
                todaySummary.transaction_count
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Monthly Overview */}
      <Card>
        <CardHeader title={formatMonth(todayISO()) || 'This Month'} />
        {!monthlySummary ? (
          <SkeletonRows n={3} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--income)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Income</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--income)' }}>
                {formatINR(monthlySummary.total_income || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--expense)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Expense</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--expense)' }}>
                {formatINR(monthlySummary.total_expense || 0)}
              </span>
            </div>
            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Net
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color:
                    Number(monthlySummary.net || 0) >= 0 ? 'var(--income)' : 'var(--expense)',
                }}
              >
                {formatINR(monthlySummary.net || 0, { sign: true })}
              </span>
            </div>
            {monthlySummary.transaction_count > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {monthlySummary.transaction_count} transactions this month
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader
          title="Recent Transactions"
          action={
            <button
              onClick={() => navigate('/transactions')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--accent)',
                fontWeight: 500,
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              See all
              <ChevronRight size={14} />
            </button>
          }
        />
        {!recentTxns ? (
          <SkeletonRows n={4} gap={16} />
        ) : recentTxns.length === 0 ? (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            No transactions yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {recentTxns.map((tx) => {
              const isExpense = tx.type === 'expense';
              const category = tx.categories;
              const icon = category?.icon || '';
              const displayName = tx.party || category?.name || 'Uncategorized';

              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: isExpense ? 'var(--expense-light)' : 'var(--income-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0,
                    }}
                  >
                    {icon || (isExpense ? '−' : '+')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {displayName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatDate(tx.transaction_date, 'relative')}
                      {category?.name && tx.party ? ` · ${category.name}` : ''}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isExpense ? 'var(--expense)' : 'var(--income)',
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
      </Card>

      {/* Top Categories */}
      <Card>
        <CardHeader title="Top Categories" />
        {!topCategories ? (
          <SkeletonRows n={3} />
        ) : topCategories.length === 0 ? (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            No expense data yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {topCategories.map((cat, i) => {
              const maxTotal = topCategories[0].total;
              const pct = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
              return (
                <div key={cat.name}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatINR(cat.total)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: 'var(--surface-muted)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: '3px',
                        backgroundColor: 'var(--accent)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
