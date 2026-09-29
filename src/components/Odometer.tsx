import { useState } from 'react'
import { useReducedMotion } from '../lib/hooks'

const padTwo = (n: number) => String(n).padStart(2, '0')

/** Count whose changed characters roll (old slides up and out, new slides in from below). Zero-padded by default. */
export function Odometer({ value, format = padTwo }: { value: number | null; format?: (n: number) => string }) {
  const reduced = useReducedMotion()
  const text = value === null ? '—' : format(value)
  const [state, setState] = useState({ text, value, prev: null as string | null, dir: 1, n: 0 })

  // Derive the transition during render when the value changes.
  if (state.text !== text) {
    const animate = !reduced && state.value !== null && value !== null
    setState({
      text,
      value,
      prev: animate ? state.text : null,
      dir: (value ?? 0) >= (state.value ?? 0) ? 1 : -1,
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
