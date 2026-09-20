import { metaRepo } from './repo'
import { DEFAULT_PREFERENCES, type Preferences, type ThemeId } from '../shared/types'

const KEY = 'preferences_v1'
const THEMES: ThemeId[] = ['anye', 'suzhi', 'shiqing']

export function loadPrefs(): Preferences {
  const raw = metaRepo.get(KEY)
  if (!raw) return { ...DEFAULT_PREFERENCES }
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>
    const theme: ThemeId = THEMES.includes(parsed.theme as ThemeId)
      ? (parsed.theme as ThemeId)
      : DEFAULT_PREFERENCES.theme
    return { ...DEFAULT_PREFERENCES, ...parsed, theme }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePrefs(patch: Partial<Preferences>): Preferences {
  const next = { ...loadPrefs(), ...patch }
  if (!THEMES.includes(next.theme)) next.theme = DEFAULT_PREFERENCES.theme
  metaRepo.set(KEY, JSON.stringify(next))
  return next
}
