import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
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
  { value: 'expense',  label: 'Expense',  color: '#EF4444' },
  { value: 'income',   label: 'Income',   color: '#10B981' },
  { value: 'transfer', label: 'Transfer', color: '#3B82F6' },
];

/* ── Note placeholder per type ── */
function notePlaceholder(type) {
  if (type === 'expense')  return 'e.g. Lunch with colleagues, monthly grocery run';
  if (type === 'income')   return 'e.g. August salary, freelance payment';
  if (type === 'transfer') return 'e.g. Moving funds to savings';
  return 'Add a note…';
}

/* ── Resolve icon: DB stores Lucide names for old rows, emojis for new ones.
      Always prefer CATEGORY_ICONS[name] (emoji), fall back to stored icon  ── */
function resolveIcon(cat) {
  const emoji = CATEGORY_ICONS[cat.name];
  if (emoji) return emoji;
  // If stored icon is already an emoji (>1 byte), use it
  if (cat.icon && cat.icon.length <= 6 && /\p{Emoji}/u.test(cat.icon)) return cat.icon;
  return null; // lucide string names we just hide
}

export default function QuickAdd({ open, onClose, editTransaction, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const amountRef = useRef(null);

  /* ── Form state ── */
  const [amount, setAmount]           = useState('');
  const [type, setType]               = useState('expense');
  const [categoryId, setCategoryId]   = useState('');
  const [party, setParty]             = useState('');
  const [notes, setNotes]             = useState('');
  const [date, setDate]               = useState(todayISO());
  const [accountId, setAccountId]     = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [saving, setSaving]           = useState(false);

  /* ── Remote data ── */
  const [categories, setCategories] = useState(null);
  const [accounts, setAccounts]     = useState(null);

  /* ── Reset form on open ── */
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

  /* ── Fetch categories + accounts ── */
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    async function load() {
      const [catRes, accRes] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('usage_count', { ascending: false }),
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('sort_order'),
      ]);
      if (cancelled) return;
      if (!catRes.error) setCategories(catRes.data || []);
      if (!accRes.error) {
        const accs = accRes.data || [];
        setAccounts(accs);
        if (!accountId && accs.length > 0 && !editTransaction) {
          setAccountId(accs[0].id);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, user]);

  /* ── Derived ── */
  const filteredCats = categories?.filter(c =>
    type === 'income' ? c.type === 'income' : c.type === 'expense'
  ) || [];

  const activeType = TRANSACTION_TYPES.find(t => t.value === type);
  const isTransfer = type === 'transfer';
  const isIncome   = type === 'income';
  const accentColor = activeType?.color || NAVY;

  /* ── Validation ── */
  function validate() {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount'); return false;
    }
    if (!isTransfer && !categoryId) {
      toast.error(isIncome ? 'Select an income source' : 'Select a category'); return false;
    }
    if (!accountId) {
      toast.error('Select an account'); return false;
    }
    if (isTransfer) {
      if (!toAccountId) { toast.error('Select destination account'); return false; }
      if (accountId === toAccountId) { toast.error('From and To accounts must be different'); return false; }
    }
    return true;
  }

  /* ── Save ── */
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const parsedAmount = parseFloat(amount);

      if (isTransfer && !editTransaction) {
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: accountId,
          transfer_to_account_id: toAccountId,
          type: 'transfer',
          amount: parsedAmount,
          party: party.trim() || null,
          notes: notes.trim() || null,
          transaction_date: date,
          payment_method: paymentMethod,
          category_id: null,
        });
        if (error) throw error;
        toast.success('Transfer recorded');
      } else {
        const txData = {
          user_id: user.id,
          category_id: categoryId || null,
          account_id: accountId,
          type,
          amount: parsedAmount,
          party: party.trim() || null,
          notes: notes.trim() || null,
          transaction_date: date,
          payment_method: paymentMethod,
        };
        if (editTransaction) {
          const { error } = await supabase
            .from('transactions').update(txData)
            .eq('id', editTransaction.id).eq('user_id', user.id);
          if (error) throw error;
          toast.success('Transaction updated');
        } else {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: recent } = await supabase
            .from('transactions').select('*')
            .eq('user_id', user.id).gte('created_at', fiveMinAgo);
          const dup = findLikelyDuplicate({ ...txData, created_at: new Date().toISOString() }, recent || []);
          const { error } = await supabase.from('transactions').insert(txData);
          if (error) throw error;
          toast.success(dup ? 'Saved (possible duplicate)' : 'Transaction added');
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

  /* ── Styles ── */
  const label = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--text-muted)', marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: '0.6px',
  };
  const optionalSpan = {
    textTransform: 'none', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4,
  };
  const inputStyle = {
    width: '100%', padding: '12px 14px', fontSize: 15, fontFamily: 'inherit',
    color: 'var(--text-primary)', backgroundColor: 'var(--bg)',
    border: '1.5px solid var(--border)', borderRadius: 12, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.18s',
  };
  const chip = (selected) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', fontSize: 13, fontFamily: 'inherit',
    borderRadius: 100, cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'all 0.15s', border: 'none',
    backgroundColor: selected ? `${accentColor}18` : 'var(--bg)',
    color: selected ? accentColor : 'var(--text-secondary)',
    fontWeight: selected ? 700 : 400,
    outline: selected ? `2px solid ${accentColor}` : '1.5px solid var(--border)',
    outlineOffset: selected ? 0 : 0,
  });

  /* ── Party field config ── */
  const partyLabel       = isIncome ? 'Source' : 'Merchant';
  const partyPlaceholder = isIncome
    ? 'e.g. Employer, client name, bank'
    : 'e.g. Swiggy, DMart, Apollo, Zara';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          backgroundColor: 'rgba(0,0,0,0.5)',
          animation: 'qaBdIn 0.2s ease-out',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        backgroundColor: 'var(--surface)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '94vh', overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        animation: 'qaSheetUp 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <style>{`
          @keyframes qaSheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
          @keyframes qaBdIn    { from{opacity:0} to{opacity:1} }
          .qa-input:focus { border-color: ${accentColor} !important; }
        `}</style>

        {/* ── Sheet header: drag handle + title + close ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px 0',
        }}>
          {/* Left spacer = same width as close button so title stays centred */}
          <div style={{ width: 36, height: 36 }} />

          {/* Drag handle centred above title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'var(--border)' }} />
          </div>

          {/* Close (×) button — top-right */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36, height: 36, borderRadius: 12, border: 'none',
              backgroundColor: 'var(--bg)', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--border)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg)'}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '12px 24px 44px' }}>

          {/* Title */}
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>
            {editTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </div>

          {/* ── Type toggle ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {TRANSACTION_TYPES.map(t => {
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => { setType(t.value); setCategoryId(''); }}
                  style={{
                    flex: 1, padding: '11px 8px', border: 'none', borderRadius: 100,
                    fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer', transition: 'all 0.2s',
                    backgroundColor: active ? t.color : 'var(--bg)',
                    color: active ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ── Amount ── */}
          <div style={{ marginBottom: 22 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              backgroundColor: 'var(--bg)', borderRadius: 16,
              padding: '14px 20px', border: `2px solid ${accentColor}`,
            }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-muted)' }}>₹</span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && amount && Number(amount) > 0 && handleSave()}
                placeholder="0"
                style={{
                  flex: 1, fontSize: 36, fontWeight: 700,
                  color: 'var(--text-primary)', backgroundColor: 'transparent',
                  border: 'none', outline: 'none', fontFamily: 'inherit', minWidth: 0,
                }}
              />
            </div>
          </div>

          {/* ── EXPENSE / INCOME: Category / Income Source ── */}
          {!isTransfer && (
            <div style={{ marginBottom: 22 }}>
              <label style={label}>
                {isIncome ? 'Income Source' : 'Category'}
              </label>
              {!filteredCats.length ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3,4].map(i => (
                    <Skeleton key={i} width="80px" height="38px" style={{ borderRadius: 100 }} />
                  ))}
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8,
                  maxHeight: 160, overflowY: 'auto',
                }}>
                  {filteredCats.map(cat => {
                    const icon = resolveIcon(cat);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCategoryId(cat.id)}
                        style={chip(categoryId === cat.id)}
                      >
                        {icon && <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>}
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TRANSFER: From → To accounts ── */}
          {isTransfer && (
            <div style={{ marginBottom: 22 }}>
              <label style={label}>From Account</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {(accounts || []).map(acc => (
                  <button key={acc.id} onClick={() => setAccountId(acc.id)} style={chip(accountId === acc.id)}>
                    {acc.name}
                  </button>
                ))}
              </div>

              <label style={label}>To Account</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(accounts || []).filter(a => a.id !== accountId).map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => setToAccountId(acc.id)}
                    style={{
                      ...chip(toAccountId === acc.id),
                      ...(toAccountId === acc.id ? {
                        backgroundColor: 'rgba(59,130,246,0.12)',
                        color: '#3B82F6',
                        outline: '2px solid #3B82F6',
                      } : {}),
                    }}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Merchant (expense) / Source (income) — NOT shown for transfer ── */}
          {!isTransfer && (
            <div style={{ marginBottom: 18 }}>
              <label style={label}>
                {partyLabel}
                <span style={optionalSpan}>(optional)</span>
              </label>
              <input
                type="text"
                className="qa-input"
                value={party}
                onChange={e => setParty(e.target.value)}
                placeholder={partyPlaceholder}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = accentColor}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          {/* ── Note — context-aware placeholder, shown for all types ── */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>
              Note
              <span style={optionalSpan}>(optional)</span>
            </label>
            <input
              type="text"
              className="qa-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={notePlaceholder(type)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = accentColor}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* ── Date ── */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = accentColor}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* ── Account chips (expense + income; for transfer this is above) ── */}
          {!isTransfer && (
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Account</label>
              {!accounts ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3].map(i => (
                    <Skeleton key={i} width="80px" height="38px" style={{ borderRadius: 100 }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {accounts.map(acc => (
                    <button key={acc.id} onClick={() => setAccountId(acc.id)} style={chip(accountId === acc.id)}>
                      {acc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Payment Method (expense + income only) ── */}
          {!isTransfer && (
            <div style={{ marginBottom: 28 }}>
              <label style={label}>Payment Method</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none', paddingRight: 40, cursor: 'pointer' }}
                >
                  {PAYMENT_METHODS.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
                <span style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 11,
                }}>▼</span>
              </div>
            </div>
          )}

          {/* ── Save button ── */}
          <button
            onClick={handleSave}
            disabled={saving || !amount || Number(amount) <= 0}
            style={{
              width: '100%', padding: '16px 24px',
              fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
              color: '#fff', border: 'none', borderRadius: 16,
              cursor: saving || !amount || Number(amount) <= 0 ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: saving || !amount || Number(amount) <= 0
                ? '#94A3B8'
                : accentColor,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? 'Saving…'
              : editTransaction
                ? 'Update Transaction'
                : `Save ${activeType?.label || 'Transaction'}`}
          </button>

        </div>
      </div>
    </>
  );
}
