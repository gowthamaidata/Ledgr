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

  // Only first 4 nav items for mobile (Home, Transactions, Insights, Planning)
  const mobileNavItems = NAV_ITEMS.slice(0, 4)

  const sidebarStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    background: 'linear-gradient(180deg, #0F1729 0%, #1a2540 100%)',
    borderRight: '1px solid rgba(212, 168, 83, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  }

  const logoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '28px 20px 24px',
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.02em',
  }

  const logoIconWrapperStyle = {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #D4A853 0%, #b8912e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(212, 168, 83, 0.3)',
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
    color: active ? '#D4A853' : 'rgba(255, 255, 255, 0.6)',
    backgroundColor: active ? 'rgba(212, 168, 83, 0.1)' : 'transparent',
    fontWeight: active ? 600 : 400,
    fontSize: 14,
    textDecoration: 'none',
    transition: 'background-color 0.15s, color 0.15s',
    cursor: 'pointer',
    borderLeft: active ? '3px solid #D4A853' : '3px solid transparent',
  })

  const userSectionStyle = {
    padding: '16px 20px',
    borderTop: '1px solid rgba(212, 168, 83, 0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }

  const userAvatarStyle = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4A853 0%, #b8912e 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0F1729',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  }

  const userInfoStyle = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 500,
  }

  const mobileNavStyle = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
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
    color: active ? '#D4A853' : 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: 10,
    fontWeight: active ? 600 : 400,
    flex: 1,
    transition: 'color 0.15s',
    position: 'relative',
  })

  const mobileActiveIndicatorStyle = {
    position: 'absolute',
    top: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D4A853',
  }

  const fabMobileStyle = {
    width: 52,
    height: 52,
    borderRadius: '50%',
    backgroundColor: '#0F1729',
    color: '#D4A853',
    border: '3px solid #ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(15, 23, 41, 0.3)',
    zIndex: 200,
    transition: 'transform 0.15s, box-shadow 0.15s',
    marginTop: -26,
    flexShrink: 0,
  }

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

  const fabDesktopStyle = {
    position: 'fixed',
    right: 24,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: '#0F1729',
    color: '#D4A853',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(15, 23, 41, 0.4)',
    zIndex: 200,
    transition: 'transform 0.15s, box-shadow 0.15s',
  }

  const userName = profile?.full_name || 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <>
      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside style={sidebarStyle}>
          <div style={logoStyle}>
            <div style={logoIconWrapperStyle}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0F1729' }}>L</span>
            </div>
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
            <div style={userAvatarStyle}>
              {userInitial}
            </div>
            <div style={userInfoStyle}>
              {userName}
            </div>
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
          {mobileNavItems.slice(0, 2).map((item) => {
            const Icon = ICON_MAP[item.icon]
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                style={mobileTabStyle(active)}
              >
                {active && <div style={mobileActiveIndicatorStyle} />}
                {Icon && <Icon size={22} />}
                <span>{item.label}</span>
              </Link>
            )
          })}

          {/* Center FAB */}
          <button
            style={fabMobileStyle}
            onClick={onQuickAdd}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
            aria-label="Quick add"
          >
            <Plus size={24} />
          </button>

          {mobileNavItems.slice(2, 4).map((item) => {
            const Icon = ICON_MAP[item.icon]
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                style={mobileTabStyle(active)}
              >
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
        <button
          style={fabDesktopStyle}
          onClick={onQuickAdd}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 23, 41, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 23, 41, 0.4)'
          }}
          aria-label="Quick add"
        >
          <Plus size={22} />
        </button>
      )}
    </>
  )
}
