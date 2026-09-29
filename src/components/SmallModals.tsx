import { useId, useRef, useState, type FormEvent } from 'react'
import { SparkleIcon, TrashIcon } from './icons'
import { Modal } from './Modal'
import './SmallModals.css'

/* ---- Success ---- */

export function SuccessModal({
  creatorName,
  count,
  onClose,
  onSee,
}: {
  creatorName: string
  count: number
  onClose: () => void
  onSee: () => void
}) {
  const uid = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal
      labelledBy={`${uid}-title`}
      describedBy={`${uid}-desc`}
      onClose={onClose}
      className="small-modal success-modal"
      initialFocusRef={buttonRef}
    >
      <span className="success-icon" aria-hidden="true">
        <SparkleIcon size={30} />
      </span>
      <h2 id={`${uid}-title`} className="modal-title">
        You’re in the sky.
      </h2>
      <p id={`${uid}-desc`} className="success-text">
        <strong>{creatorName}’s website</strong> is now in the gallery, corner No.&nbsp;{count}. We’re taking a snapshot of your
        site; it appears within a minute.
      </p>
      <button ref={buttonRef} type="button" className="btn btn-primary" onClick={onSee}>
        See it in the gallery
      </button>
    </Modal>
  )
}

/* ---- Admin login ---- */

export function LoginModal({
  onClose,
  onLogin,
}: {
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<boolean>
}) {
  const uid = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setFailed(false)
    let ok = false
    try {
      ok = !!email.trim() && !!password && (await onLogin(email.trim(), password))
    } catch {
      ok = false
    }
    if (!ok) {
      setPending(false)
      setFailed(true)
      passwordRef.current?.focus()
      passwordRef.current?.select()
    }
  }

  return (
    <Modal
      labelledBy={`${uid}-title`}
      describedBy={`${uid}-desc`}
      onClose={onClose}
      showClose
      className="small-modal login-modal"
    >
      <form className="login-form" noValidate onSubmit={submit}>
        <div className="small-modal-head">
          <h2 id={`${uid}-title`} className="modal-title login-title">
            Admin login
          </h2>
          <p id={`${uid}-desc`} className="modal-text">
            For course staff, to edit or remove entries.
          </p>
        </div>
        <div className="form-fields">
          <div className="field">
            <label className="field-label" htmlFor={`${uid}-email`}>
              Email
            </label>
            <input
              id={`${uid}-email`}
              className="field-input"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={failed || undefined}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${uid}-password`}>
              Password
            </label>
            <input
              ref={passwordRef}
              id={`${uid}-password`}
              className="field-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={failed || undefined}
              aria-describedby={failed ? `${uid}-error` : undefined}
            />
            {failed && (
              <p id={`${uid}-error`} className="field-error" role="alert">
                That email and password don’t match an admin account.
              </p>
            )}
          </div>
        </div>
        <button type="submit" className="btn btn-primary login-submit" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          Log in
        </button>
      </form>
    </Modal>
  )
}

/* ---- Delete confirmation ---- */

export function DeleteModal({
  creatorName,
  onClose,
  onConfirm,
}: {
  creatorName: string
  onClose: () => void
  onConfirm: () => void
}) {
  const uid = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal
      role="alertdialog"
      labelledBy={`${uid}-title`}
      describedBy={`${uid}-desc`}
      onClose={onClose}
      initialFocusRef={cancelRef}
      className="small-modal delete-modal"
    >
      <span className="modal-icon delete-icon" aria-hidden="true">
        <TrashIcon size={20} />
      </span>
      <h2 id={`${uid}-title`} className="modal-title delete-title">
        Delete {creatorName}’s website?
      </h2>
      <p id={`${uid}-desc`} className="modal-text delete-text">
        It will be removed from the gallery for everyone. This can’t be undone.
      </p>
      <div className="modal-actions">
        <button ref={cancelRef} type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          Delete website
        </button>
      </div>
    </Modal>
  )
}
