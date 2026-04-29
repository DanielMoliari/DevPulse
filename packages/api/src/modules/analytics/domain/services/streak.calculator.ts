export interface StreakResult {
  currentStreak: number
  longestStreak: number
  lastActiveDate: Date | null
}

export class StreakCalculator {
  /**
   * Recalculates streak from a list of active dates (dates with at least 1 commit).
   * Days are counted as consecutive if they are 1 calendar day apart.
   */
  static calculate(activeDates: Date[]): StreakResult {
    if (activeDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastActiveDate: null }
    }

    const uniqueDays = [
      ...new Set(activeDates.map((d) => this.toDateKey(d))),
    ].sort()

    let longestStreak = 1
    let currentRun = 1

    for (let i = 1; i < uniqueDays.length; i++) {
      const prev = new Date(uniqueDays[i - 1] as string)
      const curr = new Date(uniqueDays[i] as string)
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)

      if (diffDays === 1) {
        currentRun++
        if (currentRun > longestStreak) longestStreak = currentRun
      } else {
        currentRun = 1
      }
    }

    // Current streak: count backwards from today
    const today = this.toDateKey(new Date())
    const yesterday = this.toDateKey(new Date(Date.now() - 86_400_000))
    const lastDay = uniqueDays.at(-1) as string

    let currentStreak = 0
    if (lastDay === today || lastDay === yesterday) {
      currentStreak = 1
      for (let i = uniqueDays.length - 2; i >= 0; i--) {
        const curr = new Date(uniqueDays[i + 1] as string)
        const prev = new Date(uniqueDays[i] as string)
        const diff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
        if (diff === 1) {
          currentStreak++
        } else {
          break
        }
      }
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      lastActiveDate: new Date(lastDay),
    }
  }

  private static toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10)
  }
}
