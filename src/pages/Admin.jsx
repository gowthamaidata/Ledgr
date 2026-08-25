import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Users, ArrowUpDown, Tag, Activity, FileText, Loader2,
  Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import { Skeleton, SkeletonRows } from '../components/Skeleton';

const NAVY = '#0F1729';
const GOLD = '#D4A853';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Shield },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'audit', label: 'Audit Log', icon: FileText },
];

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 140,
      backgroundColor: 'var(--surface)', borderRadius: 14,
      padding: '18px 16px', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={16} style={{ color: GOLD }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton height="28px" width="60%" />
      ) : (
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>
          {value != null ? value.toLocaleString() : '--'}
        </div>
      )}
    </div>
  );
}

function maskEmail(email) {
  if (!email) return '***';
  const prefix = email.substring(0, 3);
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return prefix + '***';
  return prefix + '***' + email.substring(atIdx);
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

function truncateId(id) {
  if (!id) return '--';
  return id.substring(0, 8) + '...';
}

const tableHeaderStyle = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
  borderBottom: '2px solid var(--border)',
};

const tableCellStyle = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
};

/* ─── Overview Tab ─── */
function OverviewTab({ stats, statsLoading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon={Users} label="Total Users" value={stats?.total_users} loading={statsLoading} />
        <StatCard icon={ArrowUpDown} label="Transactions" value={stats?.total_transactions} loading={statsLoading} />
        <StatCard icon={Tag} label="Categories" value={stats?.total_categories} loading={statsLoading} />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon={Users} label="New Today" value={stats?.users_today} loading={statsLoading} />
        <StatCard icon={ArrowUpDown} label="Txns Today" value={stats?.transactions_today} loading={statsLoading} />
        <StatCard icon={Tag} label="Accounts" value={stats?.total_accounts} loading={statsLoading} />
      </div>
    </div>
  );
}

/* ─── Users Tab ─── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      console.error('Users fetch error:', err);
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
        <Search size={16} style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="Search users by email or name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px 16px 10px 38px', fontSize: 14,
            borderRadius: 12, border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)', color: 'var(--text-primary)',
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Users table */}
      {loading ? (
        <SkeletonRows n={5} />
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
          {searchDebounced ? 'No users found' : 'No users yet'}
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)', overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Email</th>
                <th style={tableHeaderStyle}>Name</th>
                <th style={tableHeaderStyle}>Joined</th>
                <th style={tableHeaderStyle}>Txns</th>
                <th style={tableHeaderStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.user_id || i}>
                  <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 12 }}>
                    {u.email || '--'}
                  </td>
                  <td style={tableCellStyle}>{u.full_name || '--'}</td>
                  <td style={{ ...tableCellStyle, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatTimestamp(u.created_at)}
                  </td>
                  <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                    {u.transaction_count != null ? Number(u.transaction_count).toLocaleString() : '--'}
                  </td>
                  <td style={tableCellStyle}>
                    <Badge variant={u.onboarding_completed ? 'success' : 'warning'}>
                      {u.onboarding_completed ? 'Active' : 'Onboarding'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!searchDebounced && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              opacity: page === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            Page {page + 1}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={users.length < PAGE_SIZE}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--surface)',
              cursor: users.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
              color: users.length < PAGE_SIZE ? 'var(--text-muted)' : 'var(--text-primary)',
              opacity: users.length < PAGE_SIZE ? 0.5 : 1,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Activity Tab ─── */
function ActivityTab() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const { data, error } = await supabase.rpc('admin_recent_activity', { p_limit: 30 });
        if (error) throw error;
        setActivity(data || []);
      } catch (err) {
        console.error('Activity error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) return <SkeletonRows n={8} />;

  if (activity.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
        No recent activity
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', overflowX: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={tableHeaderStyle}>User</th>
            <th style={tableHeaderStyle}>Action</th>
            <th style={tableHeaderStyle}>Time</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((item, i) => (
            <tr key={i}>
              <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 12 }}>
                {maskEmail(item.email)}
              </td>
              <td style={tableCellStyle}>
                <Badge variant={item.action === 'signup' ? 'success' : 'default'}>
                  {item.action}
                </Badge>
              </td>
              <td style={{ ...tableCellStyle, color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                {formatTimestamp(item.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Audit Log Tab ─── */
function AuditTab() {
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setAuditLog(data || []);
      } catch (err) {
        console.error('Audit error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) return <SkeletonRows n={8} />;

  if (auditLog.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>
        No audit log entries
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--surface)', borderRadius: 14,
      border: '1px solid var(--border)', overflowX: 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={tableHeaderStyle}>Timestamp</th>
            <th style={tableHeaderStyle}>User</th>
            <th style={tableHeaderStyle}>Action</th>
            <th style={tableHeaderStyle}>Table</th>
          </tr>
        </thead>
        <tbody>
          {auditLog.map((entry, i) => (
            <tr key={entry.id || i}>
              <td style={{ ...tableCellStyle, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {formatTimestamp(entry.created_at)}
              </td>
              <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 12 }}>
                {truncateId(entry.user_id)}
              </td>
              <td style={tableCellStyle}>
                <Badge variant={
                  (entry.action === 'create' || entry.action === 'INSERT') ? 'success' :
                  (entry.action === 'delete' || entry.action === 'DELETE') ? 'danger' :
                  (entry.action === 'update' || entry.action === 'UPDATE') ? 'warning' :
                  'default'
                }>
                  {entry.action}
                </Badge>
              </td>
              <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 12 }}>
                {entry.entity_type || entry.table_name || '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Admin Page ─── */
export default function Admin() {
  const { isAdmin, adminLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    async function fetchStats() {
      try {
        const { data, error } = await supabase.rpc('admin_stats');
        if (error) throw error;
        setStats(data);
      } catch (err) {
        console.error('Stats error:', err);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, [isAdmin, adminLoading]);

  if (adminLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', color: 'var(--text-muted)',
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: 16, padding: 20,
      }}>
        <Shield size={48} style={{ color: 'var(--text-muted)' }} />
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
          Access Denied
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
          You do not have admin privileges to access this page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 16px 80px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `linear-gradient(135deg, ${NAVY}, #1A2540)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={20} color={GOLD} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Admin Console
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Manage users, monitor activity, review audit logs
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', gap: 4, padding: 4,
        backgroundColor: 'var(--surface-muted, #F3F4F6)',
        borderRadius: 12, marginBottom: 20,
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 12px', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                fontFamily: 'inherit', cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: isActive ? 'var(--surface, #fff)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab stats={stats} statsLoading={statsLoading} />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'activity' && <ActivityTab />}
      {activeTab === 'audit' && <AuditTab />}
    </div>
  );
}
