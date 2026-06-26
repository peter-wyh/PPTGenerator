import 'dotenv/config'
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123'
  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, role: Role.ADMIN },
  })
  // eslint-disable-next-line no-console
  console.log(`seeded admin user (id=${admin.id}) — login: admin / ${password}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
