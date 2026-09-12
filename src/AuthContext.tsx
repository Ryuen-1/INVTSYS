import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from './utils/supabase'
import type { Profile } from './types'

type AuthContextValue = {
  user: User | null
  profile: Profile | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id, branches(name)')
      .eq('id', userId)
      .single()

    if (error) {
      throw error
    }

    setProfile(data as unknown as Profile)
  }, [])

  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await loadProfile(user.id)
    }
  }, [loadProfile])

  useEffect(() => {
    let isMounted = true

    async function bootstrapAuth() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      setSession(currentSession)

      if (currentSession?.user) {
        try {
          await loadProfile(currentSession.user.id)
        } catch {
          setProfile(null)
        }
      }

      setIsLoading(false)
    }

    bootstrapAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)

      if (nextSession?.user) {
        loadProfile(nextSession.user.id).catch(() => setProfile(null))
      } else {
        setProfile(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      profile,
      session,
      isLoading,
      async signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw error
        }
      },
      async signOut() {
        const { error } = await supabase.auth.signOut()

        if (error) {
          throw error
        }
      },
      refreshProfile,
    }),
    [isLoading, profile, refreshProfile, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
