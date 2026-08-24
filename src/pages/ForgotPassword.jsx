import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Mail, ArrowLeft } from 'lucide-react'
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
  lineHeight: 1.5,
}

const linkStyle = {
  color: 'var(--accent)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500,
}

const backLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: 'var(--text-muted)',
  textDecoration: 'none',
  fontSize: '14px',
  marginTop: '24px',
}

const successBoxStyle = {
  backgroundColor: 'var(--accent-light)',
  border: '1px solid var(--accent)',
  borderRadius: 'var(--radius)',
  padding: '16px 20px',
  textAlign: 'center',
}

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

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={brandStyle}>
          <Wallet size={28} style={{ color: 'var(--accent)' }} />
          <span style={titleStyle}>Ledgr</span>
        </div>

        {sent ? (
          <>
            <div style={{ ...successBoxStyle, marginTop: '24px' }}>
              <p style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '8px' }}>
                Reset link sent
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Check <strong>{email}</strong> for a password reset link
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={backLinkStyle}>
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <p style={subtitleStyle}>
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit}>
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

              <Button type="submit" fullWidth size="lg" loading={loading}>
                Send reset link
              </Button>
            </form>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={backLinkStyle}>
                <ArrowLeft size={14} />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
