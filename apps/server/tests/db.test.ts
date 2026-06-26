import { describe, it, expect } from 'vitest'
import { prisma } from '../src/prisma'

describe('test db reset (beforeEach)', () => {
  it('can create a user', async () => {
    await prisma.user.create({ data: { username: 'temp', passwordHash: 'x', role: 'USER' } })
    expect(await prisma.user.count()).toBe(1)
  })

  it('starts clean because resetDb ran in beforeEach', async () => {
    expect(await prisma.user.count()).toBe(0)
  })
})
