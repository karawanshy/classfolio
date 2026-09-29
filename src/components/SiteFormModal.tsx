import { useId, useRef, useState, type FormEvent } from 'react'
import type { Site, SiteInput } from '../lib/types'
import { isValidUrl, normalizeUrl } from '../lib/url'
import { Modal } from './Modal'
import './SiteFormModal.css'

type FieldName = 'creator_name' | 'site_url' | 'github_url'

const MESSAGES: Record<FieldName, string> = {
  creator_name: 'Add your name so classmates know whose site it is.',
  site_url: 'Paste the link where your site lives.',
  github_url: 'That doesn’t look like a link.',
}

const ORDER: FieldName[] = ['creator_name', 'site_url', 'github_url']

interface SiteFormModalProps {
  mode: 'add' | 'edit'
  initial?: Site
  sheet: boolean
  onClose: () => void
  onSubmit: (input: SiteInput, honeypot: string) => Promise<void>
}

export function SiteFormModal({ mode, initial, sheet, onClose, onSubmit }: SiteFormModalProps) {
  const uid = useId()
  const [values, setValues] = useState<Record<FieldName, string>>({
    creator_name: initial?.creator_name ?? '',
    site_url: initial?.site_url ?? '',
    github_url: initial?.github_url ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const honeypotRef = useRef<HTMLInputElement>(null)
  const inputRefs = useRef<Partial<Record<FieldName, HTMLInputElement | null>>>({})

  const editing = mode === 'edit'
  const titleId = `${uid}-title`
  const descId = `${uid}-desc`

  function set(name: FieldName, value: string) {
    setValues((v) => ({ ...v, [name]: value }))
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return

    const input: SiteInput = {
      creator_name: values.creator_name.trim(),
      site_url: normalizeUrl(values.site_url),
      github_url: normalizeUrl(values.github_url) || null,
    }

    const next: Partial<Record<FieldName, string>> = {}
    if (!input.creator_name) next.creator_name = MESSAGES.creator_name
    if (!isValidUrl(input.site_url)) next.site_url = MESSAGES.site_url
    if (input.github_url && !isValidUrl(input.github_url)) next.github_url = MESSAGES.github_url
    setErrors(next)

    const firstInvalid = ORDER.find((f) => next[f])
    if (firstInvalid) {
      inputRefs.current[firstInvalid]?.focus()
      return
    }

    setSubmitting(true)
    setSubmitError(false)
    try {
      await onSubmit(input, honeypotRef.current?.value ?? '')
    } catch {
      setSubmitError(true)
      setSubmitting(false)
    }
  }

  function field(
    name: FieldName,
    label: string,
    props: { placeholder: string; type?: string; url?: boolean; optional?: boolean; autoComplete?: string },
  ) {
    const id = `${uid}-${name}`
    const errId = `${id}-error`
    const error = errors[name]
    return (
      <div className="field">
        <label className="field-label" htmlFor={id}>
          {label}
          {props.optional && <span className="field-optional">Optional</span>}
        </label>
        <input
          ref={(el) => {
            inputRefs.current[name] = el
          }}
          id={id}
          name={name}
          className={`field-input ${props.url ? 'field-input--url' : ''} ${props.optional ? 'field-input--optional' : ''}`}
          type={props.type ?? 'text'}
          inputMode={props.url ? 'url' : undefined}
          autoCapitalize={props.url ? 'none' : 'words'}
          autoCorrect="off"
          spellCheck={false}
          autoComplete={props.autoComplete ?? 'off'}
          placeholder={props.placeholder}
          maxLength={props.url ? 300 : 80}
          value={values[name]}
          onChange={(e) => set(name, e.target.value)}
          aria-required={props.optional ? undefined : true}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
        />
        {error && (
          <p id={errId} className="field-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <Modal labelledBy={titleId} describedBy={descId} onClose={onClose} sheet={sheet} showClose className="form-modal">
      <form className="form-modal-form" noValidate onSubmit={handleSubmit}>
        <div className="form-modal-body">
          <header className="form-modal-head">
            <p className="mono-label modal-eyebrow">{editing ? 'Admin · editing' : 'Join the gallery'}</p>
            <h2 id={titleId} className="modal-title">
              {editing ? 'Edit website' : 'Add your website'}
            </h2>
            <p id={descId} className="modal-text">
              {editing
                ? 'Changes are visible to everyone right away.'
                : 'No account needed. Your site appears in the gallery right away.'}
            </p>
          </header>

          <div className="form-fields">
            {field('creator_name', 'Your name', { placeholder: 'Mohammad Kabajah', autoComplete: 'name' })}
            {field('site_url', 'Website link', { placeholder: 'your-site.netlify.app', type: 'url', url: true })}
            {field('github_url', 'GitHub repository', {
              placeholder: 'github.com/you/your-site',
              type: 'url',
              url: true,
              optional: true,
            })}
            {/* Honeypot: invisible to people, tempting to bots. Filled → the submission is rejected. */}
            <div className="honeypot" aria-hidden="true">
              <label htmlFor={`${uid}-company`}>Company</label>
              <input
                ref={honeypotRef}
                id={`${uid}-company`}
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
          </div>

          {submitError && (
            <p className="form-error" role="alert">
              Something went wrong. Please try again.
            </p>
          )}
        </div>

        <div className="modal-actions form-modal-actions">
          {!sheet && (
            <button type="button" className="btn btn-text" onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden="true" />}
            {submitting ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save changes' : 'Add to the gallery'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
