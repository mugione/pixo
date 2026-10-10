export const PURPOSES = ['own_business', 'ecommerce', 'social_media', 'agency', 'personal'] as const
export type Purpose = (typeof PURPOSES)[number]
