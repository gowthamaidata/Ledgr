import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

const navy = '#0F1729'
const gold = '#D4A853'
const goldLight = '#E8C97A'

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  background: `radial-gradient(ellipse at 50% 30%, #1a2744 0%, ${navy} 70%)`,
  position: 'relative',
  overflow: 'hidden',
}

const topSectionStyle = {
  flex: '0 0 auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: '64px',
  paddingBottom: '40px',
  width: '100%',
}

const logoContainerStyle = {
  width: '72px',
  height: '72px',
  borderRadius: '18px',
  background: `linear-gradient(135deg, ${gold}, ${goldLight})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '16px',
  boxShadow: '0 8px 32px rgba(212, 168, 83, 0.3)',
}

const logoLetterStyle = {
  fontSize: '36px',
  fontWeight: 700,
  color: navy,
  lineHeight: 1,
  fontFamily: "'Georgia', serif",
}

const titleStyle = {
  fontSize: '32px',
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: '-0.5px',
  marginBottom: '8px',
}

const taglineStyle = {
  fontSize: '15px',
  color: 'rgba(255, 255, 255, 0.5)',
  margin: 0,
}

const formCardStyle = {
  flex: 1,
  width: '100%',
  maxWidth: '100%',
  backgroundColor: '#ffffff',
  borderRadius: '32px 32px 0 0',
  padding: '40px 28px 32px',
  display: 'flex',
  flexDirection: 'column',
}

const formInnerStyle = {
  width: '100%',
  maxWidth: '400px',
  margin: '0 auto',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
}

const labelStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
  display: 'block',
}

const inputWrapperStyle = {
  position: 'relative',
  marginBottom: '20px',
}

const inputStyle = {
  width: '100%',
  padding: '14px 16px 14px 46px',
  fontSize: '15px',
  border: '1.5px solid #E5E7EB',
  borderRadius: '12px',
  outline: 'none',
  backgroundColor: '#F9FAFB',
  color: '#1F2937',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
}

const inputIconStyle = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#9CA3AF',
  display: 'flex',
  alignItems: 'center',
}

const buttonStyle = {
  width: '100%',
  padding: '15px',
  fontSize: '16px',
  fontWeight: 600,
  color: '#ffffff',
  background: `linear-gradient(135deg, ${gold}, ${goldLight})`,
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  marginTop: '8px',
  boxShadow: '0 4px 16px rgba(212, 168, 83, 0.35)',
  transition: 'opacity 0.2s, transform 0.1s',
  letterSpacing: '0.3px',
}

const footerStyle = {
  textAlign: 'center',
  marginTop: '28px',
  fontSize: '14px',
  color: '#6B7280',
}

const linkStyle = {
  color: gold,
  textDecoration: 'none',
  fontWeight: 600,
}

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 4L12 13L2 4" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={topSectionStyle}>
        <div style={logoContainerStyle}>
          <span style={logoLetterStyle}>L</span>
        </div>
        <h1 style={titleStyle}>Ledgr</h1>
        <p style={taglineStyle}>Your daily money journal</p>
      </div>

      <div style={formCardStyle}>
        <div style={formInnerStyle}>
          <form onSubmit={handleSubmit}>
            <div style={inputWrapperStyle}>
              <label style={labelStyle}>Email</label>
              <div style={{ position: 'relative' }}>
                <span style={inputIconStyle}>
                  <EnvelopeIcon />
                </span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = gold
                    e.target.style.boxShadow = `0 0 0 3px rgba(212, 168, 83, 0.15)`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            <div style={inputWrapperStyle}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <span style={inputIconStyle}>
                  <LockIcon />
                </span>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = gold
                    e.target.style.boxShadow = `0 0 0 3px rgba(212, 168, 83, 0.15)`
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={footerStyle}>
            Don't have an account?{' '}
            <Link to="/signup" style={linkStyle}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
