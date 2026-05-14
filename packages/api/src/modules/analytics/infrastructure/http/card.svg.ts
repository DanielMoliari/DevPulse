import type { PublicProfileData } from '../../application/services/public-profile.service'

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
}

function escSvg(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function langColor(name: string): string {
  return LANG_COLORS[name] ?? '#7c3aed'
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function renderProfileCard(
  profile: Pick<
    PublicProfileData,
    | 'username'
    | 'displayName'
    | 'activeDays'
    | 'totalCommits'
    | 'currentStreak'
    | 'longestStreak'
    | 'topLanguages'
  >,
): string {
  const W = 495
  const H = 195
  const PAD = 20

  const username = escSvg(profile.username)
  const displayName = escSvg(profile.displayName)
  const streak = profile.currentStreak ?? 0
  const topLangs = profile.topLanguages.slice(0, 3)

  // Left column ends at 58% of inner width, right starts there
  const innerW = W - PAD * 2
  const leftW = Math.floor(innerW * 0.58)
  const rightX = PAD + leftW + 16

  // ── Language rows (right column) ──────────────────────────────────────
  const langBarMaxW = W - rightX - PAD - 4
  const langRows = topLangs
    .map((lang, i) => {
      const y = 52 + i * 36
      const barW = Math.max(4, Math.round((lang.percent / 100) * langBarMaxW))
      const color = langColor(lang.name)
      const name = escSvg(lang.name)
      const pct = lang.percent.toFixed(1)
      return `
    <circle cx="${rightX + 6}" cy="${y + 4}" r="4" fill="${color}" />
    <text x="${rightX + 16}" y="${y + 8}" font-size="11" fill="#cbd5e1" font-family="system-ui,-apple-system,sans-serif">${name}</text>
    <text x="${W - PAD}" y="${y + 8}" font-size="10" fill="#64748b" font-family="system-ui,-apple-system,sans-serif" text-anchor="end">${pct}%</text>
    <rect x="${rightX + 6}" y="${y + 14}" width="${langBarMaxW}" height="3" rx="1.5" fill="#1e1e2e" />
    <rect x="${rightX + 6}" y="${y + 14}" width="${barW}" height="3" rx="1.5" fill="${color}" opacity="0.85" />`
    })
    .join('')

  // ── Streak / no-streak line ────────────────────────────────────────────
  const streakLine =
    streak > 0
      ? `<text x="${PAD}" y="110" font-size="13" fill="#fb923c" font-family="system-ui,-apple-system,sans-serif">&#x1F525; ${streak} day streak</text>`
      : `<text x="${PAD}" y="110" font-size="13" fill="#475569" font-family="system-ui,-apple-system,sans-serif">No active streak</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="reflog card for @${username}">
  <title>reflog — @${username}</title>

  <!-- outer background -->
  <rect width="${W}" height="${H}" rx="12" fill="#0f0f0f" />
  <!-- card surface -->
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11" fill="#111111" stroke="#1e1e2e" stroke-width="1" />

  <!-- accent top bar -->
  <rect x="1" y="1" width="${W - 2}" height="3" rx="1.5" fill="#7c3aed" />

  <!-- reflog label -->
  <text x="${PAD}" y="28" font-size="11" font-weight="600" fill="#7c3aed" font-family="system-ui,-apple-system,sans-serif" letter-spacing="0.5">reflog</text>
  <!-- username -->
  <text x="${PAD + 72}" y="28" font-size="11" fill="#475569" font-family="system-ui,-apple-system,sans-serif">@${username}</text>

  <!-- display name -->
  <text x="${PAD}" y="56" font-size="18" font-weight="700" fill="#f1f5f9" font-family="system-ui,-apple-system,sans-serif">${displayName}</text>

  <!-- streak -->
  ${streakLine}

  <!-- total commits -->
  <text x="${PAD}" y="135" font-size="14" fill="#94a3b8" font-family="system-ui,-apple-system,sans-serif">${fmtNum(profile.totalCommits)} commits all-time</text>

  <!-- active days -->
  <text x="${PAD}" y="155" font-size="12" fill="#64748b" font-family="system-ui,-apple-system,sans-serif">${profile.activeDays} active days this year</text>

  <!-- right column: top languages header -->
  ${topLangs.length > 0 ? `<text x="${rightX}" y="38" font-size="10" fill="#475569" font-family="system-ui,-apple-system,sans-serif" font-weight="500" letter-spacing="0.5">TOP LANGUAGES</text>` : ''}
  ${langRows}

  <!-- divider between columns -->
  <line x1="${PAD + leftW + 8}" y1="40" x2="${PAD + leftW + 8}" y2="${H - 28}" stroke="#1e1e2e" stroke-width="1" />

  <!-- bottom accent line -->
  <rect x="1" y="${H - 4}" width="${W - 2}" height="3" rx="1.5" fill="#7c3aed" opacity="0.4" />

  <!-- footer branding -->
  <text x="${W / 2}" y="${H - 8}" font-size="10" fill="#334155" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle">reflog.dev</text>
</svg>`
}

export function renderNotFoundCard(username: string): string {
  const W = 495
  const H = 195
  const safe = escSvg(username)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="reflog — profile not found">
  <title>reflog — profile not found</title>
  <rect width="${W}" height="${H}" rx="12" fill="#0f0f0f" />
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11" fill="#111111" stroke="#1e1e2e" stroke-width="1" />
  <text x="20" y="28" font-size="11" font-weight="600" fill="#7c3aed" font-family="system-ui,-apple-system,sans-serif" letter-spacing="0.5">reflog</text>
  <text x="${W / 2}" y="${H / 2 - 8}" font-size="15" fill="#475569" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle">Profile not found</text>
  <text x="${W / 2}" y="${H / 2 + 14}" font-size="12" fill="#334155" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle">@${safe} hasn&apos;t enabled a public reflog profile yet.</text>
  <rect x="1" y="${H - 4}" width="${W - 2}" height="3" rx="1.5" fill="#7c3aed" opacity="0.4" />
  <text x="${W / 2}" y="${H - 8}" font-size="10" fill="#334155" font-family="system-ui,-apple-system,sans-serif" text-anchor="middle">reflog.dev</text>
</svg>`
}
