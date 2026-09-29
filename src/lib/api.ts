import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Site, SiteChange, SiteInput } from './types'

export interface GalleryApi {
  readonly mode: 'supabase' | 'unconfigured'
  list(): Promise<Site[]>
  /** `honeypot` is the hidden field's value; the DB rejects anything non-empty. */
  add(input: SiteInput, honeypot: string): Promise<Site>
  update(id: string, input: SiteInput): Promise<Site>
  remove(id: string): Promise<void>
  /** Whether the current session belongs to a user in `admins`. */
  isAdmin(): Promise<boolean>
  /** Resolves true only for a valid login whose user is an admin; non-admins are signed straight out. */
  signIn(email: string, password: string): Promise<boolean>
  signOut(): Promise<void>
  onAuthChange(cb: () => void): () => void
  subscribe(cb: (change: SiteChange) => void): () => void
}

const COLUMNS = 'id, creator_name, site_url, github_url, screenshot_url, created_at'

function supabaseApi(client: SupabaseClient): GalleryApi {
  async function isAdmin() {
    const { data } = await client.auth.getSession()
    const uid = data.session?.user.id
    if (!uid) return false
    const { data: row, error } = await client.from('admins').select('user_id').eq('user_id', uid).maybeSingle()
    return !error && !!row
  }

  return {
    mode: 'supabase',
    async list() {
      const { data, error } = await client.from('sites').select(COLUMNS).order('created_at', { ascending: false })
      if (error) throw error
      return data as Site[]
    },
    async add(input, honeypot) {
      const { data, error } = await client
        .from('sites')
        .insert({ ...input, honeypot: honeypot || null })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return data as Site
    },
    async update(id, input) {
      const { data, error } = await client.from('sites').update(input).eq('id', id).select(COLUMNS).single()
      if (error) throw error
      return data as Site
    },
    async remove(id) {
      const { error, count } = await client.from('sites').delete({ count: 'exact' }).eq('id', id)
      if (error) throw error
      if (count === 0) throw new Error('Not allowed')
    },
    isAdmin,
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) return false
      if (await isAdmin()) return true
      await client.auth.signOut()
      return false
    },
    async signOut() {
      await client.auth.signOut()
    },
    onAuthChange(cb) {
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          // Defer: calling Supabase inside this callback can deadlock the auth lock.
          setTimeout(cb, 0)
        }
      })
      return () => data.subscription.unsubscribe()
    },
    subscribe(cb) {
      const channel = client
        .channel('public:sites')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Partial<Site>).id
            if (id) cb({ type: 'delete', id })
          } else {
            cb({ type: 'upsert', site: payload.new as Site })
          }
        })
        .subscribe()
      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Without Supabase config: fail closed (load error, no logins). */
function unconfiguredApi(): GalleryApi {
  const fail = () => Promise.reject(new Error('Supabase is not configured'))
  return {
    mode: 'unconfigured',
    list: fail,
    add: fail,
    update: fail,
    remove: fail,
    isAdmin: async () => false,
    signIn: async () => false,
    signOut: async () => {},
    onAuthChange: () => () => {},
    subscribe: () => () => {},
  }
}

export const api: GalleryApi =
  url && anonKey
    ? supabaseApi(createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }))
    : unconfiguredApi()

if (api.mode === 'unconfigured') {
  console.warn('classfolio: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).')
}
