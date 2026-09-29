import { SparkleIcon } from './icons'
import './States.css'

export function EmptyState() {
  return (
    <div className="state state--empty">
      <div className="empty-star" aria-hidden="true">
        <span className="empty-star-icon">
          <SparkleIcon size={24} />
        </span>
        <span className="mono-label">The first star goes here</span>
      </div>
      <h2 className="state-title state-title--empty">The sky is quiet, for now.</h2>
      <p className="state-text">
        Nobody has added a website yet. Be the first. It takes under a minute and no account.
      </p>
    </div>
  )
}

export function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="state state--no-results">
      <h2 className="state-title">No one named “{query}” yet.</h2>
      <p className="state-text">Check the spelling, or clear the filter to see everyone.</p>
      <button type="button" className="btn btn-outline" onClick={onClear}>
        Clear filter
      </button>
    </div>
  )
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state-text">Couldn’t load the gallery.</p>
      <button type="button" className="btn btn-outline" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
