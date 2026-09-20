import { BrowserWindow, app, shell } from 'electron'
import path from 'path'
import { getQuickNoteWindow } from './quickNote'
import { loadPrefs } from './prefs'

const isDev = !app.isPackaged
const startedHidden = process.argv.includes('--hidden')

// 主窗口实例引用：窗口标题会被页面 <title> 覆盖，且 BrowserWindow.getAllWindows()
// 不保证创建顺序（前台窗口排在前面），因此不能用标题/顺序来识别主窗口
let mainWin: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#0B0B0F',
    title: '山海簿',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (!startedHidden) win.once('ready-to-show', () => win.show())

  mainWin = win
  win.on('closed', () => {
    if (mainWin === win) mainWin = null
  })
  win.on('destroyed', () => {
    if (mainWin === win) mainWin = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 关窗口 → 默认销毁整个 BrowserWindow（彻底释放 renderer + GPU 进程内存），
  // 仅保留主进程、托盘、全局快捷键与 sql.js 数据；再次从托盘唤起时会按冷启动重建。
  // 若用户关闭了该偏好，则维持原来的"关窗即退"语义。
  // 幂等保护：destroying 标记防止 close/hide 两条路径双重销毁。
  let destroying = false
  const destroyNow = () => {
    if (destroying) return
    destroying = true
    if (mainWin === win) mainWin = null
    if (!win.isDestroyed()) win.destroy()
  }
  win.on('close', (e) => {
    if ((app as any).isQuitting) return
    const prefs = loadPrefs()
    if (!prefs.closeToTray) return
    // preventDefault 后必须在下一轮事件循环里 destroy，否则 Electron 会忽略 preventDefault。
    e.preventDefault()
    setImmediate(destroyNow)
  })

  // 兜底：当用户/调用方通过 IPC 走 hide() 时也强制销毁，
  // 防止 renderer 进程因 hide 而残留（例如 app:hideWindow）。
  win.on('hide', () => {
    const prefs = loadPrefs()
    if ((app as any).isQuitting || !prefs.closeToTray) return
    destroyNow()
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function showMainWindow() {
  let win = getMainWindow()
  if (!win) win = createMainWindow()
  // 把主窗口放到速记窗口前面：先强制收起速记窗（必要时临时降级 alwaysOnTop）
  const quick = getQuickNoteWindow()
  if (quick && !quick.isDestroyed()) {
    if (quick.isAlwaysOnTop()) quick.setAlwaysOnTop(false)
    quick.hide()
  }
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
  win.moveTop()
}

export { isDev, startedHidden }