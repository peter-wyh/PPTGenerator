import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/utils/hash'

describe('hash utils', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('s3cret')
    expect(hash).not.toBe('s3cret')
    await expect(verifyPassword('s3cret', hash)).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret')
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false)
  })
})
