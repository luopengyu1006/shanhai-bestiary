import { BrowserWindow, app, screen } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'

let quickWin: BrowserWindow | null = null

export function createQuickNoteWindow(): BrowserWindow {
  if (quickWin && !quickWin.isDestroyed()) {
    return quickWin
  }
  const display = screen.getPrimaryDisplay()
  const { width: dw, x: mx, y: my } = display.workArea
  const winW = 520
  const winH = 260
  const x = Math.round(mx + (dw - winW) / 2)
  const y = Math.round(my + Math.min(140, display.workArea.height * 0.15))

  quickWin = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#0B0B0F',
    title: '山海簿 · 速记',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  quickWin.setAlwaysOnTop(true, 'floating')
  quickWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 页面自带 <title>山海簿</title>，会覆盖构造函数里的标题，导致主窗口与速记窗口同名
  quickWin.on('page-title-updated', (e) => e.preventDefault())
  quickWin.setTitle('山海簿 · 速记')

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    quickWin.loadURL(process.env.ELECTRON_RENDERER_URL + '#/quick')
  } else {
    const fileUrl = pathToFileURL(path.join(__dirname, '../renderer/index.html'))
    fileUrl.hash = 'quick'
    quickWin.loadURL(fileUrl.toString())
  }

  quickWin.on('close', (e) => {
    // 隐藏，保留实例
    if (!app.isQuitting) {
      e.preventDefault()
      quickWin?.hide()
    }
  })
  quickWin.on('blur', () => {
    // 关闭按钮、Ctrl+S 提交后由渲染进程显式关闭；失焦不再自动隐藏，避免误操作
  })

  return quickWin
}

export function showQuickNote() {
  const w = createQuickNoteWindow()
  // 重新置顶，避免之前被临时降级（主窗口前置时）
  if (!w.isAlwaysOnTop()) {
    w.setAlwaysOnTop(true, 'floating')
  }
  if (w.isMinimized()) w.restore()
  w.show()
  w.focus()
  // 让渲染进程聚焦输入框（通过 send 或者直接 webContents）
  w.webContents.send('quick:focus')
}

export function getQuickNoteWindow(): BrowserWindow | null {
  return quickWin
}
