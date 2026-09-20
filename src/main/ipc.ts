import { ipcMain, BrowserWindow, shell, app, dialog } from 'electron'
import path from 'path'
import { taskRepo, statusRepo, progressRepo, attachmentRepo } from './repo'
import { saveFromPath, saveBytes, attachmentsRootPublic, userDataDir, isImage } from './storage'
import { loadPrefs, savePrefs } from './prefs'
import { showQuickNote } from './quickNote'
import { getMainWindow, showMainWindow } from './mainWindow'
import { createBackup } from './backup'
import { importBackup } from './restore'
import type { TaskFilter } from '../shared/types'

export function registerIpc() {
  // task
  ipcMain.handle('task:create', (_e, title: string) => taskRepo.create(title))
  ipcMain.handle('task:list', (_e, filter?: TaskFilter) => taskRepo.list(filter ?? {}))
  ipcMain.handle('task:get', (_e, id: number) => {
    const task = taskRepo.get(id)
    if (!task) return null
    const progresses = progressRepo.listByTask(id)
    return { task, progresses }
  })
  ipcMain.handle('task:rename', (_e, id: number, title: string) => {
    taskRepo.rename(id, title)
    broadcast()
  })
  ipcMain.handle('task:setStatus', (_e, id: number, statusId: number) => {
    taskRepo.setStatus(id, statusId)
    broadcast()
  })
  ipcMain.handle('task:pin', (_e, id: number, pinned: boolean) => {
    taskRepo.pin(id, pinned)
    broadcast()
  })
  ipcMain.handle('task:archive', (_e, id: number) => {
    taskRepo.archive(id)
    broadcast()
  })
  ipcMain.handle('task:remove', (_e, id: number) => {
    taskRepo.remove(id)
    broadcast()
  })

  // status
  ipcMain.handle('status:list', () => statusRepo.list())
  ipcMain.handle('status:create', (_e, input: { name: string; color: string }) => statusRepo.create(input))
  ipcMain.handle('status:update', (_e, id: number, patch: any) => {
    statusRepo.update(id, patch)
  })
  ipcMain.handle('status:remove', (_e, id: number, migrateTo?: number) => {
    statusRepo.remove(id, migrateTo)
    broadcast()
  })
  ipcMain.handle('status:reorder', (_e, ids: number[]) => {
    statusRepo.reorder(ids)
  })

  // progress
  ipcMain.handle('progress:add', (_e, input: { task_id: number; content: string }) => {
    const p = progressRepo.add(input)
    broadcast()
    return p
  })
  ipcMain.handle('progress:remove', (_e, id: number) => {
    progressRepo.remove(id)
    broadcast()
  })

  // attachment
  ipcMain.handle('attachment:listByTask', (_e, taskId: number) => attachmentRepo.listByTask(taskId))
  ipcMain.handle('attachment:addByPaths', async (_e, taskId: number, paths: string[], progressId?: number) => {
    const results = []
    for (const p of paths) {
      const r = saveFromPath(taskId, p, progressId)
      if (r) results.push(r)
    }
    broadcast()
    return results
  })
  ipcMain.handle(
    'attachment:addByBytes',
    (_e, taskId: number, name: string, bytes: Uint8Array, mime: string | null, progressId?: number) => {
      const buf = Buffer.from(bytes)
      const r = saveBytes(taskId, name, buf, mime)
      broadcast()
      return r
    }
  )
  ipcMain.handle('attachment:open', async (_e, id: number) => {
    const stored = attachmentRepo.open(id)
    if (stored) {
      const err = await shell.openPath(stored)
      if (err) console.error('openPath error:', err)
    }
  })
  ipcMain.handle('attachment:reveal', async (_e, id: number) => {
    const stored = attachmentRepo.open(id)
    if (stored) shell.showItemInFolder(stored)
  })
  ipcMain.handle('attachment:remove', (_e, id: number) => {
    attachmentRepo.remove(id)
    broadcast()
  })

  // app
  ipcMain.handle('app:openDataDir', async () => {
    await shell.openPath(userDataDir())
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:attachmentsRoot', () => attachmentsRootPublic())
  ipcMain.handle('app:quit', () => app.quit())
  ipcMain.handle('app:hideWindow', () => {
    // 只隐藏主窗口；速记窗口由它自己的逻辑控制显隐
    getMainWindow()?.hide()
  })
  ipcMain.handle('app:showQuickNote', () => {
    showQuickNote()
  })
  ipcMain.handle('app:hideQuickNote', () => {
    import('./quickNote').then(({ getQuickNoteWindow }) => {
      getQuickNoteWindow()?.hide()
    })
  })
  ipcMain.handle('app:showMain', () => {
    showMainWindow()
  })
  ipcMain.handle('app:exportBackup', async (_e, targetPath?: string) => {
    if (!targetPath) {
      const r = await dialog.showSaveDialog({
        title: '导出备份',
        defaultPath: path.join(app.getPath('documents') || app.getPath('home'), `shanhaibu-${Date.now()}.zip`),
        filters: [{ name: '山海簿 备份', extensions: ['zip'] }]
      })
      if (r.canceled || !r.filePath) return null
      targetPath = r.filePath
    }
    const r = await createBackup(targetPath)
    broadcast()
    return r
  })
  ipcMain.handle('app:importBackup', async (_e, zipPath?: string) => {
    if (!zipPath) {
      const r = await dialog.showOpenDialog({
        title: '从备份导入',
        filters: [{ name: '山海簿 备份', extensions: ['zip'] }],
        properties: ['openFile']
      })
      if (r.canceled || !r.filePaths.length) return null
      zipPath = r.filePaths[0]
    }
    return importBackup(zipPath)
  })
  ipcMain.handle('app:openBackupsDir', () => shell.openPath(path.join(userDataDir(), 'backups')))

  // prefs
  ipcMain.handle('prefs:get', () => loadPrefs())
  ipcMain.handle('prefs:set', (_e, patch) => {
    const prev = loadPrefs()
    const next = savePrefs(patch)
    // 同步通知所有窗口（包括主窗口 + 速记窗）刷新偏好
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('prefs:changed', next)
    }
    // 同步副作用：开机自启
    if ('autoStart' in patch || 'startMinimized' in patch) {
      app.setLoginItemSettings({
        openAtLogin: next.autoStart,
        args: next.autoStart && next.startMinimized ? ['--hidden'] : []
      })
    }
    // 同步副作用：全局快捷键改了要重新注册
    if ('quickNoteShortcut' in patch && prev.quickNoteShortcut !== next.quickNoteShortcut) {
      import('electron').then(({ globalShortcut }) => {
        try {
          globalShortcut.unregister(prev.quickNoteShortcut)
          const ok = globalShortcut.register(next.quickNoteShortcut, () => {
            showQuickNote()
          })
          if (!ok) console.warn('globalShortcut.register 失败：', next.quickNoteShortcut)
        } catch (e) {
          console.error('globalShortcut error:', e)
        }
      })
    }
    return next
  })

  // quick note
  ipcMain.handle('quick:listRecentTasks', (_e, limit = 10) =>
    taskRepo.list({}).slice(0, limit)
  )
  ipcMain.handle('quick:submit', (_e, input: { mode: 'new' | 'append'; task_id?: number; title: string; content?: string }) => {
    const title = (input.title || '').trim() || `速记 · ${new Date().toLocaleString('zh-CN', { hour12: false })}`
    let task = input.mode === 'append' && input.task_id
      ? taskRepo.get(input.task_id)!
      : taskRepo.create(title)
    let progress
    const content = (input.content ?? '').trim()
    if (content) {
      progress = progressRepo.add({ task_id: task.id, content })
    } else if (input.mode === 'append') {
      // 没有内容只是切换选中，相当于选中已有任务
    } else if (input.mode === 'new') {
      // 新建但没正文：进度文本 = 标题作为第一条
      progress = progressRepo.add({ task_id: task.id, content: title })
    }
    broadcast()
    return { task, progress }
  })
}

function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('task:changed')
  }
}
