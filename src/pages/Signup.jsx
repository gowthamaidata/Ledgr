import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Mail, Lock, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import Input from '../components/Input'
import Button from '../components/Button'

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--bg)',
  padding: '20px',
}

const cardStyle = {
  width: '100%',
  maxWidth: '400px',
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
  padding: '40px 32px',
}

const brandStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  marginBottom: '8px',
}

const titleStyle = {
  fontSize: '28px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  letterSpacing: '-0.5px',
}

const subtitleStyle = {
  fontSize: '14px',
  color: 'var(--text-muted)',
  textAlign: 'center',
  marginBottom: '32px',
}

const linkStyle = {
  color: 'var(--accent)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500,
}

const footerStyle = {
  textAlign: 'center',
  marginTop: '24px',
  fontSize: '14px',
  color: 'var(--text-muted)',
}

const successBoxStyle = {
  backgroundColor: 'var(--accent-light)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius)',
  padding: '16px 20px',
  textAlign: 'center',
}

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

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={brandStyle}>
            <Wallet size={28} style={{ color: 'var(--accent)' }} />
            <span style={titleStyle}>Ledgr</span>
          </div>
          <div style={{ ...successBoxStyle, marginTop: '24px' }}>
            <p style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '8px' }}>
              Check your email for confirmation
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              We sent a verification link to <strong>{email}</strong>
            </p>
          </div>
          <div style={footerStyle}>
            <Link to="/login" style={linkStyle}>
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={brandStyle}>
          <Wallet size={28} style={{ color: 'var(--accent)' }} />
          <span style={titleStyle}>Ledgr</span>
        </div>
        <p style={subtitleStyle}>Create your account</p>

        <form onSubmit={handleSubmit}>
          <Input
            label="Full name"
            type="text"
            icon={User}
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            icon={Mail}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            icon={Lock}
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirm password"
            type="password"
            icon={Lock}
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Create account
          </Button>
        </form>

        <div style={footerStyle}>
          Already have an account?{' '}
          <Link to="/login" style={linkStyle}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
