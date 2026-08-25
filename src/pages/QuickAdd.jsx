import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/Skeleton';
import { PAYMENT_METHODS, CATEGORY_ICONS } from '../lib/constants';
import { todayISO } from '../lib/money';
import { findLikelyDuplicate } from '../lib/insights';

const NAVY = '#0F1729';
const GOLD = '#D4A853';

const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Expense', color: '#EF4444' },
  { value: 'income',  label: 'Income',  color: '#10B981' },
  { value: 'transfer',label: 'Transfer', color: '#3B82F6' },
];

export default function QuickAdd({ open, onClose, editTransaction, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const amountRef = useRef(null);
  const sheetRef = useRef(null);

  /* ── Form state ─── */
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [saving, setSaving] = useState(false);

  /* ── Data ─── */
  const [categories, setCategories] = useState(null);
  const [accounts, setAccounts] = useState(null);

  /* ── Reset on open ─── */
  useEffect(() => {
    if (!open) return;
    if (editTransaction) {
      setAmount(String(editTransaction.amount || ''));
      setType(editTransaction.type || 'expense');
      setCategoryId(editTransaction.category_id || '');
      setParty(editTransaction.party || '');
      setNotes(editTransaction.notes || '');
      setDate(editTransaction.transaction_date || todayISO());
      setAccountId(editTransaction.account_id || '');
      setToAccountId(editTransaction.transfer_to_account_id || '');
      setPaymentMethod(editTransaction.payment_method || 'upi');
    } else {
      setAmount('');
      setType('expense');
      setCategoryId('');
      setParty('');
      setNotes('');
      setDate(todayISO());
      setPaymentMethod('upi');
      setToAccountId('');
    }
    setTimeout(() => amountRef.current?.focus(), 120);
  }, [open, editTransaction]);

  /* ── Fetch data ─── */
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    async function load() {
      const [catRes, accRes] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id).eq('is_active', true).order('usage_count', { ascending: false }),
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      ]);
      if (cancelled) return;
      if (!catRes.error) setCategories(catRes.data || []);
      if (!accRes.error) {
        const accs = accRes.data || [];
        setAccounts(accs);
        if (!accountId && accs.length > 0 && !editTransaction) setAccountId(accs[0].id);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, user]);

  /* ── Filtered categories ─── */
  const filteredCats = categories?.filter(c => type === 'income' ? c.type === 'income' : c.type === 'expense') || [];

  /* ── Validation ─── */
  function validate() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return false; }
    if (type !== 'transfer' && !categoryId) { toast.error('Select a category'); return false; }
    if (!accountId) { toast.error('Select an account'); return false; }
    if (type === 'transfer') {
      if (!toAccountId) { toast.error('Select a destination account'); return false; }
      if (accountId === toAccountId) { toast.error('From and To accounts must be different'); return false; }
    }
    return true;
  }

  /* ── Save ─── */
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const parsedAmount = parseFloat(amount);

      if (type === 'transfer' && !editTransaction) {
        const txData = {
          user_id: user.id, account_id: accountId,
          transfer_to_account_id: toAccountId,
          type: 'transfer', amount: parsedAmount,
          party: party.trim() || null, notes: notes.trim() || null,
          transaction_date: date, payment_method: paymentMethod,
          category_id: null,
        };
        const { error } = await supabase.from('transactions').insert(txData);
        if (error) throw error;
        toast.success('Transfer recorded');
      } else {
        const txData = {
          user_id: user.id, category_id: categoryId || null,
          account_id: accountId, type,
          amount: parsedAmount,
          party: party.trim() || null, notes: notes.trim() || null,
          transaction_date: date, payment_method: paymentMethod,
        };
        if (editTransaction) {
          const { error } = await supabase.from('transactions').update(txData).eq('id', editTransaction.id).eq('user_id', user.id);
          if (error) throw error;
          toast.success('Transaction updated');
        } else {
          // Duplicate check
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: recentTxns } = await supabase.from('transactions').select('*').eq('user_id', user.id).gte('created_at', fiveMinAgo).order('created_at', { ascending: false });
          const newTx = { ...txData, created_at: new Date().toISOString() };
          const dup = findLikelyDuplicate(newTx, recentTxns || []);
          const { error } = await supabase.from('transactions').insert(txData);
          if (error) throw error;
          toast.success(dup ? 'Saved (possible duplicate detected)' : 'Transaction added');
        }
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const activeType = TRANSACTION_TYPES.find(t => t.value === type);
  const isTransfer = type === 'transfer';

  /* ── Label helpers ─── */
  const partyLabel = type === 'expense' ? 'Merchant' : type === 'income' ? 'Source' : 'Note';
  const partyPlaceholder = type === 'expense' ? 'e.g. Swiggy, DMart, Apollo' : type === 'income' ? 'e.g. Employer, Bank' : 'Transfer note';
  const catLabel = type === 'income' ? 'Income Source' : 'Category';

  const fieldLabel = (text) => ({
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px',
  });

  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: 15, fontFamily: 'inherit',
    color: 'var(--text-primary)', backgroundColor: 'var(--bg)',
    border: '1.5px solid var(--border)', borderRadius: 12, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  };

  const chipStyle = (selected) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', fontSize: 13, fontFamily: 'inherit',
    borderRadius: 100, border: selected ? `2px solid ${activeType?.color || 'var(--accent)'}` : '1.5px solid var(--border)',
    backgroundColor: selected ? `${activeType?.color}14` : 'var(--surface)',
    color: selected ? (activeType?.color || 'var(--accent)') : 'var(--text-secondary)',
    fontWeight: selected ? 600 : 400, cursor: 'pointer',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  });

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998, animation: 'qaoIn 0.2s ease-out' }} />

      {/* Sheet */}
      <div ref={sheetRef} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        backgroundColor: 'var(--surface)', borderRadius: '24px 24px 0 0',
        maxHeight: '94vh', overflowY: 'auto',
        animation: 'qaoUp 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        <style>{`
          @keyframes qaoUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
          @keyframes qaoIn { from { opacity: 0 } to { opacity: 1 } }
          .qa-input:focus { border-color: var(--accent) !important; }
        `}</style>

        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 2 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'var(--border)' }} />
        </div>

        <div style={{ padding: '8px 24px 40px' }}>
          {/* Title */}
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 22 }}>
            {editTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </div>

          {/* Type selector */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {TRANSACTION_TYPES.map(t => {
                const isActive = type === t.value;
                return (
                  <button key={t.value} onClick={() => { setType(t.value); setCategoryId(''); }}
                    style={{ flex: 1, padding: '11px 8px', border: 'none', borderRadius: 100, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: isActive ? t.color : 'var(--bg)', color: isActive ? '#fff' : 'var(--text-muted)' }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: 'var(--bg)', borderRadius: 16, padding: '14px 20px', border: `2px solid ${activeType?.color || 'var(--accent)'}` }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-muted)' }}>₹</span>
              <input ref={amountRef} type="number" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && amount && Number(amount) > 0 && handleSave()}
                placeholder="0"
                style={{ flex: 1, fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', backgroundColor: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
            </div>
          </div>

          {/* EXPENSE / INCOME: Category */}
          {!isTransfer && (
            <div style={{ marginBottom: 22 }}>
              <label style={fieldLabel(catLabel)}>{catLabel}</label>
              {!filteredCats.length ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3,4].map(i => <Skeleton key={i} width="80px" height="38px" style={{ borderRadius: 100 }} />)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 148, overflowY: 'auto' }}>
                  {filteredCats.map(cat => (
                    <button key={cat.id} onClick={() => setCategoryId(cat.id)}
                      style={chipStyle(categoryId === cat.id)}>
                      {cat.icon && <span style={{ fontSize: 15 }}>{cat.icon}</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TRANSFER: From/To Account */}
          {isTransfer && (
            <div style={{ marginBottom: 22 }}>
              <label style={fieldLabel('From Account')}>From Account</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {(accounts || []).map(acc => (
                  <button key={acc.id} onClick={() => setAccountId(acc.id)}
                    style={chipStyle(accountId === acc.id)}>
                    {acc.name}
                  </button>
                ))}
              </div>
              <label style={fieldLabel('To Account')}>To Account</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(accounts || []).filter(a => a.id !== accountId).map(acc => (
                  <button key={acc.id} onClick={() => setToAccountId(acc.id)}
                    style={{ ...chipStyle(toAccountId === acc.id), borderColor: toAccountId === acc.id ? '#3B82F6' : undefined, backgroundColor: toAccountId === acc.id ? 'rgba(59,130,246,0.08)' : undefined, color: toAccountId === acc.id ? '#3B82F6' : undefined }}>
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Party / Source / Note label */}
          {!isTransfer && (
            <div style={{ marginBottom: 18 }}>
              <label style={fieldLabel(partyLabel)}>{partyLabel} <span style={{ textTransform: 'none', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input type="text" className="qa-input" value={party} onChange={e => setParty(e.target.value)}
                placeholder={partyPlaceholder} style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <label style={fieldLabel('Note')}>Note <span style={{ textTransform: 'none', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input type="text" className="qa-input" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={isTransfer ? 'e.g. Monthly rent transfer' : 'e.g. Dinner with family'}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>

          {/* Date */}
          <div style={{ marginBottom: 18 }}>
            <label style={fieldLabel('Date')}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>

          {/* Account (for expense/income) */}
          {!isTransfer && (
            <div style={{ marginBottom: 18 }}>
              <label style={fieldLabel('Account')}>Account</label>
              {!accounts ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3].map(i => <Skeleton key={i} width="80px" height="38px" style={{ borderRadius: 100 }} />)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {accounts.map(acc => (
                    <button key={acc.id} onClick={() => setAccountId(acc.id)}
                      style={chipStyle(accountId === acc.id)}>
                      {acc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment method (expense/income only) */}
          {!isTransfer && (
            <div style={{ marginBottom: 28 }}>
              <label style={fieldLabel('Payment Method')}>Payment Method</label>
              <div style={{ position: 'relative' }}>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none', paddingRight: 40, cursor: 'pointer' }}>
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 11 }}>▼</div>
              </div>
            </div>
          )}

          {/* Save button */}
          <button onClick={handleSave}
            disabled={saving || !amount || Number(amount) <= 0}
            style={{ width: '100%', padding: '16px 24px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', color: '#fff', backgroundColor: saving || !amount || Number(amount) <= 0 ? '#94A3B8' : activeType?.color || NAVY, border: 'none', borderRadius: 16, cursor: saving || !amount || Number(amount) <= 0 ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : editTransaction ? 'Update Transaction' : `Save ${activeType?.label || 'Transaction'}`}
          </button>
        </div>
      </div>
    </>
  );
}
