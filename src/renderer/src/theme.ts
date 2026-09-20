import type { ThemeId } from '../../shared/types'

export const THEMES: { id: ThemeId; name: string; sample: { bg: string; fg: string; accent: string } }[] = [
  { id: 'anye',    name: '暗夜', sample: { bg: '#0B0B0F', fg: '#F5F2EC', accent: '#E8A857' } },
  { id: 'suzhi',   name: '素纸', sample: { bg: '#F5EFE2', fg: '#2A2418', accent: '#B97A2C' } },
  { id: 'shiqing', name: '石青', sample: { bg: '#0E1620', fg: '#EEF4FA', accent: '#7FB8E5' } }
]

export function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute('data-theme', id)
}

/**
 * 在应用挂载前尽早应用主题，避免首次渲染闪烁。
 * 并订阅 prefs:changed，使所有窗口在切换主题时即时同步。
 */
export async function bootstrapTheme() {
  try {
    const prefs = await window.api.prefs.get()
    applyTheme(prefs.theme)
  } catch {
    applyTheme('anye')
  }
  window.api.prefs.onChanged((next) => {
    if (next?.theme) applyTheme(next.theme)
  })
}
