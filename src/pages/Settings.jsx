import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Palette, Wallet, Tag, Download, AlertTriangle,
  Shield, Plus, Pencil, Trash2, Sun, Moon, Monitor, Save, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Card, CardHeader } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import { formatINR } from '../lib/money';

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

const sectionStyle = { marginBottom: '24px' };

const pillGroupStyle = {
  display: 'flex',
  gap: '4px',
  backgroundColor: 'var(--surface-muted)',
  borderRadius: 'var(--radius)',
  padding: '4px',
};

function PillButton({ active, icon: Icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        fontSize: '13px',
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        backgroundColor: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        opacity: hovered && !active ? 0.8 : 1,
      }}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

function AccountRow({ account, onEdit, onDeactivate }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {account.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {ACCOUNT_TYPES.find(t => t.value === account.type)?.label || account.type}
        </div>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginRight: '12px' }}>
        {formatINR(account.balance)}
      </div>
      {hovered && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(account)} />
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDeactivate(account)}
            style={{ color: 'var(--expense)' }} />
        </div>
      )}
    </div>
  );
}

function CategoryRow({ category, onDeactivate }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <span style={{ fontSize: '18px' }}>{category.icon || '📦'}</span>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {category.name}
        </span>
        {category.color && (
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%',
            backgroundColor: category.color, flexShrink: 0,
          }} />
        )}
      </div>
      {category.usage_count != null && (
        <Badge style={{ marginRight: '8px' }}>{category.usage_count}</Badge>
      )}
      {hovered && (
        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDeactivate(category)}
          style={{ color: 'var(--expense)' }} />
      )}
    </div>
  );
}

export default function Settings() {
  const { user, profile, isAdmin, updateProfile, signOut } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Accounts state
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountModal, setAccountModal] = useState(null); // null | 'add' | account object (edit)
  const [accountForm, setAccountForm] = useState({ name: '', type: 'checking', balance: '' });
  const [accountSaving, setAccountSaving] = useState(false);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense', icon: '', color: '#6366f1' });
  const [categorySaving, setCategorySaving] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Init profile name
  useEffect(() => {
    if (profile?.full_name != null) setFullName(profile.full_name);
  }, [profile]);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    setAccountsLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      toast.error('Failed to load accounts');
      console.error(err);
    } finally {
      setAccountsLoading(false);
    }
  }, [user]);

  // Fetch categories with usage count
  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('type')
        .order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      toast.error('Failed to load categories');
      console.error(err);
    } finally {
      setCategoriesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (user) {
      fetchAccounts();
      fetchCategories();
    }
    return () => { cancelled = true; };
  }, [user, fetchAccounts, fetchCategories]);

  // Profile save
  async function handleSaveProfile() {
    setProfileSaving(true);
    try {
      await updateProfile({ full_name: fullName });
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  }

  // Account modal handlers
  function openAddAccount() {
    setAccountForm({ name: '', type: 'checking', balance: '' });
    setAccountModal('add');
  }

  function openEditAccount(account) {
    setAccountForm({ name: account.name, type: account.type, balance: '' });
    setAccountModal(account);
  }

  async function handleSaveAccount() {
    if (!accountForm.name.trim()) {
      toast.error('Account name is required');
      return;
    }
    setAccountSaving(true);
    try {
      if (accountModal === 'add') {
        const { error } = await supabase.from('accounts').insert({
          user_id: user.id,
          name: accountForm.name.trim(),
          type: accountForm.type,
          balance: parseFloat(accountForm.balance) || 0,
        });
        if (error) throw error;
        toast.success('Account added');
      } else {
        const { error } = await supabase
          .from('accounts')
          .update({ name: accountForm.name.trim(), type: accountForm.type })
          .eq('id', accountModal.id);
        if (error) throw error;
        toast.success('Account updated');
      }
      setAccountModal(null);
      fetchAccounts();
    } catch (err) {
      toast.error('Failed to save account');
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleDeactivateAccount(account) {
    const confirmed = await toast.confirm(
      `Deactivate "${account.name}"? This will hide it from your accounts. Existing transactions will not be affected.`
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', account.id);
      if (error) throw error;
      toast.success('Account deactivated');
      fetchAccounts();
    } catch (err) {
      toast.error('Failed to deactivate account');
    }
  }

  // Category handlers
  function openAddCategory() {
    setCategoryForm({ name: '', type: 'expense', icon: '', color: '#6366f1' });
    setCategoryModal(true);
  }

  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setCategorySaving(true);
    try {
      const { error } = await supabase.from('categories').insert({
        user_id: user.id,
        name: categoryForm.name.trim(),
        type: categoryForm.type,
        icon: categoryForm.icon || '📦',
        color: categoryForm.color,
      });
      if (error) throw error;
      toast.success('Category added');
      setCategoryModal(false);
      fetchCategories();
    } catch (err) {
      toast.error('Failed to add category');
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleDeactivateCategory(category) {
    const confirmed = await toast.confirm(
      `Deactivate "${category.name}"? Existing transactions will keep this category.`
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', category.id);
      if (error) throw error;
      toast.success('Category deactivated');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to deactivate category');
    }
  }

  // CSV Export
  async function handleExport() {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('transaction_date, type, amount, party, notes, payment_method, categories(name), accounts(name)')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });
      if (error) throw error;

      const rows = (data || []).map(t => ({
        Date: t.transaction_date,
        Type: t.type,
        Category: t.categories?.name || '',
        Amount: t.amount,
        Party: t.party || '',
        Notes: t.notes || '',
        'Payment Method': t.payment_method || '',
        Account: t.accounts?.name || '',
      }));

      const headers = ['Date', 'Type', 'Category', 'Amount', 'Party', 'Notes', 'Payment Method', 'Account'];
      const csvContent = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
          const val = String(r[h] ?? '');
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        }).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledgr-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${rows.length} transactions`);
    } catch (err) {
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  }

  // Delete account (danger)
  async function handleDeleteAccount() {
    const confirmed = await toast.confirm(
      'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.',
      { danger: true }
    );
    if (!confirmed) return;

    const doubleConfirm = await toast.confirm(
      'This is your last chance. Are you absolutely sure?',
      { danger: true }
    );
    if (!doubleConfirm) return;

    try {
      const { error } = await supabase.rpc('delete_user_data');
      if (error) throw error;
      await signOut();
      toast.success('Account deleted');
    } catch (err) {
      console.error('Delete account error:', err);
      toast.error(err.message || 'Failed to delete account');
    }
  }

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  return (
    <div style={{ padding: '20px', maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{
        fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)',
        margin: '0 0 24px 0',
      }}>
        Settings
      </h1>

      {/* Profile */}
      <div style={sectionStyle}>
        <Card>
          <CardHeader
            title="Profile"
            action={<User size={18} style={{ color: 'var(--text-muted)' }} />}
          />
          <Input
            label="Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            label="Email"
            value={user?.email || ''}
            readOnly
            icon={Mail}
            style={{ backgroundColor: 'var(--surface-muted)', cursor: 'not-allowed' }}
          />
          <Button
            icon={Save}
            loading={profileSaving}
            onClick={handleSaveProfile}
            disabled={fullName === (profile?.full_name || '')}
          >
            Save Profile
          </Button>
        </Card>
      </div>

      {/* Appearance */}
      <div style={sectionStyle}>
        <Card>
          <CardHeader
            title="Appearance"
            action={<Palette size={18} style={{ color: 'var(--text-muted)' }} />}
          />
          <div style={{ marginBottom: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Theme
            </label>
            <div style={pillGroupStyle}>
              <PillButton
                active={theme === 'light'}
                icon={Sun}
                label="Light"
                onClick={() => setTheme('light')}
              />
              <PillButton
                active={theme === 'dark'}
                icon={Moon}
                label="Dark"
                onClick={() => setTheme('dark')}
              />
              <PillButton
                active={theme === 'system'}
                icon={Monitor}
                label="System"
                onClick={() => setTheme('system')}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Accounts */}
      <div style={sectionStyle}>
        <Card>
          <CardHeader
            title="Accounts"
            action={
              <Button variant="ghost" size="sm" icon={Plus} onClick={openAddAccount}>
                Add
              </Button>
            }
          />
          {accountsLoading ? (
            <SkeletonRows n={3} />
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              No accounts yet. Add one to get started.
            </div>
          ) : (
            <div>
              {accounts.map(acc => (
                <AccountRow
                  key={acc.id}
                  account={acc}
                  onEdit={openEditAccount}
                  onDeactivate={handleDeactivateAccount}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Categories */}
      <div style={sectionStyle}>
        <Card>
          <CardHeader
            title="Categories"
            action={
              <Button variant="ghost" size="sm" icon={Plus} onClick={openAddCategory}>
                Add
              </Button>
            }
          />
          {categoriesLoading ? (
            <SkeletonRows n={4} />
          ) : categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              No custom categories yet.
            </div>
          ) : (
            <div>
              {expenseCategories.length > 0 && (
                <>
                  <div style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--expense)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '8px 0 4px 0',
                  }}>
                    Expenses
                  </div>
                  {expenseCategories.map(cat => (
                    <CategoryRow key={cat.id} category={cat} onDeactivate={handleDeactivateCategory} />
                  ))}
                </>
              )}
              {incomeCategories.length > 0 && (
                <>
                  <div style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--income)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '16px 0 4px 0',
                  }}>
                    Income
                  </div>
                  {incomeCategories.map(cat => (
                    <CategoryRow key={cat.id} category={cat} onDeactivate={handleDeactivateCategory} />
                  ))}
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Data Export */}
      <div style={sectionStyle}>
        <Card>
          <CardHeader
            title="Data Export"
            action={<Download size={18} style={{ color: 'var(--text-muted)' }} />}
          />
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
            Download all your transactions as a CSV file.
          </p>
          <Button
            variant="secondary"
            icon={Download}
            loading={exporting}
            onClick={handleExport}
          >
            Export Transactions (CSV)
          </Button>
        </Card>
      </div>

      {/* Danger Zone */}
      <div style={sectionStyle}>
        <Card style={{ border: '1px solid var(--expense)' }}>
          <CardHeader
            title="Danger Zone"
            action={<AlertTriangle size={18} style={{ color: 'var(--expense)' }} />}
          />
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Button variant="danger" icon={Trash2} onClick={handleDeleteAccount}>
            Delete Account
          </Button>
        </Card>
      </div>

      {/* Admin Link */}
      {isAdmin && (
        <div style={sectionStyle}>
          <Card onClick={() => navigate('/admin')} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shield size={20} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Admin Console
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Manage users, view stats, and audit logs
                </div>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>&#8250;</span>
            </div>
          </Card>
        </div>
      )}

      {/* Account Modal (Add / Edit) */}
      <Modal
        open={accountModal !== null}
        onClose={() => setAccountModal(null)}
        title={accountModal === 'add' ? 'Add Account' : 'Edit Account'}
      >
        <Input
          label="Account Name"
          value={accountForm.name}
          onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. HDFC Savings"
        />
        <Select
          label="Account Type"
          options={ACCOUNT_TYPES}
          value={accountForm.type}
          onChange={e => setAccountForm(f => ({ ...f, type: e.target.value }))}
        />
        {accountModal === 'add' && (
          <Input
            label="Initial Balance"
            type="number"
            value={accountForm.balance}
            onChange={e => setAccountForm(f => ({ ...f, balance: e.target.value }))}
            placeholder="0"
            suffix="INR"
          />
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <Button variant="secondary" onClick={() => setAccountModal(null)}>Cancel</Button>
          <Button loading={accountSaving} onClick={handleSaveAccount}>
            {accountModal === 'add' ? 'Add Account' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* Category Modal (Add) */}
      <Modal
        open={categoryModal}
        onClose={() => setCategoryModal(false)}
        title="Add Category"
      >
        <Input
          label="Category Name"
          value={categoryForm.name}
          onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Subscriptions"
        />
        <Select
          label="Type"
          options={CATEGORY_TYPES}
          value={categoryForm.type}
          onChange={e => setCategoryForm(f => ({ ...f, type: e.target.value }))}
        />
        <Input
          label="Icon (emoji)"
          value={categoryForm.icon}
          onChange={e => setCategoryForm(f => ({ ...f, icon: e.target.value }))}
          placeholder="e.g. 📱"
          containerStyle={{ marginBottom: '8px' }}
        />
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Color
          </label>
          <input
            type="color"
            value={categoryForm.color}
            onChange={e => setCategoryForm(f => ({ ...f, color: e.target.value }))}
            style={{
              width: '48px', height: '36px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '2px',
              backgroundColor: 'var(--surface)',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <Button variant="secondary" onClick={() => setCategoryModal(false)}>Cancel</Button>
          <Button loading={categorySaving} onClick={handleSaveCategory}>
            Add Category
          </Button>
        </div>
      </Modal>
    </div>
  );
}
