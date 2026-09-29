import { useState } from 'react'
import { useReducedMotion } from '../lib/hooks'

/** Zero-padded count whose changed digits roll (old slides up and out, new slides in from below). */
export function Odometer({ value }: { value: number | null }) {
  const reduced = useReducedMotion()
  const text = value === null ? '—' : String(value).padStart(2, '0')
  const [state, setState] = useState({ text, prev: null as string | null, dir: 1, n: 0 })

  // Derive the transition during render when the value changes.
  if (state.text !== text) {
    const animate = !reduced && state.text !== '—' && text !== '—'
    setState({
      text,
      prev: animate ? state.text : null,
      dir: Number(text) >= Number(state.text) ? 1 : -1,
      n: state.n + 1,
    })
  }

  const cur = state.text
  const len = Math.max(cur.length, state.prev?.length ?? 0)
  const curChars = cur.padStart(len, ' ').split('')
  const prevChars = state.prev?.padStart(len, ' ').split('')

  return (
    <span className={`odometer ${state.dir < 0 ? 'odometer--down' : ''}`} aria-hidden="true">
      {curChars.map((ch, i) => {
        const was = prevChars?.[i]
        if (was === undefined || was === ch) {
          return ch === ' ' ? null : (
            <span key={`${i}-static`} className="odo-digit">
              {ch}
            </span>
          )
        }
        return (
          <span key={`${i}-${state.n}`} className="odo-digit odo-roll">
            {was !== ' ' && <span className="odo-out">{was}</span>}
            <span className="odo-in">{ch}</span>
          </span>
        )
      })}
    </span>
  )
}
