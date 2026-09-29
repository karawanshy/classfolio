import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ReactionKey, ReactionsSnapshot, ReactionTotal, Site, SiteChange, SiteInput } from './types'

/** Thrown by react/unreact when visitors can't get a session (anonymous sign-in is disabled). */
export class ReactionsUnavailableError extends Error {
  constructor() {
    super('Reactions are unavailable: anonymous sign-ins (or all sign-ups) are disabled')
  }
}

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
  /** Everyone's counts, plus the current visitor's own reactions. */
  reactions(): Promise<ReactionsSnapshot>
  /** Signs the visitor in anonymously first if they have no session yet. Resolves with the new total. */
  react(siteId: string, reaction: ReactionKey): Promise<ReactionTotal>
  unreact(siteId: string, reaction: ReactionKey): Promise<ReactionTotal>
  /** Every visitor's changes, live, as new totals. `onResync` fires when (re)connected, as events may have been missed. */
  subscribeReactions(cb: (total: ReactionTotal) => void, onResync: () => void): () => void
}

const VISITOR_KEY = 'classfolio:visitor-session'

function stashVisitor({ access_token, refresh_token }: { access_token: string; refresh_token: string }) {
  try {
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ access_token, refresh_token }))
  } catch {
    /* ignore: the visitor just starts fresh after logout */
  }
}

function takeVisitor(): { access_token: string; refresh_token: string } | null {
  try {
    const raw = localStorage.getItem(VISITOR_KEY)
    localStorage.removeItem(VISITOR_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
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

  async function setReaction(siteId: string, reaction: ReactionKey, on: boolean): Promise<ReactionTotal> {
    const { data, error } = await client
      .rpc('set_reaction', { p_site_id: siteId, p_reaction: reaction, p_on: on })
      .single<{ total: number; version: number }>()
    if (error) throw error
    return { site_id: siteId, reaction, count: data.total, version: data.version }
  }

  // Shared, so parallel first reactions don't each create an anonymous user.
  let anonSignIn: Promise<void> | null = null
  async function ensureSession() {
    const { data } = await client.auth.getSession()
    if (data.session) return
    anonSignIn ??= client.auth
      .signInAnonymously()
      .then(({ error }) => {
        // Supabase refuses anonymous sign-ins when they're off, and also when all sign-ups are off.
        if (error?.code === 'anonymous_provider_disabled' || error?.code === 'signup_disabled') {
          throw new ReactionsUnavailableError()
        }
        if (error) throw error
      })
      .finally(() => (anonSignIn = null))
    await anonSignIn
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
      // An admin login replaces this browser's anonymous visitor session. Keep it aside so logging out
      // brings the visitor (and which reactions are theirs) back.
      const { data } = await client.auth.getSession()
      const visitor = data.session?.user.is_anonymous ? data.session : null
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) return false
      if (await isAdmin()) {
        if (visitor) stashVisitor(visitor)
        return true
      }
      await client.auth.signOut()
      if (visitor) await client.auth.setSession(visitor)
      return false
    },
    async signOut() {
      await client.auth.signOut()
      const visitor = takeVisitor()
      if (visitor) {
        const { error } = await client.auth.setSession(visitor)
        if (error) console.warn('classfolio: couldn’t restore the visitor session', error)
      }
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
    async reactions() {
      const [counts, session] = await Promise.all([client.rpc('site_reaction_counts'), client.auth.getSession()])
      if (counts.error) throw counts.error
      let mine: ReactionsSnapshot['mine'] = []
      if (session.data.session) {
        // RLS returns only the visitor's own rows.
        const { data, error } = await client.from('site_reactions').select('site_id, reaction')
        if (error) throw error
        mine = data as ReactionsSnapshot['mine']
      }
      return { counts: counts.data as ReactionsSnapshot['counts'], mine }
    },
    async react(siteId, reaction) {
      await ensureSession()
      return setReaction(siteId, reaction, true)
    },
    unreact: (siteId, reaction) => setReaction(siteId, reaction, false),
    subscribeReactions(cb, onResync) {
      // Broadcast by set_reaction() in the database: totals only, never who reacted.
      const channel = client
        .channel('site_reactions')
        .on('broadcast', { event: 'count' }, ({ payload }) => cb(payload as ReactionTotal))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') onResync()
        })
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
    reactions: fail,
    react: fail,
    unreact: fail,
    subscribeReactions: () => () => {},
  }
}

export const api: GalleryApi =
  url && anonKey
    ? supabaseApi(createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }))
    : unconfiguredApi()

if (api.mode === 'unconfigured') {
  console.warn('classfolio: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).')
}
