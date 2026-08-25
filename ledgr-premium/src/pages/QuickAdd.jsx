import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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

  // Type toggle color mapping
  function getTypeColor(value) {
    if (value === 'expense') return 'var(--expense)';
    if (value === 'income') return 'var(--income)';
    return 'var(--accent)';
  }

  if (!open) return null;

  return (
    <>
      {/* Dark overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'quickAddOverlayIn 0.2s ease-out',
        }}
      />

      {/* Bottom sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          backgroundColor: 'var(--surface, #FFFFFF)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '92vh',
          overflowY: 'auto',
          animation: 'quickAddSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.15)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Drag handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '12px',
            paddingBottom: '4px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--border, #D1D5DB)',
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            padding: '8px 24px 20px',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
        >
          {editTransaction ? 'Edit Transaction' : 'Add Transaction'}
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px 32px' }}>

          {/* Type Toggle Pills */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '24px',
            }}
          >
            {TRANSACTION_TYPES.map((t) => {
              const isActive = type === t.value;
              const activeColor = getTypeColor(t.value);
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setType(t.value);
                    setCategoryId('');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    border: 'none',
                    borderRadius: '100px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: isActive ? activeColor : 'var(--bg, #F3F4F6)',
                    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--bg, #F9FAFB)',
                borderRadius: '16px',
                padding: '14px 20px',
                border: '2px solid var(--accent)',
                transition: 'border-color 0.2s ease',
              }}
            >
              <span
                style={{
                  fontSize: '32px',
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
                  fontSize: '36px',
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

          {/* Category Picker */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Category
            </label>
            {!filteredCategories ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} width="90px" height="40px" style={{ borderRadius: '100px' }} />
                ))}
              </div>
            ) : filteredCategories.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', padding: '8px 0' }}>
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
                        padding: '8px 14px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        borderRadius: '100px',
                        border: isSelected
                          ? '2px solid var(--accent)'
                          : '1.5px solid var(--border)',
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.icon && <span style={{ fontSize: '16px' }}>{cat.icon}</span>}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Merchant / Note */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Merchant / Note
            </label>
            <input
              type="text"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              placeholder="e.g. Swiggy, Amazon"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                fontFamily: 'inherit',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg, #F9FAFB)',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Date Picker */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
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
                padding: '12px 16px',
                fontSize: '15px',
                fontFamily: 'inherit',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg, #F9FAFB)',
                border: '1.5px solid var(--border)',
                borderRadius: '12px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Account Selector Chips */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Account
            </label>
            {!accounts ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} width="90px" height="40px" style={{ borderRadius: '100px' }} />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No accounts found</div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {accounts.map((acc) => {
                  const isSelected = accountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => setAccountId(acc.id)}
                      style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        borderRadius: '100px',
                        border: isSelected
                          ? '2px solid var(--accent)'
                          : '1.5px solid var(--border)',
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {acc.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Dropdown */}
          <div style={{ marginBottom: '28px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
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
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg, #F9FAFB)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '12px',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  paddingRight: '40px',
                }}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
              {/* Dropdown arrow */}
              <div
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                }}
              >
                ▼
              </div>
            </div>
          </div>

          {/* Save Transaction Button */}
          <button
            onClick={handleSave}
            disabled={saving || !amount || Number(amount) <= 0}
            style={{
              width: '100%',
              padding: '16px 24px',
              fontSize: '16px',
              fontWeight: 700,
              fontFamily: 'inherit',
              color: '#FFFFFF',
              backgroundColor: (saving || !amount || Number(amount) <= 0)
                ? '#94A3B8'
                : 'var(--navy, #0F1729)',
              border: 'none',
              borderRadius: '16px',
              cursor: (saving || !amount || Number(amount) <= 0) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease, opacity 0.2s ease',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? 'Saving...'
              : editTransaction
                ? 'Update Transaction'
                : 'Save Transaction'}
          </button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes quickAddSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes quickAddOverlayIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
