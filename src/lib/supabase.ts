import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/supabase'

const serverEnv = typeof process !== "undefined" ? process.env : {}
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? serverEnv.VITE_SUPABASE_URL ?? serverEnv.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? serverEnv.VITE_SUPABASE_ANON_KEY ?? serverEnv.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Server-side client for API routes
export const createServerSupabaseClient = () => {
  const serviceRoleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
