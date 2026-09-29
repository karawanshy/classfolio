import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1199px)')

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ---- Entrance reveal: rise 24px + fade, once per card, staggered 80ms within a batch ---- */

const revealed = new Set<string>()
let observer: IntersectionObserver | null = null

function getObserver(): IntersectionObserver {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort(
          (a, b) =>
            a.boundingClientRect.top - b.boundingClientRect.top ||
            a.boundingClientRect.left - b.boundingClientRect.left,
        )
      visible.forEach((entry, i) => {
        const el = entry.target as HTMLElement
        observer!.unobserve(el)
        if (el.dataset.revealId) revealed.add(el.dataset.revealId)
        el.style.transitionDelay = `${i * 80}ms`
        el.classList.add('is-revealed')
        window.setTimeout(() => (el.style.transitionDelay = ''), 700 + i * 80)
      })
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
  )
  return observer
}

export function isRevealed(id: string): boolean {
  return revealed.has(id)
}

/** Attach to an element with class `reveal`. While `hold` is true the element stays hidden. */
export function useReveal<T extends HTMLElement>(id: string, hold = false) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || hold) return
    if (revealed.has(id) || prefersReducedMotion() || !('IntersectionObserver' in window)) {
      revealed.add(id)
      el.classList.add('is-revealed')
      return
    }
    const io = getObserver()
    io.observe(el)
    return () => io.unobserve(el)
  }, [id, hold])
  return ref
}
