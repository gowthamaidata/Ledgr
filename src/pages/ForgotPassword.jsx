import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const toast = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      setSent(true)
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px 14px 48px',
    fontSize: '15px',
    fontFamily: 'inherit',
    color: '#0F1729',
    backgroundColor: '#F9FAFB',
    border: '1.5px solid #E5E7EB',
    borderRadius: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const focusHandler = (e) => {
    e.target.style.borderColor = '#D4A853'
    e.target.style.boxShadow = '0 0 0 3px rgba(212, 168, 83, 0.15)'
  }

  const blurHandler = (e) => {
    e.target.style.borderColor = '#E5E7EB'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at 50% 30%, #1a2744, #0F1729)',
    }}>
      {/* Top branding */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px 40px',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #D4A853, #E8C97A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', fontWeight: 700, color: '#0F1729',
          boxShadow: '0 8px 32px rgba(212, 168, 83, 0.3)',
          marginBottom: '16px',
        }}>L</div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Ledgr</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Reset your password</p>
      </div>

      {/* Form card */}
      <div style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: '32px 32px 0 0',
        padding: '40px 28px 48px',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.1)',
      }}>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              backgroundColor: 'rgba(212, 168, 83, 0.1)',
              border: '1px solid rgba(212, 168, 83, 0.3)',
              borderRadius: '16px',
              padding: '24px 20px',
              marginBottom: '24px',
            }}>
              <p style={{ fontSize: '16px', color: '#0F1729', fontWeight: 600, marginBottom: '8px' }}>
                Reset link sent
              </p>
              <p style={{ fontSize: '14px', color: '#4B5563' }}>
                Check <strong>{email}</strong> for a password reset link
              </p>
            </div>
            <Link to="/login" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#D4A853',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p style={{
              fontSize: '14px',
              color: '#9CA3AF',
              textAlign: 'center',
              marginBottom: '28px',
              lineHeight: 1.5,
            }}>
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4B5563', marginBottom: '6px' }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #D4A853, #E8C97A)',
                  color: '#0F1729',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                  boxShadow: '0 4px 16px rgba(212, 168, 83, 0.3)',
                }}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link to="/login" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#D4A853',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
