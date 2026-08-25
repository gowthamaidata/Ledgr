import { useState, useEffect, useCallback, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import DailyReview from './pages/DailyReview';
import Insights from './pages/Insights';
import Planning from './pages/Planning';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import QuickAdd from './pages/QuickAdd';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'Inter, system-ui, sans-serif',
            backgroundColor: 'var(--color-bg, #fafaf9)',
            color: 'var(--color-text, #1c1917)',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--color-text-secondary, #78716c)', marginBottom: '1.5rem' }}>
            An unexpected error occurred. Please try reloading the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: 'var(--color-primary, #0F1729)',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleQuickAddSave = useCallback(() => {
    setQuickAddOpen(false);
    setEditTransaction(null);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleEditTransaction = useCallback((tx) => {
    setEditTransaction(tx);
    setQuickAddOpen(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = e.target.tagName;
        const isEditable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          e.target.isContentEditable;
        if (!isEditable) {
          e.preventDefault();
          setQuickAddOpen(true);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Layout onQuickAdd={() => setQuickAddOpen(true)} refreshKey={refreshKey}>
        <Routes>
          <Route index element={<Dashboard refreshKey={refreshKey} />} />
          <Route path="transactions" element={<Transactions refreshKey={refreshKey} onEditTransaction={handleEditTransaction} />} />
          <Route path="daily-review" element={<DailyReview />} />
          <Route path="insights" element={<Insights />} />
          <Route path="planning" element={<Planning />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<Admin />} />
        </Routes>
      </Layout>
      <QuickAdd
        open={quickAddOpen}
        onClose={() => { setQuickAddOpen(false); setEditTransaction(null); }}
        onSaved={handleQuickAddSave}
        editTransaction={editTransaction}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Onboarding — protected but no layout */}
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />

                {/* Protected routes with Layout */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
