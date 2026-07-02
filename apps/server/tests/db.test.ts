import { describe, it, expect } from 'vitest';
import { prisma } from '../src/prisma';
import { hashPassword } from '../src/utils/hash';

describe('database connectivity', () => {
  it('connects and can round-trip a user record', async () => {
    const created = await prisma.user.create({
      data: {
        email: 'db@x.com',
        passwordHash: hashPassword('Password123'),
        role: 'USER',
      },
    });
    const found = await prisma.user.findUnique({ where: { id: created.id } });
    expect(found?.email).toBe('db@x.com');
    expect(found?.role).toBe('USER');
  });

  it('project cascade-deletes with its owner', async () => {
    const user = await prisma.user.create({
      data: { email: 'cascade@x.com', passwordHash: hashPassword('x'), role: 'USER' },
    });
    await prisma.project.create({
      data: { ownerId: user.id, name: 'P', pages: [] },
    });
    expect(await prisma.project.count()).toBe(1);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.project.count()).toBe(0);
  });
});
