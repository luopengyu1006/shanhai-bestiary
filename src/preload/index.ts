import { contextBridge, ipcRenderer } from 'electron'
import type { Api, TaskFilter, Status, Preferences } from '../shared/types'

const api: Api = {
  task: {
    create: (title) => ipcRenderer.invoke('task:create', title),
    list: (filter?: TaskFilter) => ipcRenderer.invoke('task:list', filter ?? {}),
    get: (id) => ipcRenderer.invoke('task:get', id),
    rename: (id, title) => ipcRenderer.invoke('task:rename', id, title),
    setStatus: (id, statusId) => ipcRenderer.invoke('task:setStatus', id, statusId),
    pin: (id, pinned) => ipcRenderer.invoke('task:pin', id, pinned),
    archive: (id) => ipcRenderer.invoke('task:archive', id),
    remove: (id) => ipcRenderer.invoke('task:remove', id)
  },
  status: {
    list: () => ipcRenderer.invoke('status:list'),
    create: (input) => ipcRenderer.invoke('status:create', input),
    update: (id, patch) => ipcRenderer.invoke('status:update', id, patch),
    remove: (id, migrateTo) => ipcRenderer.invoke('status:remove', id, migrateTo),
    reorder: (ids) => ipcRenderer.invoke('status:reorder', ids)
  },
  progress: {
    add: (input) => ipcRenderer.invoke('progress:add', input),
    remove: (id) => ipcRenderer.invoke('progress:remove', id)
  },
  attachment: {
    listByTask: (taskId) => ipcRenderer.invoke('attachment:listByTask', taskId),
    addByPaths: (taskId, paths, progressId) =>
      ipcRenderer.invoke('attachment:addByPaths', taskId, paths, progressId),
    addByBytes: (taskId, name, bytes, mime, progressId) =>
      ipcRenderer.invoke('attachment:addByBytes', taskId, name, bytes, mime, progressId),
    open: (id) => ipcRenderer.invoke('attachment:open', id),
    reveal: (id) => ipcRenderer.invoke('attachment:reveal', id),
    remove: (id) => ipcRenderer.invoke('attachment:remove', id)
  },
  onTaskChanged: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('task:changed', listener)
    return () => ipcRenderer.removeListener('task:changed', listener)
  },
  app: {
    openDataDir: () => ipcRenderer.invoke('app:openDataDir'),
    openBackupsDir: () => ipcRenderer.invoke('app:openBackupsDir'),
    version: () => ipcRenderer.invoke('app:version'),
    quit: () => ipcRenderer.invoke('app:quit'),
    hideWindow: () => ipcRenderer.invoke('app:hideWindow'),
    hideQuickNote: () => ipcRenderer.invoke('app:hideQuickNote'),
    showQuickNote: () => ipcRenderer.invoke('app:showQuickNote'),
    showMain: () => ipcRenderer.invoke('app:showMain'),
    exportBackup: (targetPath?: string) => ipcRenderer.invoke('app:exportBackup', targetPath),
    importBackup: (zipPath?: string) => ipcRenderer.invoke('app:importBackup', zipPath)
  },
  prefs: {
    get: () => ipcRenderer.invoke('prefs:get'),
    set: (patch) => ipcRenderer.invoke('prefs:set', patch),
    onChanged: (cb: (next: Preferences) => void) => {
      const listener = (_e: unknown, next: Preferences) => cb(next)
      ipcRenderer.on('prefs:changed', listener)
      return () => ipcRenderer.removeListener('prefs:changed', listener)
    }
  },
  quick: {
    listRecentTasks: (limit?: number) => ipcRenderer.invoke('quick:listRecentTasks', limit),
    submit: (input) => ipcRenderer.invoke('quick:submit', input)
  }
}

contextBridge.exposeInMainWorld('api', api)
