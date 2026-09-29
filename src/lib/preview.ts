import type { Site } from './types'

// Microlink captures a 1280×800 viewport and redirects straight to the image.
// Swap providers by setting VITE_SCREENSHOT_URL_TEMPLATE; `{url}` is replaced with the encoded site URL.
const DEFAULT_TEMPLATE =
  'https://api.microlink.io/?url={url}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=800'

export function getPreviewUrl(siteUrl: string): string {
  const template = import.meta.env.VITE_SCREENSHOT_URL_TEMPLATE || DEFAULT_TEMPLATE
  return template.replace('{url}', encodeURIComponent(siteUrl))
}

/** A stored screenshot (e.g. captured once by an Edge Function) wins over the live provider. */
export function previewFor(site: Pick<Site, 'site_url' | 'screenshot_url'>): string {
  return site.screenshot_url || getPreviewUrl(site.site_url)
}
