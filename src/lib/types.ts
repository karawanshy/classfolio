export interface Site {
  id: string
  creator_name: string
  site_url: string
  github_url: string | null
  screenshot_url: string | null
  created_at: string
}

export interface SiteInput {
  creator_name: string
  site_url: string
  github_url: string | null
}

export type SiteChange = { type: 'upsert'; site: Site } | { type: 'delete'; id: string }
