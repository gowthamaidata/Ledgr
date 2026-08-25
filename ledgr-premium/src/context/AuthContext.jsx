import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadProfile(s.user.id)
        checkAdmin()
      } else {
        setLoading(false)
        setAdminLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadProfile(s.user.id)
        checkAdmin()
      } else {
        setProfile(null)
        setIsAdmin(false)
        setLoading(false)
        setAdminLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // Profile missing — self-heal by creating one
        const { data: userData } = await supabase.auth.getUser()
        const meta = userData?.user?.user_metadata || {}
        const { data: newProfile } = await supabase.from('profiles').insert({
          id: userId,
          full_name: meta.full_name || meta.name || '',
          currency: 'INR',
          onboarding_completed: false,
        }).select().single()
        setProfile(newProfile)
      } else if (data) {
        setProfile(data)
      }
    } catch (err) {
      console.error('Profile load error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function checkAdmin() {
    try {
      const { data } = await supabase.rpc('is_app_admin')
      setIsAdmin(!!data)
    } catch {
      setIsAdmin(false)
    } finally {
      setAdminLoading(false)
    }
  }

  async function updateProfile(updates) {
    if (!user) return
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{
      session, user, profile, isAdmin, loading, adminLoading,
      updateProfile, signOut, refreshProfile: () => user && loadProfile(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
