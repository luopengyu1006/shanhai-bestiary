import { useEffect, useState } from 'react'

/** 把键盘事件转成 Electron 加速器格式 */
export function eventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  let keyStr = ''
  const k = e.key
  if (k === ' ') keyStr = 'Space'
  else if (k.length === 1) keyStr = k.toUpperCase()
  else if (k.startsWith('F') && /^F\d+$/.test(k)) keyStr = k
  else if (k === 'Escape' || k === 'Enter' || k === 'Tab' || k === 'Backspace' || k === 'Delete' || k === 'Home' || k === 'End' || k.startsWith('Arrow')) {
    keyStr = k
  } else {
    return null
  }
  if (!keyStr) return null
  parts.push(keyStr)
  return parts.join('+')
}

export function useShortcutCapture() {
  const [capturing, setCapturing] = useState(false)
  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCapturing(false)
        return
      }
      const accel = eventToAccelerator(e)
      if (accel) {
        e.preventDefault()
        e.stopPropagation()
        setCapturing(false)
        window.api.prefs.set({ quickNoteShortcut: accel })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing])
  return { capturing, start: () => setCapturing(true), cancel: () => setCapturing(false) }
}
