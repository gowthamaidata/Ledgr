import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Users, ArrowUpDown, Activity, FileText, Loader2,
  Search, ChevronLeft, ChevronRight, X, Copy, Check, Mail,
  Calendar, Clock, Key, Eye, EyeOff, TrendingDown, TrendingUp,
  Wallet, Target, CheckCircle, AlertCircle, RefreshCw, ExternalLink,
  Filter, Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import { formatINR, formatDate } from '../lib/money';

const NAVY = '#0F1729';
const GOLD = '#D4A853';
const GOLD_LIGHT = '#E8C97A';

/* ── Helpers ─────────────────────────────────────────────── */
function fmt(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
}
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ts; }
}

/* ── CopyButton ──────────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--income)' : 'var(--text-muted)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
      title="Copy">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/* ── StatMini card ───────────────────────────────────────── */
function MiniStat({ label, value, sub, color }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 100, backgroundColor: 'var(--bg)', borderRadius: 12, padding: '14px 12px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ── User Details Modal ──────────────────────────────────── */
function UserDetailModal({ user: u, onClose }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPass, setShowTempPass] = useState(false);
  const [settingPass, setSettingPass] = useState(false);
  const [passMsg, setPassMsg] = useState(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

  useEffect(() => {
    async function load() {
      setStatsLoading(true);
      setTxLoading(true);
      try {
        // Fetch user financial stats
        const [txRes, budgetRes, accountRes] = await Promise.all([
          supabase.from('transactions').select('type, amount').eq('user_id', u.user_id),
          supabase.from('budgets').select('id').eq('user_id', u.user_id),
          supabase.from('accounts').select('id').eq('user_id', u.user_id),
        ]);

        const txs = txRes.data || [];
        const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);

        setStats({
          total_transactions: txs.length,
          total_expense: totalExpense,
          total_income: totalIncome,
          balance: totalIncome - totalExpense,
          budgets: (budgetRes.data || []).length,
          accounts: (accountRes.data || []).length,
        });
        setStatsLoading(false);

        // Recent transactions
        const { data: recent } = await supabase
          .from('transactions')
          .select('*, categories(name, icon)')
          .eq('user_id', u.user_id)
          .order('transaction_date', { ascending: false })
          .limit(10);
        setTransactions(recent || []);
        setTxLoading(false);
      } catch (err) {
        console.error('User detail load error:', err);
        setStatsLoading(false);
        setTxLoading(false);
      }
    }
    load();
  }, [u.user_id]);

  async function handleSetPassword() {
    if (!tempPassword || tempPassword.length < 8) {
      setPassMsg({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    setSettingPass(true);
    setPassMsg(null);
    try {
      // Call admin RPC to set temporary password
      const { error } = await supabase.rpc('admin_set_temp_password', {
        p_user_id: u.user_id,
        p_password: tempPassword,
      });
      if (error) throw error;
      setPassMsg({ type: 'success', text: 'Temporary password set. Share it securely with the user.' });
      setTempPassword('');
      // Audit log
      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user.id,
        action: 'admin_set_temp_password',
        entity_type: 'user',
        entity_id: u.user_id,
        metadata: { target_email: u.email },
      }).catch(() => {});
    } catch (err) {
      setPassMsg({ type: 'error', text: err.message || 'Failed to set password' });
    } finally {
      setSettingPass(false);
    }
  }

  async function handleSendReset() {
    setSendingReset(true);
    setResetMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetMsg({ type: 'success', text: 'Password reset email sent successfully.' });
      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user.id,
        action: 'admin_send_password_reset',
        entity_type: 'user',
        entity_id: u.user_id,
        metadata: { target_email: u.email },
      }).catch(() => {});
    } catch (err) {
      setResetMsg({ type: 'error', text: err.message || 'Failed to send reset email' });
    } finally {
      setSendingReset(false);
    }
  }

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'security', label: 'Security' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 560, maxHeight: '90vh', backgroundColor: 'var(--surface)',
        borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: NAVY, flexShrink: 0 }}>
                {(u.full_name || u.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{u.full_name || 'Unnamed'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <CheckCircle size={12} style={{ color: 'var(--income)' }} />
                  <span style={{ fontSize: 12, color: 'var(--income)', fontWeight: 500 }}>Email confirmed</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 8 }}>
              <X size={20} />
            </button>
          </div>

          {/* Status badge */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge variant={u.onboarding_completed ? 'success' : 'warning'}>
              {u.onboarding_completed ? '● Active' : '● Onboarding'}
            </Badge>
            {u.role && <Badge variant="accent">{u.role}</Badge>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 500, fontFamily: 'inherit',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.key ? `2px solid ${GOLD}` : '2px solid transparent',
                transition: 'color 0.15s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              {/* Account Info */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>ACCOUNT</div>
                <div style={{ backgroundColor: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {[
                    { icon: Mail, label: 'Email', value: u.email, copyable: true },
                    { icon: Calendar, label: 'Joined', value: fmt(u.created_at) },
                    { icon: Clock, label: 'Last active', value: u.last_active ? fmt(u.last_active) : 'Never' },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <row.icon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
                      {row.copyable && <CopyButton text={row.value} />}
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                    <Key size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', width: 80, flexShrink: 0 }}>User ID</span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.user_id}</span>
                    <CopyButton text={u.user_id} />
                  </div>
                </div>
              </div>

              {/* Finance Stats */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>FINANCE OVERVIEW</div>
                {statsLoading ? (
                  <div style={{ display: 'flex', gap: 10 }}><Skeleton height="72px" style={{ flex: 1, borderRadius: 12 }} /><Skeleton height="72px" style={{ flex: 1, borderRadius: 12 }} /><Skeleton height="72px" style={{ flex: 1, borderRadius: 12 }} /></div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      <MiniStat label="Transactions" value={stats?.total_transactions?.toLocaleString()} />
                      <MiniStat label="Accounts" value={stats?.accounts} />
                      <MiniStat label="Budgets" value={stats?.budgets} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <MiniStat label="Total Income" value={formatINR(stats?.total_income)} color="var(--income)" />
                      <MiniStat label="Total Expenses" value={formatINR(stats?.total_expense)} color="var(--expense)" />
                      <MiniStat label="Net Balance" value={formatINR(stats?.balance)} color={stats?.balance >= 0 ? 'var(--income)' : 'var(--expense)'} />
                    </div>
                  </>
                )}
              </div>

              {/* Transaction count badge */}
              {!statsLoading && (
                <button onClick={() => setActiveTab('transactions')}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 12, backgroundColor: 'var(--bg)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Eye size={14} />
                  View Finance Data (Read-only)
                </button>
              )}
            </>
          )}

          {/* TRANSACTIONS TAB */}
          {activeTab === 'transactions' && (
            <>
              <div style={{ padding: '8px 0 16px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <Eye size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <span style={{ color: 'var(--warning)', fontWeight: 500 }}>Support Mode — Read-only view of {u.full_name || u.email}'s data</span>
              </div>
              {txLoading ? <SkeletonRows n={5} /> : transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>No transactions yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {transactions.map(tx => {
                    const catName = tx.categories?.name || 'Uncategorized';
                    const isExpense = tx.type === 'expense';
                    const isIncome = tx.type === 'income';
                    return (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{tx.party || catName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{catName} · {formatDate(tx.transaction_date, 'short')}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isIncome ? 'var(--income)' : isExpense ? 'var(--expense)' : 'var(--text-muted)', flexShrink: 0 }}>
                          {isIncome ? '+' : isExpense ? '-' : ''}{formatINR(tx.amount)}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }}>
                    Showing last 10 transactions
                  </div>
                </div>
              )}
            </>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>PASSWORD</div>
                <div style={{ backgroundColor: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Their current password cannot be shown — Supabase stores only a one-way hash of it, so nobody can read it back. You can send a password reset email or set a temporary password.
                </div>

                {/* Send reset email */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Send Password Reset Email</div>
                  <button onClick={handleSendReset} disabled={sendingReset}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', cursor: sendingReset ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', color: 'var(--text-primary)', opacity: sendingReset ? 0.6 : 1 }}>
                    {sendingReset ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={14} />}
                    {sendingReset ? 'Sending…' : `Send reset to ${u.email}`}
                  </button>
                  {resetMsg && (
                    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, backgroundColor: resetMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', fontSize: 12, color: resetMsg.type === 'success' ? 'var(--income)' : 'var(--expense)' }}>
                      {resetMsg.text}
                    </div>
                  )}
                </div>

                {/* Set temporary password */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Set Temporary Password</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input type={showTempPass ? 'text' : 'password'} value={tempPassword}
                        onChange={e => setTempPassword(e.target.value)} placeholder="New temporary password"
                        style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                      <button onClick={() => setShowTempPass(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        {showTempPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button onClick={handleSetPassword} disabled={settingPass || tempPassword.length < 8}
                      style={{ padding: '10px 16px', borderRadius: 10, border: 'none', backgroundColor: NAVY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: settingPass || tempPassword.length < 8 ? 'not-allowed' : 'pointer', opacity: settingPass || tempPassword.length < 8 ? 0.5 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      {settingPass ? '…' : 'Set password'}
                    </button>
                  </div>
                  {passMsg && (
                    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, backgroundColor: passMsg.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', fontSize: 12, color: passMsg.type === 'success' ? 'var(--income)' : 'var(--expense)' }}>
                      {passMsg.text}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Admin Stats Card ─────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 140, backgroundColor: 'var(--surface)', borderRadius: 14, padding: '18px 16px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={16} style={{ color: GOLD }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      {loading ? <Skeleton height="28px" width="60%" /> : (
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{value != null ? value.toLocaleString() : '--'}</div>
      )}
    </div>
  );
}

/* ── Users Tab ───────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [searchDebounced]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let result;
      if (searchDebounced.trim()) {
        result = await supabase.rpc('admin_search_users', { p_query: searchDebounced.trim() });
      } else {
        result = await supabase.rpc('admin_list_users', { p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE });
      }
      if (result.error) throw result.error;
      setUsers(result.data || []);
    } catch (err) {
      console.error('Users fetch:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type="text" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 16px 10px 36px', borderRadius: 12, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      {loading ? <SkeletonRows n={6} /> : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          {searchDebounced ? 'No users found' : 'No users yet'}
        </div>
      ) : (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg)' }}>
                  {['Name', 'Email', 'Joined', 'Txns', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.user_id || i} style={{ cursor: 'pointer', transition: 'background-color 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => setSelectedUser(u)}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12, borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>{u.email}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>{fmtDate(u.created_at)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>{u.transaction_count != null ? Number(u.transaction_count).toLocaleString() : '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <Badge variant={u.onboarding_completed ? 'success' : 'warning'}>{u.onboarding_completed ? 'Active' : 'Onboarding'}</Badge>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>Details →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!searchDebounced && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === 0 ? 0.5 : 1 }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page + 1}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={users.length < PAGE_SIZE}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', cursor: users.length < PAGE_SIZE ? 'not-allowed' : 'pointer', color: users.length < PAGE_SIZE ? 'var(--text-muted)' : 'var(--text-primary)', opacity: users.length < PAGE_SIZE ? 0.5 : 1 }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}

/* ── All Transactions Tab ─────────────────────────────────── */
function AllTransactionsTab() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDeb, setSearchDeb] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  useEffect(() => {
    const t = setTimeout(() => setSearchDeb(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [searchDeb, typeFilter]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Try admin RPC first (for cross-user admin access)
      const { data, error } = await supabase.rpc('admin_list_all_transactions', {
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_type: typeFilter === 'all' ? null : typeFilter,
        p_search: searchDeb.trim() || null,
      });

      if (error) {
        // Fallback: RPC may not exist yet, use direct query (own txns only)
        console.warn('Admin RPC not available, falling back to own txns:', error.message);
        const { data: fallback } = await supabase
          .from('transactions')
          .select('*, categories(name), accounts(name)')
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        setTransactions((fallback || []).map(t => ({
          ...t,
          category_name: t.categories?.name,
          account_name: t.accounts?.name,
        })));
      } else {
        setTransactions((data || []).map(t => ({
          ...t,
          category_name: t.category_name,
          account_name: t.account_name,
          categories: { name: t.category_name },
          accounts: { name: t.account_name },
        })));
        setTotal(data?.length || 0);
      }
    } catch (err) {
      console.error('All txns:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchDeb, typeFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = transactions;

  const TYPE_COLORS = { expense: 'var(--expense)', income: 'var(--income)', transfer: 'var(--accent)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filters row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input type="text" placeholder="Search party, notes, category…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--bg)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
          {['all', 'expense', 'income', 'transfer'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: '6px 12px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: typeFilter === t ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', backgroundColor: typeFilter === t ? 'var(--surface)' : 'transparent', color: typeFilter === t ? TYPE_COLORS[t] || 'var(--text-primary)' : 'var(--text-muted)', boxShadow: typeFilter === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? <SkeletonRows n={8} /> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>No transactions found</div>
      ) : (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg)' }}>
                  {['Date', 'Type', 'Category', 'Party', 'Note', 'Account', 'Amount'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr key={tx.id} style={{ transition: 'background-color 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12, borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', whiteSpace: 'nowrap' }}>{formatDate(tx.transaction_date, 'short')}</td>
                    <td style={{ padding: '10px 14px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLORS[tx.type] || 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tx.type}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>{tx.categories?.name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 500, borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.party || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12, borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', whiteSpace: 'nowrap' }}>{tx.accounts?.name || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: TYPE_COLORS[tx.type] || 'var(--text-primary)', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatINR(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} transactions shown</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 12, color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: page === 0 ? 0.5 : 1 }}>
            <ChevronLeft size={13} /> Prev
          </button>
          <button onClick={() => setPage(p => p + 1)} disabled={transactions.length < PAGE_SIZE}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', cursor: transactions.length < PAGE_SIZE ? 'not-allowed' : 'pointer', fontSize: 12, color: transactions.length < PAGE_SIZE ? 'var(--text-muted)' : 'var(--text-primary)', opacity: transactions.length < PAGE_SIZE ? 0.5 : 1 }}>
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Activity Tab ────────────────────────────────────────── */
function ActivityTab() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.rpc('admin_recent_activity', { p_limit: 30 });
        setActivity(data || []);
      } catch (err) {
        console.error('Activity:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <SkeletonRows n={8} />;
  if (!activity.length) return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>No recent activity</div>;

  return (
    <div style={{ backgroundColor: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg)' }}>
            {['User', 'Action', 'Time'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activity.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'monospace', borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none' }}>{item.email}</td>
              <td style={{ padding: '10px 14px', borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <Badge variant={item.action === 'signup' ? 'success' : 'default'}>{item.action}</Badge>
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none' }}>{fmt(item.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Audit Tab ───────────────────────────────────────────── */
function AuditTab() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50);
        setLog(data || []);
      } catch (err) {
        console.error('Audit:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <SkeletonRows n={8} />;
  if (!log.length) return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>No audit entries</div>;

  return (
    <div style={{ backgroundColor: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg)' }}>
              {['Time', 'Actor', 'Action', 'Entity'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.map((entry, i) => (
              <tr key={entry.id || i}>
                <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap', borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none' }}>{fmt(entry.created_at)}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none' }}>{entry.user_id?.slice(0, 8)}…</td>
                <td style={{ padding: '10px 14px', borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <Badge variant={['create', 'INSERT'].includes(entry.action) ? 'success' : ['delete', 'DELETE'].includes(entry.action) ? 'danger' : ['update', 'UPDATE'].includes(entry.action) ? 'warning' : 'default'}>
                    {entry.action}
                  </Badge>
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none' }}>{entry.entity_type || entry.table_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main Admin Page ─────────────────────────────────────── */
const TABS = [
  { key: 'overview', label: 'Overview', icon: Shield },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'transactions', label: 'Transactions', icon: ArrowUpDown },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'audit', label: 'Audit Log', icon: FileText },
];

export default function Admin() {
  const { isAdmin, adminLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    async function fetchStats() {
      try {
        const { data } = await supabase.rpc('admin_stats');
        setStats(data);
      } catch (err) {
        console.error('Stats:', err);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, [isAdmin, adminLoading]);

  if (adminLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={24} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>Access Denied</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320 }}>You do not have admin privileges. Contact your system administrator.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 0 80px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${NAVY}, #1A2540)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={22} color={GOLD} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Admin Console</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Manage users, monitor activity, review audit logs</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 2, padding: 4, backgroundColor: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: isActive ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', backgroundColor: isActive ? 'var(--surface)' : 'transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard icon={Users} label="Total Users" value={stats?.total_users} loading={statsLoading} />
            <StatCard icon={ArrowUpDown} label="Transactions" value={stats?.total_transactions} loading={statsLoading} />
            <StatCard icon={Wallet} label="Accounts" value={stats?.total_accounts} loading={statsLoading} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard icon={Users} label="New Today" value={stats?.users_today} loading={statsLoading} />
            <StatCard icon={ArrowUpDown} label="Txns Today" value={stats?.transactions_today} loading={statsLoading} />
            <StatCard icon={Target} label="Categories" value={stats?.total_categories} loading={statsLoading} />
          </div>
        </div>
      )}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'transactions' && <AllTransactionsTab />}
      {activeTab === 'activity' && <ActivityTab />}
      {activeTab === 'audit' && <AuditTab />}
    </div>
  );
}
