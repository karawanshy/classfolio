import type { MouseEvent } from 'react'
import { PencilIcon, PlusIcon } from './icons'
import './Header.css'

interface HeaderProps {
  isAdmin: boolean
  isMobile: boolean
  onAdd: () => void
  onLogin: () => void
  onLogout: () => void
}

export function Header({ isAdmin, isMobile, onAdd, onLogin, onLogout }: HeaderProps) {
  return (
    <>
      {isAdmin && !isMobile && <div className="admin-line" aria-hidden="true" />}
      {isAdmin && isMobile && (
        <div className="admin-bar">
          <span className="admin-bar-label">
            <PencilIcon size={13} />
            Editing
          </span>
        </div>
      )}
      <header className="header">
        <a className="logo" href="#top" onClick={scrollTop}>
          <span className="logo-dot" aria-hidden="true" />
          classfolio
        </a>
        <div className="header-actions">
          {isAdmin ? (
            <>
              {!isMobile && (
                <span className="editing-chip">
                  <PencilIcon size={14} />
                  Editing
                </span>
              )}
              {/* Admins manage entries; adding is for students, so Log out takes the primary slot. */}
              <button type="button" className="btn btn-primary header-logout" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="icon-circle"
                aria-label="Edit gallery (admin login)"
                title="Admin"
                onClick={onLogin}
              >
                <PencilIcon size={17} />
              </button>
              {isMobile ? (
                <button type="button" className="icon-circle add-circle" aria-label="Add your website" onClick={onAdd}>
                  <PlusIcon size={18} />
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={onAdd}>
                  <PlusIcon size={16} />
                  Add your website
                </button>
              )}
            </>
          )}
        </div>
      </header>
    </>
  )
}

function scrollTop(e: MouseEvent) {
  e.preventDefault()
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
}
