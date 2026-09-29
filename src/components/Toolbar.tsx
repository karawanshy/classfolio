import { useRef } from 'react'
import { CloseIcon, SearchIcon } from './icons'
import { Odometer } from './Odometer'
import './Toolbar.css'

interface ToolbarProps {
  total: number | null
  query: string
  matches: number
  onQueryChange: (q: string) => void
}

export function Toolbar({ total, query, matches, onQueryChange }: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const active = query.trim().length > 0

  return (
    <div className="toolbar-wrap">
      <div className="toolbar">
        <div className="count">
          <span className="count-number">
            <Odometer value={total} />
          </span>
          <span className="count-label mono-label" aria-hidden="true">
            corners of the internet
            <br />& counting
          </span>
          <span className="visually-hidden">
            {total === null ? 'Loading the gallery' : `${total} corners of the internet and counting`}
          </span>
        </div>

        <div className="filter" role="search">
          {active && (
            <span className="filter-matches mono-label" aria-hidden="true">
              {matches === 1 ? '1 match' : `${matches} matches`}
            </span>
          )}
          <div className="filter-field">
            <label htmlFor="filter-input" className="visually-hidden">
              Filter by student name
            </label>
            <SearchIcon size={17} className="filter-icon" />
            <input
              ref={inputRef}
              id="filter-input"
              className="filter-input"
              type="search"
              placeholder="Filter by name"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault()
                  onQueryChange('')
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="filter-clear"
                aria-label="Clear filter"
                onClick={() => {
                  onQueryChange('')
                  inputRef.current?.focus()
                }}
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
