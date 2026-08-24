import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Wallet,
  Home,
  ArrowUpDown,
  BarChart3,
  Target,
  Settings,
  Plus,
} from 'lucide-react'
import { NAV_ITEMS } from '../lib/constants'
import { useAuth } from '../context/AuthContext'

const ICON_MAP = { Home, ArrowUpDown, BarChart3, Target, Settings }

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

export default function Layout({ onQuickAdd }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isDesktop = useMediaQuery('(min-width: 768px)')

  const isActive = useCallback(
    (path) => {
      if (path === '/') return location.pathname === '/'
      return location.pathname.startsWith(path)
    },
    [location.pathname]
  )

  const sidebarStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    backgroundColor: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  }

  const logoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '24px 20px 20px',
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  }

  const navStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 12px',
  }

  const navItemStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    backgroundColor: active ? 'var(--accent-light)' : 'transparent',
    fontWeight: active ? 600 : 400,
    fontSize: 14,
    textDecoration: 'none',
    transition: 'background-color 0.15s, color 0.15s',
    cursor: 'pointer',
  })

  const userSectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    fontSize: 13,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  const mobileNavStyle = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
    zIndex: 100,
  }

  const mobileTabStyle = (active) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '4px 0',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: 10,
    fontWeight: active ? 600 : 400,
    flex: 1,
    transition: 'color 0.15s',
  })

  const mainStyle = {
    marginLeft: isDesktop ? 240 : 0,
    paddingBottom: isDesktop ? 0 : 'calc(60px + env(safe-area-inset-bottom, 0px))',
    minHeight: '100vh',
    backgroundColor: 'var(--bg)',
  }

  const contentStyle = {
    maxWidth: 720,
    margin: '0 auto',
    padding: '16px 16px 80px',
  }

  const fabStyle = {
    position: 'fixed',
    right: isDesktop ? 24 : 20,
    bottom: isDesktop ? 24 : 'calc(72px + env(safe-area-inset-bottom, 0px))',
    width: isDesktop ? 48 : 56,
    height: isDesktop ? 48 : 56,
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    color: '#fff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
    zIndex: 200,
    transition: 'transform 0.15s, box-shadow 0.15s',
  }

  return (
    <>
      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside style={sidebarStyle}>
          <div style={logoStyle}>
            <Wallet size={22} />
            Ledgr
          </div>
          <nav style={navStyle}>
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon]
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={navItemStyle(active)}
                >
                  {Icon && <Icon size={20} />}
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div style={userSectionStyle}>
            {profile?.full_name || 'User'}
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main style={mainStyle}>
        <div style={contentStyle}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      {!isDesktop && (
        <nav style={mobileNavStyle}>
          {NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon]
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                style={mobileTabStyle(active)}
              >
                {Icon && <Icon size={22} />}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {/* FAB */}
      <button
        style={fabStyle}
        onClick={onQuickAdd}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
        aria-label="Quick add"
      >
        <Plus size={isDesktop ? 22 : 26} />
      </button>
    </>
  )
}
