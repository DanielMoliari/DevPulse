import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Deterministic pseudo-random (LCG) — no external libraries
// ---------------------------------------------------------------------------
function makePrng(seed: number) {
  let s = seed | 0
  return function rand(): number {
    // LCG parameters from Numerical Recipes
    s = (Math.imul(1664525, s) + 1013904223) | 0
    return (s >>> 0) / 0x100000000
  }
}

/** Returns a random integer in [min, max] using the supplied rng */
function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function main() {
  const TODAY = toDateOnly(new Date('2026-04-29'))

  // ── 1. Demo user ──────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { githubId: '12345678' },
    update: {
      name:      'Demo Developer',
      email:     'demo@devpulse.app',
      avatarUrl: 'https://avatars.githubusercontent.com/u/12345678',
    },
    create: {
      githubId:    '12345678',
      name:        'Demo Developer',
      email:       'demo@devpulse.app',
      avatarUrl:   'https://avatars.githubusercontent.com/u/12345678',
      githubToken: 'PLACEHOLDER_ENCRYPTED_TOKEN',
    },
  })

  console.log(`Upserted user: ${user.id} (${user.name})`)

  // ── 2. Repositories ───────────────────────────────────────────────────────
  const repoDefinitions = [
    { githubRepoId: '100000001', fullName: 'demo-developer/devpulse',      language: 'TypeScript' },
    { githubRepoId: '100000002', fullName: 'demo-developer/cli-tools',     language: 'Rust' },
    { githubRepoId: '100000003', fullName: 'demo-developer/data-scripts',  language: 'Python' },
  ]

  const repos = await Promise.all(
    repoDefinitions.map((def) =>
      prisma.repository.upsert({
        where: { userId_githubRepoId: { userId: user.id, githubRepoId: def.githubRepoId } },
        update: { fullName: def.fullName, language: def.language, isTracked: true },
        create: {
          userId:       user.id,
          githubRepoId: def.githubRepoId,
          fullName:     def.fullName,
          language:     def.language,
          isTracked:    true,
        },
      }),
    ),
  )

  console.log(`Upserted ${repos.length} repositories`)

  // ── 3. DailyMetrics — 180 days ────────────────────────────────────────────
  const TOTAL_DAYS = 180
  const STREAK_DAYS = 23        // last N days must have commits > 0
  const startDate = addDays(TODAY, -(TOTAL_DAYS - 1))

  // We'll create one aggregate row per day (repoId = null) for simplicity,
  // which represents the user's total activity across all repos.
  let created = 0
  let updated = 0

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = toDateOnly(addDays(startDate, i))
    const rng  = makePrng(i * 31337 + 7)   // deterministic per day

    const daysFromEnd = TOTAL_DAYS - 1 - i  // 0 = today
    const isInStreak  = daysFromEnd < STREAK_DAYS
    const dow         = date.getUTCDay()    // 0=Sun … 6=Sat
    const isWeekend   = dow === 0 || dow === 6
    const isFriday    = dow === 5

    let commits: number

    if (isInStreak) {
      // Guaranteed active: 2-8 commits
      commits = randInt(rng, 2, 8)
    } else if (isWeekend) {
      // ~40% zero days on weekends
      commits = rng() < 0.4 ? 0 : randInt(rng, 1, 3)
    } else if (isFriday) {
      commits = randInt(rng, 2, 6)
    } else {
      // Mon–Thu peak
      commits = randInt(rng, 4, 12)
    }

    const additions  = commits > 0 ? commits * randInt(rng, 18, 55) : 0
    const deletions  = commits > 0 ? Math.floor(additions * (0.2 + rng() * 0.45)) : 0
    const prsOpened  = commits > 0 && !isWeekend ? randInt(rng, 0, 3) : 0
    const prsMerged  = commits > 0 && !isWeekend ? Math.min(prsOpened, randInt(rng, 0, 3)) : 0
    const reviewsDone = commits > 0 && !isWeekend ? randInt(rng, 0, 4) : 0

    // findFirst handles the nullable repoId; findUnique rejects null in composite keys
    const existing = await prisma.dailyMetrics.findFirst({
      where: { userId: user.id, repoId: null, date },
    })

    if (existing) {
      await prisma.dailyMetrics.update({
        where: { id: existing.id },
        data: { commits, additions, deletions, prsOpened, prsMerged, reviewsDone },
      })
      updated++
    } else {
      await prisma.dailyMetrics.create({
        data: {
          userId:       user.id,
          repoId:       null,
          date,
          commits,
          additions,
          deletions,
          prsOpened,
          prsMerged,
          reviewsDone,
        },
      })
      created++
    }
  }

  console.log(`DailyMetrics: ${created} created, ${updated} updated`)

  // ── 4. Streak ─────────────────────────────────────────────────────────────
  const streak = await prisma.streak.upsert({
    where:  { userId: user.id },
    update: {
      currentStreak:  23,
      longestStreak:  47,
      lastActiveDate: TODAY,
    },
    create: {
      userId:         user.id,
      currentStreak:  23,
      longestStreak:  47,
      lastActiveDate: TODAY,
    },
  })

  console.log(
    `Upserted streak: currentStreak=${streak.currentStreak}, longestStreak=${streak.longestStreak}`,
  )

  console.log('\nSeed complete.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
