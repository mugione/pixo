import { describe, expect, it } from 'vitest'
import { clean, validateContact } from '../shared/contact'

const valid = {
  name: 'Ayşe Yılmaz',
  email: 'Ayse@Example.com',
  subject: 'Merhaba',
  message: 'Pixo AI hakkında bir sorum var.',
  consent: true,
  turnstileToken: 'tok',
  lang: 'tr',
}

describe('validateContact', () => {
  it('accepts a valid submission and normalises it', () => {
    const r = validateContact(valid)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.email).toBe('ayse@example.com')
  })

  it('reports every invalid field', () => {
    const r = validateContact({ name: 'a', email: 'nope', subject: '', message: 'short', consent: false })
    expect(r).toEqual({ ok: false, fields: ['name', 'email', 'subject', 'message', 'consent'] })
  })

  it('requires consent to be literally true', () => {
    expect(validateContact({ ...valid, consent: 'true' }).ok).toBe(false)
  })

  it('rejects over-long input', () => {
    expect(validateContact({ ...valid, message: 'x'.repeat(5001) }).ok).toBe(false)
    expect(validateContact({ ...valid, name: 'x'.repeat(101) }).ok).toBe(false)
  })

  it('handles non-object and non-string input safely', () => {
    expect(validateContact(null).ok).toBe(false)
    expect(validateContact({ ...valid, name: 42 }).ok).toBe(false)
  })

  it('falls back to tr for unknown languages', () => {
    const r = validateContact({ ...valid, lang: 'de' })
    expect(r.ok && r.value.lang).toBe('tr')
  })
})

describe('clean', () => {
  it('strips control characters but keeps newlines in multiline text', () => {
    expect(clean('a\u0000b\nc')).toBe('abc')
    expect(clean('a\u0007b\nc', true)).toBe('ab\nc')
  })
})
