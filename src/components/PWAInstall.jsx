/**
 * PWAInstall — shows a tasteful "Add to Home Screen" banner
 * on mobile browsers that support the beforeinstallprompt event (Android/Chrome).
 * On iOS Safari it shows manual install instructions.
 * Dismisses permanently via localStorage.
 */
import { useState, useEffect } from 'react'
import { Download, X, Share } from 'lucide-react'

const DISMISSED_KEY = 'ledgr-pwa-dismissed'
const NAVY = '#0F1729'
const GOLD = '#D4A853'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return // already installed
    if (localStorage.getItem(DISMISSED_KEY)) return

    setIos(isIOS())

    // Android/Chrome install prompt
    const handler = e => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShow(true), 3000) // delay so it's not jarring
    }

    window.addEventListener('beforeinstallprompt', handler)

    // iOS: show instructions after delay
    if (isIOS()) {
      setTimeout(() => setShow(true), 4000)
    }

    // Detect successful install
    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setShow(false)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
      left: 16, right: 16, zIndex: 8000,
      backgroundColor: NAVY,
      border: `1px solid ${GOLD}44`,
      borderRadius: 20,
      padding: '16px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      animation: 'pwaSlideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <style>{`@keyframes pwaSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }`}</style>

      {/* Icon */}
      <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>L</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Install Ledgr
        </div>
        {ios ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            Tap <Share size={12} style={{ display: 'inline', verticalAlign: 'middle', color: GOLD }} /> <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Share</strong> then <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Add to Home Screen</strong>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 12 }}>
              Install for offline access and a faster experience
            </div>
            <button onClick={handleInstall} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: GOLD, color: NAVY, border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Download size={14} />
              Install App
            </button>
          </>
        )}
      </div>

      {/* Dismiss */}
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 2, flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  )
}
