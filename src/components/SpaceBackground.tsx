import { memo } from 'react'
import './SpaceBackground.css'

// Deterministic PRNG (mulberry32) so the star field is identical on every render and reload.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One screen-sized tile of stars, repeated to the right, below and diagonally so a layer can
// travel a full tile (-100vw, -100vh) and loop without a visible seam.
function starShadows(count: number, seed: number): string {
  const rand = mulberry32(seed)
  const shadows: string[] = []
  for (let i = 0; i < count; i++) {
    const x = rand() * 100
    const y = rand() * 100
    for (const [dx, dy] of [
      [0, 0],
      [100, 0],
      [0, 100],
      [100, 100],
    ]) {
      shadows.push(`${(x + dx).toFixed(2)}vw ${(y + dy).toFixed(2)}vh 0 0 var(--star)`)
    }
  }
  return shadows.join(', ')
}

// Far stars are small and slow, near stars are larger and faster: parallax depth.
const LAYERS = [
  { size: 1, count: 40, seed: 11 },
  { size: 1.5, count: 25, seed: 23 },
  { size: 2, count: 12, seed: 37 },
].map((l) => ({ ...l, shadow: starShadows(l.count, l.seed) }))

export const SpaceBackground = memo(function SpaceBackground() {
  return (
    <div className="space" aria-hidden="true">
      <div className="space-haze space-haze--violet" />
      <div className="space-haze space-haze--blue" />
      <div className="space-haze-dim">
        <div className="space-haze space-haze--violet-low" />
      </div>
      {LAYERS.map((l, i) => (
        <div key={l.size} className={`space-drift space-drift--${i + 1}`}>
          <div
            className={`space-star-layer space-star-layer--${i + 1}`}
            style={{ width: l.size, height: l.size, boxShadow: l.shadow }}
          />
        </div>
      ))}
      <span className="shooting-star shooting-star--1" />
      <span className="shooting-star shooting-star--2" />
    </div>
  )
})
