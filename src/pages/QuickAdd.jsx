import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../lib/constants';
import { todayISO } from '../lib/money';
import { findLikelyDuplicate } from '../lib/insights';

export default function QuickAdd({ open, onClose, editTransaction, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const amountRef = useRef(null);

  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [party, setParty] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [accountId, setAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState(null);
  const [accounts, setAccounts] = useState(null);

  // Reset form when modal opens or editTransaction changes
  useEffect(() => {
    if (!open) return;

    if (editTransaction) {
      setAmount(String(editTransaction.amount || ''));
      setType(editTransaction.type || 'expense');
      setCategoryId(editTransaction.category_id || '');
      setParty(editTransaction.party || '');
      setTransactionDate(editTransaction.transaction_date || todayISO());
      setAccountId(editTransaction.account_id || '');
      setPaymentMethod(editTransaction.payment_method || 'upi');
    } else {
      setAmount('');
      setType('expense');
      setCategoryId('');
      setParty('');
      setTransactionDate(todayISO());
      setAccountId('');
      setPaymentMethod('upi');
    }

    // Auto-focus amount input
    setTimeout(() => amountRef.current?.focus(), 100);
  }, [open, editTransaction]);

  // Fetch categories and accounts
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;

    async function load() {
      const [catRes, accRes] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .order('usage_count', { ascending: false }),
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;

      if (!catRes.error) setCategories(catRes.data || []);
      if (!accRes.error) {
        const accs = accRes.data || [];
        setAccounts(accs);
        // Default to first account if none selected
        if (!accountId && accs.length > 0 && !editTransaction) {
          setAccountId(accs[0].id);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open, user]);

  const filteredCategories = categories?.filter((c) => {
    if (type === 'income') return c.type === 'income';
    return c.type !== 'income';
  });

  async function handleSave() {
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!categoryId) {
      toast.error('Select a category');
      return;
    }
    if (!accountId) {
      toast.error('Select an account');
      return;
    }

    setSaving(true);

    try {
      const txData = {
        user_id: user.id,
        category_id: categoryId,
        account_id: accountId,
        type,
        amount: String(Number(amount)),
        party: party.trim() || null,
        notes: null,
        transaction_date: transactionDate,
        payment_method: paymentMethod,
      };

      if (editTransaction) {
        // Update existing
        const { error } = await supabase
          .from('transactions')
          .update(txData)
          .eq('id', editTransaction.id);

        if (error) throw error;
        toast.success('Transaction updated');
      } else {
        // Check for duplicates
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recentTxns } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', fiveMinAgo)
          .order('created_at', { ascending: false });

        const newTx = { ...txData, created_at: new Date().toISOString() };
        const duplicate = findLikelyDuplicate(newTx, recentTxns || []);

        if (duplicate) {
          toast.warn('Possible duplicate detected, but transaction was saved');
        }

        // Insert
        const { error } = await supabase.from('transactions').insert(txData);

        if (error) throw error;
        if (!duplicate) {
          toast.success('Transaction added');
        }
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && amount && Number(amount) > 0) {
      handleSave();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editTransaction ? 'Edit Transaction' : 'Add Transaction'}
    >
      <div onKeyDown={handleKeyDown}>
        {/* Amount Input */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--bg)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              border: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                fontSize: '28px',
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}
            >
              ₹
            </span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={{
                flex: 1,
                fontSize: '32px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                width: '100%',
                minWidth: 0,
              }}
            />
          </div>
        </div>

        {/* Type Toggle */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            marginBottom: '20px',
            backgroundColor: 'var(--surface-muted)',
            borderRadius: 'var(--radius)',
            padding: '3px',
          }}
        >
          {TRANSACTION_TYPES.map((t) => {
            const isActive = type === t.value;
            let activeColor = 'var(--accent)';
            if (t.value === 'expense' && isActive) activeColor = 'var(--expense)';
            if (t.value === 'income' && isActive) activeColor = 'var(--income)';

            return (
              <button
                key={t.value}
                onClick={() => {
                  setType(t.value);
                  setCategoryId('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                  color: isActive ? activeColor : 'var(--text-muted)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Category Picker */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Category
          </label>
          {!filteredCategories ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} width="80px" height="36px" style={{ borderRadius: 'var(--radius)' }} />
              ))}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>
              No categories available
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                maxHeight: '140px',
                overflowY: 'auto',
              }}
            >
              {filteredCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      borderRadius: 'var(--radius)',
                      border: isSelected
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Party / Note */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Party / Note
          </label>
          <input
            type="text"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            placeholder="e.g. Swiggy, Amazon"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Date Picker */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Date
          </label>
          <input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Account Selector */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Account
          </label>
          {!accounts ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} width="80px" height="34px" style={{ borderRadius: 'var(--radius)' }} />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No accounts found</div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {accounts.map((acc) => {
                const isSelected = accountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => setAccountId(acc.id)}
                    style={{
                      padding: '6px 14px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      borderRadius: 'var(--radius)',
                      border: isSelected
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      backgroundColor: isSelected ? 'var(--accent-light)' : 'var(--surface)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {acc.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '6px',
            }}
          >
            Payment Method
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '14px',
                fontFamily: 'inherit',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                outline: 'none',
                appearance: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Save Button */}
        <Button
          fullWidth
          size="lg"
          loading={saving}
          onClick={handleSave}
          disabled={!amount || Number(amount) <= 0}
        >
          {editTransaction ? 'Update Transaction' : 'Save Transaction'}
        </Button>
      </div>
    </Modal>
  );
}
