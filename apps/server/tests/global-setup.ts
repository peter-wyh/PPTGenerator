import { execSync } from 'node:child_process'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test', override: true })

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing for tests — check apps/server/.env.test')
  }
  execSync('pnpm exec prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
