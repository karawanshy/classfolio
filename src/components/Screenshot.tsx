import { useEffect, useState } from 'react'
import { CameraIcon } from './icons'

interface ScreenshotProps {
  src: string
  alt: string
  /** Retry failed loads a couple of times (fresh submissions whose capture isn't ready yet). */
  retry?: boolean
}

type Status = 'loading' | 'loaded' | 'error'

const RETRY_DELAYS = [6000, 20000]

export function Screenshot({ src, alt, retry = false }: ScreenshotProps) {
  const [status, setStatus] = useState<Status>('loading')
  const [tall, setTall] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Reset whenever the source changes (e.g. an admin edited the URL).
  const [prevSrc, setPrevSrc] = useState(src)
  if (prevSrc !== src) {
    setPrevSrc(src)
    setStatus('loading')
    setAttempt(0)
    setTall(false)
  }

  useEffect(() => {
    if (status !== 'error' || !retry || attempt >= RETRY_DELAYS.length) return
    const t = window.setTimeout(() => {
      setAttempt((a) => a + 1)
      setStatus('loading')
    }, RETRY_DELAYS[attempt])
    return () => window.clearTimeout(t)
  }, [status, retry, attempt])

  const failed = status === 'error' && (!retry || attempt >= RETRY_DELAYS.length)

  return (
    <div className={`shot ${tall ? 'shot--tall' : 'shot--viewport'} ${status === 'loaded' ? 'is-loaded' : ''}`}>
      {status !== 'error' && (
        <img
          key={attempt}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            const img = e.currentTarget
            // Taller than ~16:12 means we have a full-page capture worth scrolling through.
            setTall(img.naturalWidth > 0 && img.naturalHeight / img.naturalWidth > 0.75)
            setStatus('loaded')
          }}
          onError={() => setStatus('error')}
        />
      )}
      {status !== 'loaded' && (
        <div className={`shot-placeholder ${failed ? '' : 'shimmer'}`}>
          <CameraIcon size={22} />
          <span className="mono-label">{failed ? 'Preview unavailable' : 'Capturing snapshot…'}</span>
        </div>
      )}
    </div>
  )
}
