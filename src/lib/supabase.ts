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
