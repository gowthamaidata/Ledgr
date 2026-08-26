/**
 * ProfilePopup — portal-based anchored account menu
 * Works identically on desktop sidebar and mobile header.
 * Uses fixed positioning relative to the viewport so it
 * is never clipped by the sidebar or any overflow:hidden container.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { User, Settings, Shield, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAVY = '#0F1729'
const GOLD = '#D4A853'
const GOLD_LIGHT = '#E8C97A'

/* Measure available space and pick the best position */
function getPopupStyles(triggerRect, popupWidth = 240) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 8

  // Preferred: above the trigger (for bottom-of-sidebar use case)
  // Alternative: below the trigger (for top-header mobile use case)
  const spaceAbove = triggerRect.top
  const spaceBelow = vh - triggerRect.bottom
  const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow

  // Horizontal: align left edge with trigger, clamp to viewport
  let left = triggerRect.left
  if (left + popupWidth > vw - margin) left = vw - popupWidth - margin
  if (left < margin) left = margin

  let top, bottom
  if (openUpward) {
    bottom = vh - triggerRect.top + margin
    top = undefined
  } else {
    top = triggerRect.bottom + margin
    bottom = undefined
  }

  return { position: 'fixed', left, top, bottom, width: popupWidth, zIndex: 99999 }
}

/* ── The popup content ─────────────────────────────────────────── */
function PopupContent({ triggerRect, onClose }) {
  const { profile, user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const popupRef = useRef(null)
  const [styles, setStyles] = useState(() => getPopupStyles(triggerRect))

  /* Recompute position on resize / scroll */
  useEffect(() => {
    function update() { setStyles(getPopupStyles(triggerRect)) }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [triggerRect])

  /* Close on outside click */
  useEffect(() => {
    function handlePointer(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose()
    }
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    // Small delay so the same click that opens doesn't instantly close
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointer)
      document.addEventListener('keydown', handleKey)
    }, 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const name = profile?.full_name || 'User'
  const email = user?.email || ''
  const initial = name.charAt(0).toUpperCase()

  function go(path) { navigate(path); onClose() }
  async function handleSignOut() { await signOut(); navigate('/login'); onClose() }

  return (
    <div
      ref={popupRef}
      role="menu"
      aria-label="Account menu"
      style={{
        ...styles,
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        animation: 'popupIn 0.16s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`
        @keyframes popupIn {
          from { opacity: 0; transform: scale(0.95) translateY(-4px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
        .pp-item:hover { background-color: var(--bg) !important; }
        .pp-item:focus { background-color: var(--bg) !important; outline: 2px solid var(--accent); outline-offset: -2px; }
        .pp-danger:hover { background-color: rgba(239,68,68,0.06) !important; }
        .pp-danger:focus { background-color: rgba(239,68,68,0.06) !important; outline: 2px solid var(--expense); outline-offset: -2px; }
      `}</style>

      {/* User header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: NAVY,
        }}>
          {initial}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{email}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '6px 6px 2px' }} role="group">
        <PopupItem icon={User} label="View Profile" onClick={() => go('/settings')} />
        <PopupItem icon={Settings} label="Settings" onClick={() => go('/settings')} />
        {isAdmin && <PopupItem icon={Shield} label="Admin Console" onClick={() => go('/admin')} gold />}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '2px 6px 6px' }}>
        <PopupItem icon={LogOut} label="Sign Out" onClick={handleSignOut} danger />
      </div>
    </div>
  )
}

function PopupItem({ icon: Icon, label, onClick, danger, gold }) {
  const color = danger ? 'var(--expense)' : gold ? GOLD : 'var(--text-primary)'
  return (
    <button
      className={danger ? 'pp-item pp-danger' : 'pp-item'}
      role="menuitem"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10, border: 'none',
        backgroundColor: 'transparent', color,
        fontSize: 14, fontWeight: 500, cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left', transition: 'background-color 0.1s',
      }}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      {label}
    </button>
  )
}

/* ── Exported trigger wrapper ──────────────────────────────────── */
export function ProfilePopupTrigger({ children, style, className }) {
  const [open, setOpen] = useState(false)
  const [triggerRect, setTriggerRect] = useState(null)
  const triggerRef = useRef(null)

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect())
      setOpen(true)
    }
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <>
      <div
        ref={triggerRef}
        onClick={open ? handleClose : handleOpen}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open ? handleClose() : handleOpen() } }}
        style={{ cursor: 'pointer', ...style }}
        className={className}
      >
        {children}
      </div>
      {open && triggerRect && createPortal(
        <PopupContent triggerRect={triggerRect} onClose={handleClose} />,
        document.body
      )}
    </>
  )
}

export default ProfilePopupTrigger
