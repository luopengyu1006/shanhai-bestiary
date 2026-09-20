import { app, protocol, net, globalShortcut } from 'electron'
import url from 'url'
import { registerIpc } from './ipc'
import { initDb, getAttachmentsRoot, persist } from './db'
import { setDb } from './stmt'
import { resolveAttachmentPath } from './storage'
import { createTray } from './tray'
import { createQuickNoteWindow, showQuickNote } from './quickNote'
import { createMainWindow, showMainWindow, isDev, startedHidden } from './mainWindow'
import { loadPrefs } from './prefs'

let tray: ReturnType<typeof createTray> | null = null
;(app as any).isQuitting = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  showMainWindow()
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'wb',
    privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true }
  }
])

app.whenReady().then(async () => {
  const database = await initDb()
  setDb(database)

  protocol.handle('wb', (req) => {
    try {
      const u = new URL(req.url)
      const kind = u.hostname === 'thumb' ? 'thumb' : 'local'
      const parts = decodeURIComponent(u.pathname).replace(/^\//, '').split('/')
      const taskIdStr = parts[0]
      const file = parts.slice(1).join('/')
      const resolved = resolveAttachmentPath(kind, taskIdStr, file)
      if (!resolved) return new Response(null, { status: 404 })
      return net.fetch(url.pathToFileURL(resolved.abs).toString())
    } catch (e) {
      return new Response(null, { status: 500 })
    }
  })

  registerIpc()

  // 开机自启（按偏好同步登录项设置）
  const prefs = loadPrefs()
  app.setLoginItemSettings({
    openAtLogin: prefs.autoStart,
    args: prefs.autoStart && prefs.startMinimized ? ['--hidden'] : []
  })

  // 主窗口（--hidden 时不显示）
  const main = createMainWindow()
  if (startedHidden) {
    // 显式留后台，等用户在托盘唤起
  } else {
    main.once('ready-to-show', () => main.show())
  }

  // 托盘常驻
  tray = createTray(showMainWindow, () => showQuickNote())

  // 全局快捷键：唤起速记窗（默认 Ctrl+Alt+N）
  const accel = prefs.quickNoteShortcut
  try {
    const ok = globalShortcut.register(accel, () => showQuickNote())
    if (!ok) console.warn('globalShortcut.register 失败：', accel)
  } catch (e) {
    console.error('globalShortcut error:', e)
  }

  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', (e: Electron.Event) => {
  // 关闭主窗口时不退出（托盘常驻）；仅在真正退出时放行
  if ((app as any).isQuitting) {
    if (process.platform !== 'darwin') app.quit()
  }
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  persist()
})