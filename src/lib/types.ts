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

export const REACTION_KEYS = ['beautiful', 'story', 'creative', 'ux', 'professional', 'memorable'] as const
export type ReactionKey = (typeof REACTION_KEYS)[number]

/** Everyone's reactions, aggregated: one row per site and reaction that has at least one. */
export interface ReactionCount {
  site_id: string
  reaction: ReactionKey
  count: number
}

/** A reaction's exact total after a change. `version` orders totals: newer always wins. */
export interface ReactionTotal extends ReactionCount {
  version: number
}

export interface ReactionsSnapshot {
  counts: ReactionCount[]
  /** The current visitor's own reactions (empty until they first react). */
  mine: { site_id: string; reaction: ReactionKey }[]
}
