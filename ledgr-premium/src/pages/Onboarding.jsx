import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, Sparkles, CheckCircle2, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
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
  maxWidth: '480px',
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
  padding: '40px 32px',
}

const progressStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginBottom: '32px',
}

const headingStyle = {
  fontSize: '22px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  textAlign: 'center',
  marginBottom: '8px',
  letterSpacing: '-0.3px',
}

const descStyle = {
  fontSize: '14px',
  color: 'var(--text-muted)',
  textAlign: 'center',
  lineHeight: 1.6,
  marginBottom: '32px',
}

const accountRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  backgroundColor: 'var(--bg)',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  marginBottom: '8px',
}

const checkboxStyle = {
  width: '18px',
  height: '18px',
  accentColor: 'var(--accent)',
  cursor: 'pointer',
  flexShrink: 0,
}

const accountInputStyle = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: '14px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
}

const buttonRowStyle = {
  display: 'flex',
  gap: '12px',
  marginTop: '24px',
}

const celebrationStyle = {
  fontSize: '48px',
  textAlign: 'center',
  marginBottom: '16px',
}

const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: 'Cash', enabled: true },
  { id: 'bank', name: 'Bank', enabled: true },
  { id: 'credit_card', name: 'Credit Card', enabled: true },
  { id: 'upi', name: 'UPI', enabled: true },
]

function StepDot({ active, completed }) {
  return (
    <div
      style={{
        width: active ? '24px' : '8px',
        height: '8px',
        borderRadius: '4px',
        backgroundColor: active || completed ? 'var(--accent)' : 'var(--border)',
        transition: 'all 0.2s ease',
      }}
    />
  )
}

function StepWelcome({ profile, onNext }) {
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Sparkles size={40} style={{ color: 'var(--accent)' }} />
      </div>
      <h2 style={headingStyle}>Welcome, {firstName}</h2>
      <p style={descStyle}>
        Ledgr is your daily money journal. Track expenses, manage accounts,
        and understand where your money goes -- all in one place.
      </p>
      <Button fullWidth size="lg" onClick={onNext}>
        Get started
      </Button>
    </>
  )
}

function StepAccounts({ accounts, setAccounts, onBack, onNext }) {
  function toggleAccount(id) {
    setAccounts(prev =>
      prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    )
  }

  function renameAccount(id, name) {
    setAccounts(prev =>
      prev.map(a => a.id === id ? { ...a, name } : a)
    )
  }

  return (
    <>
      <h2 style={headingStyle}>Your accounts</h2>
      <p style={descStyle}>
        We've set up these default accounts for you. You can rename or toggle them as needed.
      </p>

      <div style={{ marginBottom: '8px' }}>
        {accounts.map(account => (
          <div key={account.id} style={accountRowStyle}>
            <input
              type="checkbox"
              checked={account.enabled}
              onChange={() => toggleAccount(account.id)}
              style={checkboxStyle}
            />
            <input
              type="text"
              value={account.name}
              onChange={(e) => renameAccount(account.id, e.target.value)}
              style={{
                ...accountInputStyle,
                opacity: account.enabled ? 1 : 0.4,
              }}
              disabled={!account.enabled}
            />
            <Pencil
              size={14}
              style={{ color: 'var(--text-muted)', flexShrink: 0 }}
            />
          </div>
        ))}
      </div>

      <div style={buttonRowStyle}>
        <Button variant="secondary" size="lg" onClick={onBack} style={{ flex: 1 }}>
          Back
        </Button>
        <Button size="lg" onClick={onNext} style={{ flex: 2 }}>
          Continue
        </Button>
      </div>
    </>
  )
}

function StepDone({ loading, onFinish }) {
  return (
    <>
      <div style={celebrationStyle}>
        <CheckCircle2 size={56} style={{ color: 'var(--accent)' }} />
      </div>
      <h2 style={headingStyle}>You're all set!</h2>
      <p style={descStyle}>
        Your accounts are ready. Start tracking your first expense and take
        control of your finances.
      </p>
      <Button fullWidth size="lg" loading={loading} onClick={onFinish}>
        Go to dashboard
      </Button>
    </>
  )
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS)
  const [loading, setLoading] = useState(false)
  const { profile, updateProfile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  async function handleFinish() {
    setLoading(true)
    try {
      await updateProfile({ onboarding_completed: true })
      navigate('/')
    } catch (err) {
      toast.error(err.message || 'Failed to complete onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={progressStyle}>
          <StepDot active={step === 0} completed={step > 0} />
          <StepDot active={step === 1} completed={step > 1} />
          <StepDot active={step === 2} completed={step > 2} />
        </div>

        {step === 0 && (
          <StepWelcome profile={profile} onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <StepAccounts
            accounts={accounts}
            setAccounts={setAccounts}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepDone loading={loading} onFinish={handleFinish} />
        )}
      </div>
    </div>
  )
}
