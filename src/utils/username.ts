import { normalizeVi } from './normalize'

export const USERNAME_EMAIL_DOMAIN = 'tntt.local'

export function slugifyUsername(username: string): string {
  return normalizeVi(username).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function usernameToAuthEmail(username: string): string {
  const slug = slugifyUsername(username)
  return `${slug}@${USERNAME_EMAIL_DOMAIN}`
}
