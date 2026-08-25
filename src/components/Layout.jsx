import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Home, ArrowUpDown, BarChart3, Target, Settings, Plus,
  User, LogOut, Shield, ChevronDown, X,
} from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import { useAuth } from '../context/AuthContext'

const ICON_MAP = { Home, ArrowUpDown, BarChart3, Target, Settings }
const NAVY = '#0F1729'
const GOLD = '#D4A853'
const GOLD_LIGHT = '#E8C97A'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

/* ── Profile Dropdown Menu ────────────────────────────────── */
function ProfileMenu({ onClose }) {
  const { profile, user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const menuRef = useRef(null)

  const name = profile?.full_name || 'User'
  const email = user?.email || ''
  const initial = name.charAt(0).toUpperCase()

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  function go(path) { navigate(path); onClose() }

  async function handleLogout() {
    await signOut()
    navigate('/login')
    onClose()
  }

  return (
    <div ref={menuRef} style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8,
      backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
      overflow: 'hidden', zIndex: 500,
      animation: 'menuSlideUp 0.18s ease-out',
    }}>
      <style>{`@keyframes menuSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* User header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: NAVY,
        }}>{initial}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding: '6px 8px' }}>
        <MenuItem icon={User} label="View Profile" onClick={() => go('/settings')} />
        <MenuItem icon={Settings} label="Settings" onClick={() => go('/settings')} />
        {isAdmin && <MenuItem icon={Shield} label="Admin Console" onClick={() => go('/admin')} gold />}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px' }}>
        <MenuItem icon={LogOut} label="Sign Out" onClick={handleLogout} danger />
      </div>
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger, gold }) {
  const [hov, setHov] = useState(false)
  const color = danger ? 'var(--expense)' : gold ? GOLD : 'var(--text-primary)'
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10, border: 'none',
        backgroundColor: hov ? 'var(--bg)' : 'transparent',
        color, fontSize: 14, fontWeight: 500, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'background-color 0.12s',
        textAlign: 'left',
      }}>
      <Icon size={15} />
      {label}
    </button>
  )
}

/* ── Desktop Sidebar Profile ──────────────────────────────── */
function SidebarProfile() {
  const [open, setOpen] = useState(false)
  const { profile, user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const ref = useRef(null)

  const name = profile?.full_name || 'User'
  const email = user?.email || ''
  const initial = name.charAt(0).toUpperCase()

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function handleKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [])

  async function handleLogout() { await signOut(); navigate('/login'); setOpen(false) }

  return (
    <div ref={ref} style={{ padding: '12px 16px', borderTop: '1px solid rgba(212,168,83,0.1)', position: 'relative' }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 8,
          backgroundColor: '#1A2540', border: '1px solid rgba(212,168,83,0.15)',
          borderRadius: 14, boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden', zIndex: 500,
          animation: 'menuSlideUp 0.18s ease-out',
        }}>
          <style>{`@keyframes menuSlideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{email}</div>
          </div>
          <div style={{ padding: '6px 8px' }}>
            {[
              { icon: User, label: 'View Profile', path: '/settings' },
              { icon: Settings, label: 'Settings', path: '/settings' },
              ...(isAdmin ? [{ icon: Shield, label: 'Admin Console', path: '/admin', gold: true }] : []),
            ].map(item => (
              <button key={item.label} onClick={() => { navigate(item.path); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: 'none',
                  backgroundColor: 'transparent', color: item.gold ? GOLD : 'rgba(255,255,255,0.7)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', transition: 'background-color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 8px' }}>
            <button onClick={handleLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, border: 'none',
                backgroundColor: 'transparent', color: '#ef4444',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left',
              }}>
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          border: 'none', background: 'none', cursor: 'pointer', padding: 0,
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: NAVY,
        }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        </div>
        <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>
    </div>
  )
}

/* ── Main Layout ──────────────────────────────────────────── */
export default function Layout({ onQuickAdd, children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = useCallback((path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }, [location.pathname])

  const mobileNavItems = NAV_ITEMS.slice(0, 4)
  const name = profile?.full_name || 'User'
  const initial = name.charAt(0).toUpperCase()

  const sidebarStyle = {
    position: 'fixed', top: 0, left: 0, bottom: 0, width: 240,
    background: 'linear-gradient(180deg, #0F1729 0%, #1a2540 100%)',
    borderRight: '1px solid rgba(212,168,83,0.1)',
    display: 'flex', flexDirection: 'column', zIndex: 100,
  }

  const navItemStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px', borderRadius: 'var(--radius)',
    color: active ? GOLD : 'rgba(255,255,255,0.6)',
    backgroundColor: active ? 'rgba(212,168,83,0.1)' : 'transparent',
    fontWeight: active ? 600 : 400, fontSize: 14,
    textDecoration: 'none', transition: 'background-color 0.15s, color 0.15s',
    cursor: 'pointer', borderLeft: active ? `3px solid ${GOLD}` : '3px solid transparent',
  })

  const mobileNavStyle = {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end',
    paddingTop: 6, paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))', zIndex: 100,
  }

  const mobileTabStyle = (active) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '4px 0', color: active ? GOLD : 'var(--text-muted)',
    textDecoration: 'none', fontSize: 10, fontWeight: active ? 600 : 400,
    flex: 1, transition: 'color 0.15s', position: 'relative',
  })

  const mobileActiveIndicatorStyle = {
    position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
    width: 20, height: 3, borderRadius: 2, backgroundColor: GOLD,
  }

  const fabMobileStyle = {
    width: 52, height: 52, borderRadius: '50%', backgroundColor: NAVY,
    color: GOLD, border: '3px solid #fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,41,0.3)',
    zIndex: 200, transition: 'transform 0.15s, box-shadow 0.15s', marginTop: -26, flexShrink: 0,
  }

  const mainStyle = {
    marginLeft: isDesktop ? 240 : 0,
    paddingBottom: isDesktop ? 0 : 'calc(60px + env(safe-area-inset-bottom, 0px))',
    minHeight: '100vh', backgroundColor: 'var(--bg)',
  }

  const contentStyle = { maxWidth: 720, margin: '0 auto', padding: '16px 16px 80px' }

  const fabDesktopStyle = {
    position: 'fixed', right: 24, bottom: 24, width: 48, height: 48,
    borderRadius: '50%', backgroundColor: NAVY, color: GOLD,
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(15,23,41,0.4)', zIndex: 200,
    transition: 'transform 0.15s, box-shadow 0.15s',
  }

  /* Mobile top header with profile */
  const mobileHeaderStyle = {
    position: 'sticky', top: 0, zIndex: 50,
    backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)',
    padding: '12px 16px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
  }

  return (
    <>
      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside style={sidebarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '28px 20px 24px', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(212,168,83,0.3)' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>L</span>
            </div>
            Ledgr
          </div>
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
            {NAV_ITEMS.map((item) => {
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
          <SidebarProfile />
        </aside>
      )}

      {/* Main Content */}
      <main style={mainStyle}>
        {/* Mobile Top Header */}
        {!isDesktop && (
          <div style={mobileHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>L</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Ledgr</span>
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMobileMenuOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: NAVY }}>
                  {initial}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name.split(' ')[0]}
                </span>
                <ChevronDown size={12} style={{ color: 'var(--text-muted)', transform: mobileMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {mobileMenuOpen && <ProfileMenu onClose={() => setMobileMenuOpen(false)} />}
            </div>
          </div>
        )}
        <div style={contentStyle}>{children}</div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      {!isDesktop && (
        <nav style={mobileNavStyle}>
          {mobileNavItems.slice(0, 2).map((item) => {
            const Icon = ICON_MAP[item.icon]
            const active = isActive(item.path)
            return (
              <Link key={item.path} to={item.path} style={mobileTabStyle(active)}>
                {active && <div style={mobileActiveIndicatorStyle} />}
                {Icon && <Icon size={22} />}
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button style={fabMobileStyle} onClick={onQuickAdd}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            aria-label="Quick add">
            <Plus size={24} />
          </button>
          {mobileNavItems.slice(2, 4).map((item) => {
            const Icon = ICON_MAP[item.icon]
            const active = isActive(item.path)
            return (
              <Link key={item.path} to={item.path} style={mobileTabStyle(active)}>
                {active && <div style={mobileActiveIndicatorStyle} />}
                {Icon && <Icon size={22} />}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {/* Desktop FAB */}
      {isDesktop && (
        <button style={fabDesktopStyle} onClick={onQuickAdd}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,41,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,41,0.4)' }}
          aria-label="Quick add">
          <Plus size={22} />
        </button>
      )}
    </>
  )
}
