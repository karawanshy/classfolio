import { useEffect, useLayoutEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import './Modal.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  labelledBy: string
  describedBy?: string
  onClose: () => void
  children: ReactNode
  /** alertdialog for destructive confirmations */
  role?: 'dialog' | 'alertdialog'
  /** Bottom sheet (mobile add/edit) instead of a centred dialog */
  sheet?: boolean
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  showClose?: boolean
}

let openCount = 0

function lockScroll() {
  if (openCount++ > 0) return
  const html = document.documentElement
  const gap = window.innerWidth - html.clientWidth
  html.style.overflow = 'hidden'
  if (gap > 0) document.body.style.paddingRight = `${gap}px`
}

function unlockScroll() {
  if (--openCount > 0) return
  document.documentElement.style.overflow = ''
  document.body.style.paddingRight = ''
}

export function Modal({
  labelledBy,
  describedBy,
  onClose,
  children,
  role = 'dialog',
  sheet = false,
  className = '',
  initialFocusRef,
  showClose = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useLayoutEffect(() => {
    lockScroll()
    return unlockScroll
  }, [])

  // Initial focus: the requested element, else the first field, else the dialog itself.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const target =
      initialFocusRef?.current ??
      dialog.querySelector<HTMLElement>('input:not([tabindex="-1"]), textarea, select') ??
      dialog
    target.focus({ preventScroll: true })
  }, [initialFocusRef])

  // Esc closes; Tab cycles within the dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      )
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Swipe down on the sheet's handle area to dismiss.
  const drag = useRef<{ startY: number; dy: number; id: number } | null>(null)
  const dragHandlers = sheet
    ? {
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          if ((e.target as HTMLElement).closest('button, a, input')) return
          drag.current = { startY: e.clientY, dy: 0, id: e.pointerId }
          e.currentTarget.setPointerCapture(e.pointerId)
        },
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
          const d = drag.current
          const dialog = dialogRef.current
          if (!d || d.id !== e.pointerId || !dialog) return
          d.dy = Math.max(0, e.clientY - d.startY)
          dialog.style.transition = 'none'
          dialog.style.transform = `translateY(${d.dy}px)`
        },
        onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
          const d = drag.current
          const dialog = dialogRef.current
          drag.current = null
          if (!d || d.id !== e.pointerId || !dialog) return
          if (d.dy > 110) {
            onCloseRef.current()
            return
          }
          dialog.style.transition = 'transform 250ms cubic-bezier(.2,.7,.2,1)'
          dialog.style.transform = ''
        },
        onPointerCancel: () => {
          drag.current = null
          if (dialogRef.current) dialogRef.current.style.transform = ''
        },
      }
    : {}

  return createPortal(
    <div className={`modal-root ${sheet ? 'modal-root--sheet' : ''}`}>
      <div className="modal-backdrop" onClick={() => onCloseRef.current()} aria-hidden="true" />
      <div
        ref={dialogRef}
        className={`modal ${sheet ? 'modal--sheet' : ''} ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {sheet && (
          <div className="sheet-grab" {...dragHandlers}>
            <span className="sheet-handle" aria-hidden="true" />
          </div>
        )}
        {showClose && (
          <button type="button" className="modal-close" aria-label="Close" onClick={() => onCloseRef.current()}>
            <CloseIcon size={18} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
