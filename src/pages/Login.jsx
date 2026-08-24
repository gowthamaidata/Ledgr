import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Mail, Lock } from 'lucide-react'
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
      <div style={cardStyle}>
        <div style={brandStyle}>
          <Wallet size={28} style={{ color: 'var(--accent)' }} />
          <span style={titleStyle}>Ledgr</span>
        </div>
        <p style={subtitleStyle}>Your daily money journal</p>

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
          <Input
            label="Password"
            type="password"
            icon={Lock}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '20px' }}>
            <Link to="/forgot-password" style={linkStyle}>
              Forgot password?
            </Link>
          </div>

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Sign in
          </Button>
        </form>

        <div style={footerStyle}>
          Don't have an account?{' '}
          <Link to="/signup" style={linkStyle}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
