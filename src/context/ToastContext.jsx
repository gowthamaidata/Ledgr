import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext()

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warn: AlertTriangle,
}

const COLORS = {
  success: 'var(--income)',
  error: 'var(--expense)',
  info: 'var(--accent)',
  warn: 'var(--warning)',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    info: (msg) => addToast(msg, 'info'),
    warn: (msg) => addToast(msg, 'warn', 4000),
    confirm: (message, { danger = false } = {}) => {
      return new Promise(resolve => {
        setConfirmState({ message, danger, resolve })
      })
    },
  }

  function handleConfirm(result) {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Toast stack */}
      <div style={{
        position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none', width: '90%', maxWidth: 400,
      }}>
        {toasts.map(t => {
          const Icon = ICONS[t.type]
          return (
            <div key={t.id} className="toast-enter" style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: 'var(--shadow-lg)', pointerEvents: 'auto',
            }}>
              <Icon size={18} style={{ color: COLORS[t.type], flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>{t.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div className="backdrop-enter" style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div className="modal-enter" style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
            padding: 24, maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-lg)',
          }}>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)', marginBottom: 20 }}>
              {confirmState.message}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleConfirm(false)}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirm(true)}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: confirmState.danger ? 'var(--expense)' : 'var(--accent)',
                  color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}
              >
                {confirmState.danger ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
