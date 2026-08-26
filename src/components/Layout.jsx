import { useState, useEffect, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Home, ArrowUpDown, BarChart3, Target, Settings, Plus, ChevronDown } from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import { useAuth } from '../context/AuthContext'
import { ProfilePopupTrigger } from './ProfilePopup'

const ICON_MAP = { Home, ArrowUpDown, BarChart3, Target, Settings }
const NAVY = '#0F1729'
const GOLD = '#D4A853'
const GOLD_LIGHT = '#E8C97A'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const h = e => setMatches(e.matches)
    mql.addEventListener('change', h)
    return () => mql.removeEventListener('change', h)
  }, [query])
  return matches
}

/* ── Sidebar user section ────────────────────────────────── */
function SidebarUser() {
  const { profile, user } = useAuth()
  const name  = profile?.full_name || 'User'
  const email = user?.email || ''
  const initial = name.charAt(0).toUpperCase()

  return (
    <ProfilePopupTrigger style={{ padding: '12px 16px', borderTop: '1px solid rgba(212,168,83,0.1)', display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: NAVY,
        }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        </div>
        <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
      </div>
    </ProfilePopupTrigger>
  )
}

/* ── Mobile header user trigger ──────────────────────────── */
function MobileUser() {
  const { profile } = useAuth()
  const name = profile?.full_name || 'User'
  const initial = name.charAt(0).toUpperCase()
  const firstName = name.split(' ')[0]

  return (
    <ProfilePopupTrigger>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: NAVY, flexShrink: 0 }}>
          {initial}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {firstName}
        </span>
        <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
      </div>
    </ProfilePopupTrigger>
  )
}

/* ── Main Layout ─────────────────────────────────────────── */
export default function Layout({ onQuickAdd, children }) {
  const location = useLocation()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const isActive = useCallback(path => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }, [location.pathname])

  const mobileNavItems = NAV_ITEMS.slice(0, 4)

  /* ── Styles ── */
  const sidebarStyle = {
    position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
    background: 'linear-gradient(180deg, #0F1729 0%, #1a2540 100%)',
    borderRight: '1px solid rgba(212,168,83,0.1)',
    display: 'flex', flexDirection: 'column', zIndex: 100,
  }

  const navItemStyle = active => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    borderRadius: 'var(--radius)', textDecoration: 'none',
    color: active ? GOLD : 'rgba(255,255,255,0.6)',
    backgroundColor: active ? 'rgba(212,168,83,0.1)' : 'transparent',
    fontWeight: active ? 600 : 400, fontSize: 14,
    transition: 'background-color 0.15s, color 0.15s',
    borderLeft: active ? `3px solid ${GOLD}` : '3px solid transparent',
  })

  const mobileTabStyle = active => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '4px 0', textDecoration: 'none',
    color: active ? GOLD : 'var(--text-muted)',
    fontSize: 10, fontWeight: active ? 600 : 400, flex: 1, position: 'relative',
    transition: 'color 0.15s',
  })

  const fabMobile = {
    width: 52, height: 52, borderRadius: '50%', backgroundColor: NAVY,
    color: GOLD, border: '3px solid var(--surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,41,0.3)',
    zIndex: 200, transition: 'transform 0.15s', marginTop: -26, flexShrink: 0,
  }

  const fabDesktop = {
    position: 'fixed', right: 24, bottom: 24, width: 48, height: 48,
    borderRadius: '50%', backgroundColor: NAVY, color: GOLD, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(15,23,41,0.4)',
    zIndex: 200, transition: 'transform 0.15s, box-shadow 0.15s',
  }

  return (
    <>
      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside style={sidebarStyle}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '28px 20px 24px', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(212,168,83,0.3)' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>L</span>
            </div>
            Ledgr
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
            {NAV_ITEMS.map(item => {
              const Icon = ICON_MAP[item.icon]
              const active = isActive(item.path)
              return (
                <Link key={item.path} to={item.path} style={navItemStyle(active)}>
                  {Icon && <Icon size={20} />}
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User — popup opens upward (above the trigger) */}
          <SidebarUser />
        </aside>
      )}

      {/* Main content */}
      <main style={{
        marginLeft: isDesktop ? 240 : 0,
        paddingBottom: isDesktop ? 0 : 'calc(60px + env(safe-area-inset-bottom, 0px))',
        minHeight: '100vh', backgroundColor: 'var(--bg)',
      }}>
        {/* Mobile header */}
        {!isDesktop && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 50,
            backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)',
            padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>L</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Ledgr</span>
            </div>
            {/* User trigger — popup opens downward (below the trigger) */}
            <MobileUser />
          </div>
        )}

        <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 16px 80px' }}>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {!isDesktop && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
          paddingTop: 6, paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))', zIndex: 100,
        }}>
          {mobileNavItems.slice(0, 2).map(item => {
            const Icon = ICON_MAP[item.icon]
            const active = isActive(item.path)
            return (
              <Link key={item.path} to={item.path} style={mobileTabStyle(active)}>
                {active && <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 20, height: 3, borderRadius: 2, backgroundColor: GOLD }} />}
                {Icon && <Icon size={22} />}
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button style={fabMobile} onClick={onQuickAdd}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            aria-label="Add transaction">
            <Plus size={24} />
          </button>
          {mobileNavItems.slice(2, 4).map(item => {
            const Icon = ICON_MAP[item.icon]
            const active = isActive(item.path)
            return (
              <Link key={item.path} to={item.path} style={mobileTabStyle(active)}>
                {active && <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 20, height: 3, borderRadius: 2, backgroundColor: GOLD }} />}
                {Icon && <Icon size={22} />}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {/* Desktop FAB */}
      {isDesktop && (
        <button style={fabDesktop} onClick={onQuickAdd}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,41,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,41,0.4)' }}
          aria-label="Add transaction">
          <Plus size={22} />
        </button>
      )}
    </>
  )
}
