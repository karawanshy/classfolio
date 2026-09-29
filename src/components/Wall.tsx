import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { isRevealed, useReducedMotion, useReveal } from '../lib/hooks'
import type { Site } from '../lib/types'
import { SiteCard } from './SiteCard'
import './Wall.css'

type WallItem = { key: string; site: Site }

export type ExitKind = 'filter' | 'delete'

interface WallProps {
  sites: Site[]
  columns: number
  offsets: number[]
  isAdmin: boolean
  justAdded: ReadonlySet<string>
  holdRevealId: string | null
  exitKind: ExitKind
  onEdit: (site: Site, trigger: HTMLElement) => void
  onDelete: (site: Site, trigger: HTMLElement) => void
  onVisitRef: (id: string, el: HTMLAnchorElement | null) => void
}

const EXIT_MS: Record<ExitKind, number> = { filter: 150, delete: 300 }
const FLIP_MS: Record<ExitKind, number> = { filter: 450, delete: 600 }

/** Round-robin items into columns so DOM (and tab) order stays newest-first, left to right. */
function distribute<T>(items: T[], columns: number): T[][] {
  const cols: T[][] = Array.from({ length: columns }, () => [])
  items.forEach((item, i) => cols[i % columns].push(item))
  return cols
}

export function Wall(props: WallProps) {
  const { sites, columns, offsets, exitKind } = props
  const reduced = useReducedMotion()

  const target = useMemo<WallItem[]>(() => sites.map((site) => ({ key: site.id, site })), [sites])

  // Keep removed items on screen (fading out) for a moment before re-flowing the rest.
  const [shown, setShown] = useState(() => target.map((item) => ({ item, exiting: false })))
  const shownRef = useRef(shown)
  useLayoutEffect(() => {
    shownRef.current = shown
  })

  useLayoutEffect(() => {
    const byKey = new Map(target.map((t) => [t.key, t]))
    const current = shownRef.current
    const settle = () => setShown(target.map((item) => ({ item, exiting: false })))
    const leaving = current.some((s) => !byKey.has(s.item.key))
    if (!leaving || reduced) {
      settle()
      return
    }
    setShown(
      current.map((s) =>
        byKey.has(s.item.key) ? { item: byKey.get(s.item.key)!, exiting: false } : { ...s, exiting: true },
      ),
    )
    const t = window.setTimeout(settle, EXIT_MS[exitKind])
    return () => window.clearTimeout(t)
  }, [target, reduced, exitKind])

  // Masonry layout: one flat list (so cards never remount when they change column), positioned
  // round-robin into columns with transforms. A changed position transitions: that's the FLIP.
  const wallRef = useRef<HTMLDivElement>(null)
  const itemEls = useRef(new Map<string, HTMLElement>())
  const positions = useRef(new Map<string, { x: number; y: number }>())
  const config = useRef({ keys: [] as string[], columns, offsets, exitKind, reduced })
  const lastColumns = useRef<number | null>(null)

  const runLayout = useCallback((animate: boolean) => {
    const wall = wallRef.current
    if (!wall) return
    const { keys, columns, offsets, exitKind, reduced } = config.current
    const styles = getComputedStyle(wall)
    const gapX = parseFloat(styles.getPropertyValue('--gap-x')) || 0
    const gapY = parseFloat(styles.getPropertyValue('--gap-y')) || 0
    const colWidth = (wall.clientWidth - gapX * (columns - 1)) / columns
    const colY = Array.from({ length: columns }, (_, c) => offsets[c] ?? 0)
    const next = new Map<string, { x: number; y: number }>()

    keys.forEach((key, i) => {
      const el = itemEls.current.get(key)
      if (!el) return
      const col = i % columns
      el.style.width = `${colWidth}px`
      const x = Math.round(col * (colWidth + gapX))
      const y = Math.round(colY[col])
      colY[col] += el.offsetHeight + gapY
      next.set(key, { x, y })

      const prev = positions.current.get(key)
      if (prev && prev.x === x && prev.y === y) return
      el.style.transition =
        animate && prev && !reduced ? `transform ${FLIP_MS[exitKind]}ms cubic-bezier(.2,.7,.2,1)` : 'none'
      el.style.transform = `translate(${x}px, ${y}px)`
      if (animate && !prev && !reduced && isRevealed(key)) {
        // A card we've already shown coming back (e.g. the filter was cleared): simple fade.
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease' })
      }
    })

    positions.current = next
    wall.style.height = keys.length ? `${Math.max(...colY) - gapY}px` : '0px'
  }, [])

  useLayoutEffect(() => {
    config.current = { keys: shown.map((s) => s.item.key), columns, offsets, exitKind, reduced }
    const columnsChanged = lastColumns.current !== columns
    runLayout(lastColumns.current !== null && !columnsChanged)
    lastColumns.current = columns
  })

  // Re-measure when the wall's width or any card's height changes (fonts, breakpoints, edits).
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => runLayout(false))
    if (wallRef.current) ro.observe(wallRef.current)
    itemEls.current.forEach((el) => ro.observe(el))
    return () => ro.disconnect()
  }, [shown, runLayout])

  return (
    <div ref={wallRef} className="wall">
      {shown.map(({ item, exiting }) => (
        <div
          key={item.key}
          ref={(el) => {
            if (el) itemEls.current.set(item.key, el)
            else itemEls.current.delete(item.key)
          }}
          className={`wall-item ${exiting ? `is-exiting is-exiting--${exitKind}` : ''}`}
          inert={exiting || undefined}
        >
          <Reveal id={item.key} hold={item.key === props.holdRevealId}>
            <SiteCard
                ref={(el) => props.onVisitRef(item.site.id, el)}
                site={item.site}
                isAdmin={props.isAdmin}
                justAdded={props.justAdded.has(item.site.id)}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
              />
          </Reveal>
        </div>
      ))}
    </div>
  )
}

function Reveal({ id, hold, children }: { id: string; hold: boolean; children: ReactNode }) {
  const ref = useReveal<HTMLDivElement>(id, hold)
  return (
    <div ref={ref} className={`reveal ${isRevealed(id) ? 'is-revealed' : ''}`} data-reveal-id={id}>
      {children}
    </div>
  )
}

export function SkeletonWall({ columns, offsets }: { columns: number; offsets: number[] }) {
  const cols = distribute(
    Array.from({ length: 6 }, (_, i) => i),
    columns,
  )
  return (
    <div className="wall wall-grid" style={{ '--cols': columns } as CSSProperties} aria-hidden="true">
      {cols.map((col, c) => (
        <div key={c} className="wall-col" style={{ paddingTop: offsets[c] ?? 0 }}>
          {col.map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-frame">
                <div className="skeleton-host shimmer" />
                <div className="skeleton-shot shimmer" />
              </div>
              <div className="skeleton-caption">
                <div className="skeleton-bar skeleton-bar--title shimmer" />
                <div className="skeleton-bar skeleton-bar--sub shimmer" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
