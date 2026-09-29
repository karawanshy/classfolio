import { forwardRef, useEffect, useId, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { useReducedMotion } from '../lib/hooks'
import { previewFor } from '../lib/preview'
import { toggleReaction, useSiteReactions } from '../lib/reactions'
import type { ReactionKey, Site } from '../lib/types'
import { displayHost } from '../lib/url'
import {
  ArrowUpRightIcon,
  BookIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CursorIcon,
  GitHubIcon,
  PaletteIcon,
  PencilIcon,
  SparkleIcon,
  SparklesIcon,
  TrashIcon,
} from './icons'
import { Odometer } from './Odometer'
import { Screenshot } from './Screenshot'
import './SiteCard.css'

interface SiteCardProps {
  site: Site
  isAdmin: boolean
  justAdded: boolean
  onEdit: (site: Site, trigger: HTMLElement) => void
  onDelete: (site: Site, trigger: HTMLElement) => void
}

export const SiteCard = forwardRef<HTMLAnchorElement, SiteCardProps>(function SiteCard(
  { site, isAdmin, justAdded, onEdit, onDelete },
  frameRef,
) {
  // Keyed on the visible values so an edit cross-fades the card to its new content.
  const version = [site.creator_name, site.site_url, site.github_url ?? ''].join('\u0000')

  return (
    <article className="card" data-site-id={site.id}>
      <div key={version} className="card-content">
        <a
          ref={frameRef}
          className="card-frame"
          href={site.site_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${site.creator_name}’s website`}
        >
          <span className="card-host">
            <span className="card-host-text">{displayHost(site.site_url)}</span>
            <ArrowUpRightIcon size={12} />
          </span>
          <span className="card-shot-wrap">
            <Screenshot src={previewFor(site)} alt={`Screenshot of ${site.creator_name}’s website`} retry={justAdded} />
            {justAdded && <span className="card-badge">Just added</span>}
          </span>
        </a>

        <div className="card-caption">
          <h3 className="card-name">{site.creator_name}</h3>
          <div className="card-actions">
            {site.github_url && (
              <a
                className="icon-circle card-btn"
                href={site.github_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`GitHub repository for ${site.creator_name}’s website`}
              >
                <GitHubIcon size={18} />
              </a>
            )}
            <a className="card-visit card-btn" href={site.site_url} target="_blank" rel="noopener noreferrer">
              Visit
              <ArrowUpRightIcon size={14} />
              <span className="visually-hidden"> {site.creator_name}’s website (opens in a new tab)</span>
            </a>
          </div>
        </div>

        {isAdmin ? (
          <ReactionCounts siteId={site.id} creatorName={site.creator_name} />
        ) : (
          <ReactionBar siteId={site.id} creatorName={site.creator_name} />
        )}
      </div>

      {isAdmin && (
        <div className="card-admin">
          <button
            type="button"
            className="card-admin-btn"
            aria-label={`Edit ${site.creator_name}’s website`}
            onClick={(e) => onEdit(site, e.currentTarget)}
          >
            <PencilIcon size={17} />
          </button>
          <button
            type="button"
            className="card-admin-btn card-admin-btn--danger"
            aria-label={`Delete ${site.creator_name}’s website`}
            onClick={(e) => onDelete(site, e.currentTarget)}
          >
            <TrashIcon size={17} />
          </button>
        </div>
      )}
    </article>
  )
})

/* ---- Reactions: small compliments, not ratings. Fixed order, whatever the counts. ---- */

const REACTIONS: {
  key: ReactionKey
  label: string
  meaning: string
  Icon: ComponentType<{ size?: number }>
  hue: string
}[] = [
  { key: 'beautiful', label: 'Beautiful', meaning: 'Strong visual design and aesthetics', Icon: PaletteIcon, hue: '240,168,196' },
  { key: 'story', label: 'Great Story', meaning: 'Engaging storytelling and personal narrative', Icon: BookIcon, hue: '242,198,122' },
  { key: 'creative', label: 'Creative', meaning: 'Original ideas, personality, or execution', Icon: SparklesIcon, hue: '198,176,255' },
  { key: 'ux', label: 'Smooth UX', meaning: 'Intuitive, clear, enjoyable to navigate', Icon: CursorIcon, hue: '128,216,196' },
  { key: 'professional', label: 'Professional', meaning: 'Polished and career-ready', Icon: BriefcaseIcon, hue: '150,190,255' },
  { key: 'memorable', label: 'Memorable', meaning: 'Leaves a lasting impression', Icon: BookmarkIcon, hue: '245,166,140' },
]

const UNAVAILABLE = 'Reactions aren’t available right now'
const FLASH_MS = 1500
const LONG_PRESS_MS = 450

/** 1–999 as-is, then 1.2k, 12k, 1.2M. Rounds down, so it never overstates. */
function formatCount(n: number): string {
  if (n < 1000) return String(n)
  const [v, unit] = n < 1e6 ? [n / 1e3, 'k'] : [n / 1e6, 'M']
  return `${v < 10 ? Math.floor(v * 10) / 10 : Math.floor(v)}${unit}`
}

/** What admins see: the same row, live, but nothing to press. Admins don't react. */
function ReactionCounts({ siteId, creatorName }: { siteId: string; creatorName: string }) {
  const { counts } = useSiteReactions(siteId)
  return (
    <ul className="reactions" aria-label={`Reactions to ${creatorName}’s website`}>
      {REACTIONS.map(({ key, label, Icon, hue }) => {
        const count = counts[key] ?? 0
        return (
          <li key={key} className="rx-item">
            <span
              className={`rx is-readonly ${count === 0 ? 'is-zero' : 'is-counted'}`}
              style={{ '--h': hue } as CSSProperties}
              aria-label={count > 0 ? `${label}, ${count}` : `${label}, none yet`}
              role="img"
            >
              <span className="rx-icon">
                <Icon size={16} />
              </span>
              {count > 0 && (
                <span className="rx-count">
                  <Odometer value={count} format={formatCount} />
                </span>
              )}
            </span>
            <span className="rx-tip" aria-hidden="true">
              {label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function ReactionBar({ siteId, creatorName }: { siteId: string; creatorName: string }) {
  const { counts, mine, available } = useSiteReactions(siteId)
  const reduced = useReducedMotion()
  const baseId = useId()
  // Bumped on each select: re-keys the icon (pop) and the sparkle burst so they replay.
  const [bursts, setBursts] = useState<Partial<Record<ReactionKey, number>>>({})
  // Touch: the label shown briefly after a tap or long press.
  const [flash, setFlash] = useState<ReactionKey | null>(null)
  // Escape hides the tooltip until the pointer or focus leaves.
  const [dismissed, setDismissed] = useState<ReactionKey | null>(null)
  const [status, setStatus] = useState('')
  const pointer = useRef('mouse')
  const flashTimer = useRef(0)
  const pressTimer = useRef(0)
  const longPressed = useRef(false)

  useEffect(
    () => () => {
      window.clearTimeout(flashTimer.current)
      window.clearTimeout(pressTimer.current)
    },
    [],
  )

  function showFlash(key: ReactionKey, text: string) {
    setDismissed(null)
    setFlash(key)
    // Alternate a zero-width space so tapping the same icon twice is announced twice.
    setStatus((prev) => (prev === text ? `${text}\u200b` : text))
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS)
  }

  function handleClick(key: ReactionKey, label: string) {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    const isTouch = pointer.current === 'touch'
    if (!available) {
      if (isTouch) showFlash(key, UNAVAILABLE)
      return
    }
    const selecting = !mine.includes(key)
    void toggleReaction(siteId, key)
    if (selecting && !reduced) setBursts((b) => ({ ...b, [key]: (b[key] ?? 0) + 1 }))
    if (isTouch) showFlash(key, label)
  }

  return (
    <div className="reactions" role="group" aria-label={`Appreciate ${creatorName}’s website`}>
      {REACTIONS.map(({ key, label, meaning, Icon, hue }) => {
        const count = counts[key] ?? 0
        const isMine = mine.includes(key)
        const burst = bursts[key] ?? 0
        const tipId = `${baseId}-${key}`
        const tipText = available ? label : UNAVAILABLE
        return (
          <span
            key={key}
            className={`rx-item ${flash === key ? 'is-flash' : ''} ${dismissed === key ? 'is-dismissed' : ''}`}
          >
            <button
              type="button"
              className={`rx ${count === 0 ? 'is-zero' : 'is-counted'} ${isMine ? 'is-mine' : ''}`}
              style={{ '--h': hue } as CSSProperties}
              aria-pressed={isMine}
              aria-label={count > 0 ? `${label}, ${count}` : label}
              aria-describedby={tipId}
              aria-disabled={!available || undefined}
              onPointerDown={(e) => {
                pointer.current = e.pointerType
                longPressed.current = false
                window.clearTimeout(pressTimer.current)
                if (e.pointerType !== 'touch') return
                pressTimer.current = window.setTimeout(() => {
                  longPressed.current = true
                  showFlash(key, tipText)
                }, LONG_PRESS_MS)
              }}
              onPointerUp={() => window.clearTimeout(pressTimer.current)}
              onPointerCancel={() => window.clearTimeout(pressTimer.current)}
              onPointerLeave={() => {
                window.clearTimeout(pressTimer.current)
                if (dismissed === key) setDismissed(null)
              }}
              onContextMenu={(e) => pointer.current === 'touch' && e.preventDefault()}
              onKeyDown={(e) => {
                pointer.current = 'keyboard'
                if (e.key === 'Escape') {
                  setDismissed(key)
                  if (flash === key) setFlash(null)
                }
              }}
              onBlur={() => dismissed === key && setDismissed(null)}
              onClick={() => handleClick(key, label)}
            >
              <span key={burst} className={`rx-icon ${burst ? 'is-pop' : ''}`}>
                <Icon size={16} />
              </span>
              {count > 0 && (
                <span className="rx-count">
                  <Odometer value={count} format={formatCount} />
                </span>
              )}
              {burst > 0 && (
                <span key={`burst-${burst}`} className="rx-burst" aria-hidden="true">
                  <SparkleIcon size={9} />
                  <SparkleIcon size={6} />
                </span>
              )}
            </button>
            <span role="tooltip" id={tipId} className="rx-tip">
              {/* Screen readers already hear the label as the name; describe what it means instead. */}
              {available ? (
                <>
                  <span aria-hidden="true">{label}</span>
                  <span className="visually-hidden">{meaning}</span>
                </>
              ) : (
                UNAVAILABLE
              )}
            </span>
          </span>
        )
      })}
      <span className="visually-hidden" role="status">
        {status}
      </span>
    </div>
  )
}
