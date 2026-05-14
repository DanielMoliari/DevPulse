import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma 7 doesn't auto-load .env — load it explicitly so CLI commands pick up DATABASE_URL
config({ path: path.resolve(import.meta.dirname, '.env') })

const DB_URL = process.env['DATABASE_URL'] ?? 'postgresql://reflog:reflog@localhost:26772/reflog'

export default defineConfig({
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  datasource: {
    url: DB_URL,
  },
  migrate: {
    async adapter() {
      const { default: pg } = await import('pg')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const pool = new pg.Pool({ connectionString: DB_URL })
      return new PrismaPg(pool)
    },
  },
})
