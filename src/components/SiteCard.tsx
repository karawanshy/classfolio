import { forwardRef } from 'react'
import { previewFor } from '../lib/preview'
import type { Site } from '../lib/types'
import { displayHost } from '../lib/url'
import { ArrowUpRightIcon, GitHubIcon, PencilIcon, TrashIcon } from './icons'
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
