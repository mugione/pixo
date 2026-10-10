import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { post } from './api'

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn()

/** True when the user dismissed the OS prompt or it timed out (not a server error). */
export function isCancelled(e: unknown) {
  return e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError')
}

export async function registerPasskey<T>(optionsPath: string, verifyPath: string, payload: Record<string, unknown>): Promise<T> {
  const { challengeId, options } = await post<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }>(optionsPath, payload)
  const response = await startRegistration({ optionsJSON: options })
  return post<T>(verifyPath, { challengeId, response, name: payload.name })
}

export async function loginWithPasskey<T>(): Promise<T> {
  const { challengeId, options } = await post<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>('/api/auth/login/options', {})
  const response = await startAuthentication({ optionsJSON: options })
  return post<T>('/api/auth/login/verify', { challengeId, response })
}
