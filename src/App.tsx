import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { SiteFormModal } from './components/SiteFormModal'
import { DeleteModal, LoginModal, SuccessModal } from './components/SmallModals'
import { EmptyState, LoadError, NoResults } from './components/States'
import { SpaceBackground } from './components/SpaceBackground'
import { Toolbar } from './components/Toolbar'
import { SkeletonWall, Wall, type ExitKind } from './components/Wall'
import { api } from './lib/api'
import { prefersReducedMotion, useIsMobile, useIsTablet } from './lib/hooks'
import type { Site, SiteInput } from './lib/types'
import './App.css'

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; site: Site }
  | { kind: 'success'; site: Site }
  | { kind: 'login' }
  | { kind: 'delete'; site: Site }

const JUST_ADDED_KEY = 'classfolio:just-added'

function sortSites(sites: Site[]): Site[] {
  return [...sites].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function matchesQuery(site: Site, q: string): boolean {
  return site.creator_name.toLowerCase().includes(q.trim().toLowerCase())
}

function readJustAdded(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(JUST_ADDED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export default function App() {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  const [sites, setSites] = useState<Site[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [isAdmin, setIsAdmin] = useState(false)
  const [query, setQueryState] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [justAdded, setJustAdded] = useState<Set<string>>(readJustAdded)
  const [holdRevealId, setHoldRevealId] = useState<string | null>(null)
  const [exitKind, setExitKind] = useState<ExitKind>('filter')
  const [announcement, setAnnouncement] = useState('')

  const triggerRef = useRef<HTMLElement | null>(null)
  const visitRefs = useRef(new Map<string, HTMLAnchorElement>())
  const mainRef = useRef<HTMLElement>(null)

  /* ---- Data ---- */

  const load = useCallback(() => {
    api
      .list()
      .then((rows) => {
        setSites(sortSites(rows))
        setStatus('ready')
      })
      .catch((err) => {
        console.error('classfolio: loading the gallery failed', err)
        setStatus('error')
      })
  }, [])

  useEffect(load, [load])

  useEffect(() => {
    const check = () => void api.isAdmin().then(setIsAdmin)
    check()
    return api.onAuthChange(check)
  }, [])

  // Live updates from other visitors (Supabase Realtime).
  useEffect(
    () =>
      api.subscribe((change) => {
        if (change.type === 'delete') {
          setExitKind('delete')
          setSites((prev) => prev.filter((s) => s.id !== change.id))
        } else {
          setSites((prev) => sortSites([change.site, ...prev.filter((s) => s.id !== change.site.id)]))
        }
      }),
    [],
  )

  useEffect(() => {
    try {
      sessionStorage.setItem(JUST_ADDED_KEY, JSON.stringify([...justAdded]))
    } catch {
      /* ignore */
    }
  }, [justAdded])

  /* ---- Filter ---- */

  const trimmed = query.trim()
  const filtered = useMemo(() => (trimmed ? sites.filter((s) => matchesQuery(s, trimmed)) : sites), [sites, trimmed])

  const setQuery = useCallback((q: string) => {
    setExitKind('filter')
    setQueryState(q)
  }, [])

  useEffect(() => {
    const url = new URL(location.href)
    if (trimmed) url.searchParams.set('q', trimmed)
    else url.searchParams.delete('q')
    history.replaceState(history.state, '', url)
  }, [trimmed])

  useEffect(() => {
    if (!trimmed || status !== 'ready') return
    const t = window.setTimeout(() => {
      setAnnouncement(
        filtered.length === 0
          ? `No one named ${trimmed} yet.`
          : filtered.length === 1
            ? '1 match'
            : `${filtered.length} matches`,
      )
    }, 450)
    return () => window.clearTimeout(t)
  }, [trimmed, filtered.length, status])

  /* ---- Modals & focus ---- */

  function openModal(next: ModalState, trigger?: HTMLElement | null) {
    triggerRef.current = trigger ?? (document.activeElement as HTMLElement | null)
    setModal(next)
  }

  function restoreFocus(fallback?: HTMLElement | null) {
    requestAnimationFrame(() => {
      const trigger = triggerRef.current
      const target = trigger && trigger.isConnected ? trigger : (fallback ?? mainRef.current)
      target?.focus({ preventScroll: true })
    })
  }

  function closeModal() {
    if (modal?.kind === 'success') setHoldRevealId(null)
    setModal(null)
    restoreFocus()
  }

  const openAdd = (trigger?: HTMLElement | null) => openModal({ kind: 'add' }, trigger)

  async function handleAdd(input: SiteInput, honeypot: string) {
    const site = await api.add(input, honeypot)
    setExitKind('filter')
    setSites((prev) => sortSites([site, ...prev.filter((s) => s.id !== site.id)]))
    setJustAdded((prev) => new Set(prev).add(site.id))
    setHoldRevealId(site.id)
    setModal({ kind: 'success', site })
    setAnnouncement(`${site.creator_name}’s website was added to the gallery.`)
  }

  function seeNewSite(site: Site) {
    setModal(null)
    setHoldRevealId(null)
    if (trimmed && !matchesQuery(site, trimmed)) setQuery('')
    // Wait for the modal to unmount and the wall to settle before scrolling.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const visit = visitRefs.current.get(site.id)
        const card = visit?.closest('.wall-item')
        if (!visit || !card) return restoreFocus()
        card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
        visit.focus({ preventScroll: true })
      }),
    )
  }

  async function handleEdit(site: Site, input: SiteInput) {
    const updated = await api.update(site.id, input)
    setSites((prev) => sortSites(prev.map((s) => (s.id === updated.id ? updated : s))))
    closeModal()
    setAnnouncement(`${updated.creator_name}’s website was updated.`)
  }

  function handleDelete(site: Site) {
    // Move focus to a neighbouring card, since the trigger is about to disappear.
    const index = filtered.findIndex((s) => s.id === site.id)
    const neighbour = filtered[index + 1] ?? filtered[index - 1]
    setModal(null)
    setExitKind('delete')
    setSites((prev) => prev.filter((s) => s.id !== site.id))
    setAnnouncement(`${site.creator_name}’s website was deleted.`)
    requestAnimationFrame(() => {
      const next = neighbour ? visitRefs.current.get(neighbour.id) : null
      ;(next ?? mainRef.current)?.focus({ preventScroll: true })
    })
    api.remove(site.id).catch(() => {
      setSites((prev) => sortSites([site, ...prev.filter((s) => s.id !== site.id)]))
      setAnnouncement(`Couldn’t delete ${site.creator_name}’s website. Please try again.`)
    })
  }

  async function handleLogin(email: string, password: string) {
    const ok = await api.signIn(email, password)
    if (ok) {
      setIsAdmin(true)
      setModal(null)
      restoreFocus()
      setAnnouncement('Logged in. You can now edit and delete entries.')
    }
    return ok
  }

  async function handleLogout() {
    await api.signOut()
    setIsAdmin(false)
    if (modal?.kind === 'edit' || modal?.kind === 'delete') setModal(null)
    setAnnouncement('Logged out.')
    mainRef.current?.focus({ preventScroll: true })
  }

  const onVisitRef = useCallback((id: string, el: HTMLAnchorElement | null) => {
    if (el) visitRefs.current.set(id, el)
    else visitRefs.current.delete(id)
  }, [])

  /* ---- Layout ---- */

  const columns = isMobile ? 1 : isTablet ? 2 : 3
  const staggered = columns === 3 ? [0, 96, 40] : columns === 2 ? [0, 64] : [0]
  const offsetsFor = (count: number) => (count >= 3 ? staggered : staggered.map(() => 0))

  let content
  if (status === 'loading') {
    content = <SkeletonWall columns={columns} offsets={staggered} />
  } else if (status === 'error') {
    content = (
      <LoadError
        onRetry={() => {
          setStatus('loading')
          load()
        }}
      />
    )
  } else if (sites.length === 0) {
    content = <EmptyState />
  } else if (filtered.length === 0) {
    content = <NoResults query={trimmed} onClear={() => setQuery('')} />
  } else {
    content = (
      <Wall
        sites={filtered}
        columns={columns}
        offsets={offsetsFor(filtered.length)}
        isAdmin={isAdmin}
        justAdded={justAdded}
        holdRevealId={holdRevealId}
        exitKind={exitKind}
        onEdit={(site, trigger) => openModal({ kind: 'edit', site }, trigger)}
        onDelete={(site, trigger) => openModal({ kind: 'delete', site }, trigger)}
        onVisitRef={onVisitRef}
      />
    )
  }
  const bare = status !== 'ready' || sites.length === 0 || filtered.length === 0

  return (
    <>
      <SpaceBackground />
      <div className="app" id="top">
        <Header
          isAdmin={isAdmin}
          isMobile={isMobile}
          onAdd={() => openAdd()}
          onLogin={() => openModal({ kind: 'login' })}
          onLogout={handleLogout}
        />
        <main ref={mainRef} tabIndex={-1} className="main">
          <Hero isMobile={isMobile} />
          <Toolbar
            total={status === 'ready' ? sites.length : null}
            query={query}
            matches={filtered.length}
            onQueryChange={setQuery}
          />
          <section
            className={`gallery ${bare && status !== 'loading' ? 'gallery--bare' : ''}`}
            aria-label="Student websites"
            aria-busy={status === 'loading'}
          >
            {content}
          </section>
        </main>
        <Footer />
      </div>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {(modal?.kind === 'add' || modal?.kind === 'edit') && (
        <SiteFormModal
          key={modal.kind === 'edit' ? modal.site.id : 'add'}
          mode={modal.kind}
          initial={modal.kind === 'edit' ? modal.site : undefined}
          sheet={isMobile}
          onClose={closeModal}
          onSubmit={(input, honeypot) =>
            modal.kind === 'edit' ? handleEdit(modal.site, input) : handleAdd(input, honeypot)
          }
        />
      )}
      {modal?.kind === 'success' && (
        <SuccessModal
          creatorName={modal.site.creator_name}
          count={sites.length}
          onClose={closeModal}
          onSee={() => seeNewSite(modal.site)}
        />
      )}
      {modal?.kind === 'login' && <LoginModal onClose={closeModal} onLogin={handleLogin} />}
      {modal?.kind === 'delete' && (
        <DeleteModal
          creatorName={modal.site.creator_name}
          onClose={closeModal}
          onConfirm={() => handleDelete(modal.site)}
        />
      )}
    </>
  )
}
