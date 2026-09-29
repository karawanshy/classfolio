import { useCallback, useSyncExternalStore } from 'react'
import { api, ReactionsUnavailableError } from './api'
import type { ReactionKey, ReactionTotal } from './types'

/** One site's reactions: everyone's counts and which of them are the visitor's own. */
export interface SiteReactions {
  counts: Partial<Record<ReactionKey, number>>
  mine: readonly ReactionKey[]
}

const EMPTY: SiteReactions = { counts: {}, mine: [] }

// Snapshots are replaced per site, never mutated, so each card only re-renders for its own changes.
let bySite = new Map<string, SiteReactions>()
let available = api.mode === 'supabase'
const listeners = new Set<() => void>()
let started = false

// Live totals: the version of the total shown for each `${siteId}:${key}` (0 = from a full load).
const versions = new Map<string, number>()
// The visitor's own requests in flight. Live totals for these wait in `deferred` until the request settles,
// so a click never flickers back and forth.
const pending = new Set<string>()
const deferred = new Map<string, ReactionTotal>()
// Totals that arrived while a full load was in flight, re-applied on top of its (older) snapshot.
let arrivedDuringLoad: ReactionTotal[] | null = null
let loadId = 0
// Bumped by every toggle, so a load that raced one is discarded (and redone) instead of undoing it.
let toggles = 0
let reloadWhenIdle = false

function emit() {
  listeners.forEach((l) => l())
}

function setSite(siteId: string, state: SiteReactions) {
  bySite = new Map(bySite).set(siteId, state)
}

function withToggle(state: SiteReactions, key: ReactionKey, on: boolean): SiteReactions {
  const count = Math.max(0, (state.counts[key] ?? 0) + (on ? 1 : -1))
  return {
    counts: { ...state.counts, [key]: count },
    mine: on ? [...state.mine.filter((k) => k !== key), key] : state.mine.filter((k) => k !== key),
  }
}

/** Show a total unless a newer one is already shown. */
function applyTotal(total: ReactionTotal): boolean {
  const id = `${total.site_id}:${total.reaction}`
  if (total.version <= (versions.get(id) ?? 0)) return false
  versions.set(id, total.version)
  const cur = bySite.get(total.site_id) ?? EMPTY
  setSite(total.site_id, { ...cur, counts: { ...cur.counts, [total.reaction]: total.count } })
  return true
}

function onLiveTotal(total: ReactionTotal) {
  arrivedDuringLoad?.push(total)
  const id = `${total.site_id}:${total.reaction}`
  if (pending.has(id)) {
    if (total.version > (deferred.get(id)?.version ?? 0)) deferred.set(id, total)
  } else if (applyTotal(total)) {
    emit()
  }
}

async function load() {
  const id = ++loadId
  const t = toggles
  arrivedDuringLoad = []
  try {
    const { counts, mine } = await api.reactions()
    if (id !== loadId) return
    if (t !== toggles || pending.size > 0) {
      reloadWhenIdle = true
      return
    }
    const next = new Map<string, { counts: SiteReactions['counts']; mine: ReactionKey[] }>()
    const entry = (siteId: string) => {
      let e = next.get(siteId)
      if (!e) next.set(siteId, (e = { counts: {}, mine: [] }))
      return e
    }
    counts.forEach((row) => (entry(row.site_id).counts[row.reaction] = row.count))
    mine.forEach((row) => entry(row.site_id).mine.push(row.reaction))
    bySite = next
    versions.clear()
    arrivedDuringLoad.forEach(applyTotal)
    emit()
  } catch (err) {
    console.error('classfolio: loading reactions failed', err)
  } finally {
    if (id === loadId) arrivedDuringLoad = null
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!started && available) {
    started = true
    // Loads once connected, and again after any reconnect (live totals may have been missed).
    api.subscribeReactions(onLiveTotal, () => void load())
    // Signing in or out changes whose reactions are "mine".
    api.onAuthChange(() => void load())
  }
  return () => listeners.delete(cb)
}

/** Toggle the visitor's reaction optimistically; rolls back if the request fails. */
export async function toggleReaction(siteId: string, key: ReactionKey) {
  const id = `${siteId}:${key}`
  if (!available || pending.has(id)) return
  const on = !(bySite.get(siteId) ?? EMPTY).mine.includes(key)

  setSite(siteId, withToggle(bySite.get(siteId) ?? EMPTY, key, on))
  pending.add(id)
  toggles++
  emit()
  try {
    applyTotal(on ? await api.react(siteId, key) : await api.unreact(siteId, key))
  } catch (err) {
    setSite(siteId, withToggle(bySite.get(siteId) ?? EMPTY, key, !on))
    if (err instanceof ReactionsUnavailableError) {
      available = false
      console.warn(`classfolio: ${err.message}. Enable both in Supabase → Authentication → Sign In / Providers.`)
    } else {
      console.error('classfolio: saving a reaction failed', err)
    }
  } finally {
    pending.delete(id)
    const live = deferred.get(id)
    deferred.delete(id)
    if (live) applyTotal(live)
    toggles++
    emit()
    if (reloadWhenIdle && pending.size === 0) {
      reloadWhenIdle = false
      void load()
    }
  }
}

export function useSiteReactions(siteId: string) {
  const getSnapshot = useCallback(() => bySite.get(siteId) ?? EMPTY, [siteId])
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const isAvailable = useSyncExternalStore(subscribe, () => available)
  return { ...state, available: isAvailable }
}
