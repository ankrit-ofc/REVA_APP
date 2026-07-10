/**
 * Decodes the payload of a JWT without verifying its signature.
 * The backend always verifies; here we only need to read claims for UX/routing.
 *
 * `atob` exists globally on Hermes (Expo SDK 57 / RN 0.86); a small pure-JS
 * base64 fallback keeps the critical login path working even if it doesn't.
 */
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64Decode(input: string): string {
  const g = globalThis as { atob?: (s: string) => string }
  if (typeof g.atob === 'function') return g.atob(input)

  // Fallback decoder (Latin1 → string); adequate for ASCII JWT claims.
  const str = input.replace(/=+$/, '')
  let output = ''
  let bc = 0
  let bs = 0
  for (let i = 0; i < str.length; i++) {
    const idx = B64_CHARS.indexOf(str.charAt(i))
    if (idx === -1) continue
    bs = bc % 4 ? bs * 64 + idx : idx
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
    }
  }
  return output
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = base64Decode(b64)
  return JSON.parse(json) as Record<string, unknown>
}
