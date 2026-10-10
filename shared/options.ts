// Enumerations shared by the UI (labels live in i18n) and the Worker (validation + prompts).

export const CATEGORIES = ['cosmetics', 'fashion', 'electronics', 'home', 'food', 'education', 'software', 'service', 'other'] as const
export const GOALS = ['product_intro', 'brand_awareness', 'campaign_announcement', 'product_launch', 'social_engagement', 'traffic', 'lead_generation'] as const
export const CONTENT_TYPES = ['instagram_post', 'facebook_post', 'ad_copy', 'product_description', 'seo_content', 'campaign_slogan', 'email_campaign'] as const
export const TONES = ['professional', 'friendly', 'energetic', 'minimalist', 'luxury', 'playful', 'informative'] as const
export const LENGTHS = ['short', 'medium', 'long'] as const
export const LANGUAGES = ['tr', 'en'] as const
export const SCENES = ['minimal_studio', 'luxury_product', 'nature_organic', 'modern_lifestyle', 'colorful_advertising', 'clean_ecommerce'] as const
export const STYLES = ['photorealistic', 'studio', 'minimalist', 'cinematic', 'modern_ad', 'editorial'] as const
export const ASPECTS = ['1:1', '4:5', '9:16', '16:9'] as const
export const PROJECT_TYPES = ['text', 'campaign', 'image'] as const
export const PROJECT_STATUSES = ['draft', 'in_progress', 'completed'] as const

export type Category = (typeof CATEGORIES)[number]
export type Goal = (typeof GOALS)[number]
export type ContentType = (typeof CONTENT_TYPES)[number]
export type Tone = (typeof TONES)[number]
export type Length = (typeof LENGTHS)[number]
export type Scene = (typeof SCENES)[number]
export type Style = (typeof STYLES)[number]
export type Aspect = (typeof ASPECTS)[number]
export type ProjectType = (typeof PROJECT_TYPES)[number]
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

/** Output sizes sent to the image model (multiples of 16, within the model's 256–1920 range). */
export const ASPECT_SIZES: Record<Aspect, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 896, height: 1120 },
  '9:16': { width: 768, height: 1360 },
  '16:9': { width: 1360, height: 768 },
}

/** Shapes returned by the AI endpoints (validated on the server before reaching the UI). */
export type TextVariant = { title: string; body: string; cta: string; hashtags: string[] }
export type TextResult = { variants: TextVariant[] }
export type CampaignResult = {
  name: string
  mainMessage: string
  headlines: string[]
  socialCaptions: string[]
  shortDescription: string
  cta: string
  visualConcept: string
  schedule: { day: string; channel: string; content: string }[]
}
