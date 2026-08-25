import React, { useState, useEffect } from 'react';
import {
  Shield, Users, ArrowUpDown, Tag, Activity, FileText, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader } from '../components/Card';
import Badge from '../components/Badge';
import { Skeleton, SkeletonRows, SkeletonCards } from '../components/Skeleton';
import { formatDate } from '../lib/money';

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <Card style={{ flex: '1 1 0', minWidth: '140px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <Icon size={18} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
      {loading ? (
        <Skeleton height="32px" width="60%" />
      ) : (
        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value != null ? value.toLocaleString() : '--'}
        </div>
      )}
    </Card>
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
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '1px solid var(--border-strong)',
};

const tableCellStyle = {
  padding: '10px 12px',
  fontSize: '13px',
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
};

export default function Admin() {
  const { isAdmin, adminLoading } = useAuth();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;

    async function fetchAdminData() {
      // Fetch stats
      try {
        const { data, error: err } = await supabase.rpc('admin_stats');
        if (!cancelled) {
          if (err) {
            console.error('Stats error:', err);
            setStats(null);
          } else {
            setStats(data);
          }
        }
      } catch (err) {
        console.error('Stats fetch error:', err);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }

      // Fetch recent activity
      try {
        const { data, error: err } = await supabase.rpc('admin_recent_activity', { p_limit: 20 });
        if (!cancelled) {
          if (err) {
            console.error('Activity error:', err);
            setActivity([]);
          } else {
            setActivity(data || []);
          }
        }
      } catch (err) {
        console.error('Activity fetch error:', err);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }

      // Fetch audit log
      try {
        const { data, error: err } = await supabase
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (!cancelled) {
          if (err) {
            console.error('Audit error:', err);
            setAuditLog([]);
          } else {
            setAuditLog(data || []);
          }
        }
      } catch (err) {
        console.error('Audit fetch error:', err);
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    }

    fetchAdminData();
    return () => { cancelled = true; };
  }, [isAdmin, adminLoading]);

  // Loading state while checking admin status
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

  // Access denied
  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: '16px', padding: '20px',
      }}>
        <Shield size={48} style={{ color: 'var(--text-muted)' }} />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Access Denied
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>
          You do not have admin privileges to access this page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Shield size={24} style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Admin Console
        </h1>
      </div>

      {/* Stats cards */}
      <div style={{
        display: 'flex', gap: '16px', marginBottom: '24px',
        flexWrap: 'wrap',
      }}>
        <StatCard icon={Users} label="Total Users" value={stats?.total_users} loading={statsLoading} />
        <StatCard icon={ArrowUpDown} label="Total Transactions" value={stats?.total_transactions} loading={statsLoading} />
        <StatCard icon={Tag} label="Total Categories" value={stats?.total_categories} loading={statsLoading} />
      </div>

      {/* Recent Activity */}
      <div style={{ marginBottom: '24px' }}>
        <Card>
          <CardHeader
            title="Recent Activity"
            action={<Activity size={18} style={{ color: 'var(--text-muted)' }} />}
          />
          {activityLoading ? (
            <SkeletonRows n={5} />
          ) : activity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              No recent activity
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
                      <td style={tableCellStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {maskEmail(item.email)}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <Badge variant={item.action === 'signup' ? 'success' : 'default'}>
                          {item.action}
                        </Badge>
                      </td>
                      <td style={{ ...tableCellStyle, color: 'var(--text-muted)', fontSize: '12px' }}>
                        {formatTimestamp(item.created_at || item.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Audit Log */}
      <div style={{ marginBottom: '24px' }}>
        <Card>
          <CardHeader
            title="Audit Log"
            action={<FileText size={18} style={{ color: 'var(--text-muted)' }} />}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
            Audit log stores NO financial values in metadata (per spec).
          </p>
          {auditLoading ? (
            <SkeletonRows n={5} />
          ) : auditLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              No audit log entries
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
                      <td style={{ ...tableCellStyle, fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {truncateId(entry.user_id)}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <Badge variant={
                          entry.action === 'INSERT' ? 'success' :
                          entry.action === 'DELETE' ? 'danger' :
                          entry.action === 'UPDATE' ? 'warning' :
                          'default'
                        }>
                          {entry.action}
                        </Badge>
                      </td>
                      <td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: '12px' }}>
                        {entry.table_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
