import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState({})
  const toast = useToast()

  function validate() {
    const errs = {}
    if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters'
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      if (error) throw error
      setSuccess(true)
    } catch (err) {
      toast.error(err.message || 'Failed to create account')
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

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(ellipse at 50% 30%, #1a2744, #0F1729)',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #D4A853, #E8C97A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', fontWeight: 700, color: '#0F1729',
            boxShadow: '0 8px 32px rgba(212, 168, 83, 0.3)',
            marginBottom: '16px',
          }}>L</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Ledgr</h1>
        </div>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '32px 32px 0 0',
          padding: '40px 28px 48px',
          textAlign: 'center',
        }}>
          <div style={{
            backgroundColor: 'rgba(212, 168, 83, 0.1)',
            border: '1px solid rgba(212, 168, 83, 0.3)',
            borderRadius: '16px',
            padding: '24px 20px',
            marginBottom: '24px',
          }}>
            <p style={{ fontSize: '16px', color: '#0F1729', fontWeight: 600, marginBottom: '8px' }}>
              Check your email for confirmation
            </p>
            <p style={{ fontSize: '14px', color: '#4B5563' }}>
              We sent a verification link to <strong>{email}</strong>
            </p>
          </div>
          <Link to="/login" style={{ color: '#D4A853', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
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
        padding: '48px 24px 32px',
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
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Create your account</p>
      </div>

      {/* Form card */}
      <div style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: '32px 32px 0 0',
        padding: '36px 28px 48px',
        boxShadow: '0 -4px 30px rgba(0,0,0,0.1)',
      }}>
        <form onSubmit={handleSubmit}>
          {/* Full name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4B5563', marginBottom: '6px' }}>Full name</label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input type="text" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4B5563', marginBottom: '6px' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4B5563', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            {errors.password && <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors.password}</div>}
          </div>

          {/* Confirm password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#4B5563', marginBottom: '6px' }}>Confirm password</label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" style={inputStyle} onFocus={focusHandler} onBlur={blurHandler} />
            </div>
            {errors.confirmPassword && <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors.confirmPassword}</div>}
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#9CA3AF' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#D4A853', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
