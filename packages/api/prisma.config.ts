import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/devpulse',
  },
  migrate: {
    async adapter() {
      const { default: pg } = await import('pg')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const pool = new pg.Pool({
        connectionString: process.env['DATABASE_URL'],
      })
      return new PrismaPg(pool)
    },
  },
})
