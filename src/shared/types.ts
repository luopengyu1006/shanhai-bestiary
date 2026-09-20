// 跨进程共享的类型定义
export interface Status {
  id: number
  name: string
  color: string
  sort_order: number
  is_closed: 0 | 1
}

export interface Task {
  id: number
  title: string
  status_id: number
  pinned: 0 | 1
  archived: 0 | 1
  created_at: string
  updated_at: string
  closed_at: string | null
}

export interface TaskWithStatus extends Task {
  status_name: string
  status_color: string
  is_closed: 0 | 1
  progress_count: number
  attachment_count: number
}

export interface Progress {
  id: number
  task_id: number
  content: string
  created_at: string
}

export interface Attachment {
  id: number
  task_id: number
  progress_id: number | null
  origin_name: string
  stored_path: string
  mime: string | null
  size: number
  hash: string
  created_at: string
}

export interface TaskFilter {
  status_ids?: number[]
  keyword?: string
  includeArchived?: boolean
  sort?: 'updated' | 'created'
}

export type ThemeId = 'anye' | 'suzhi' | 'shiqing'

export interface Preferences {
  autoStart: boolean
  quickNoteShortcut: string
  startMinimized: boolean
  closeToTray: boolean
  theme: ThemeId
}

export const DEFAULT_PREFERENCES: Preferences = {
  autoStart: false,
  quickNoteShortcut: 'CommandOrControl+Alt+N',
  startMinimized: false,
  closeToTray: true,
  theme: 'anye'
}

export interface Api {
  task: {
    create: (title: string) => Promise<TaskWithStatus>
    list: (filter?: TaskFilter) => Promise<TaskWithStatus[]>
    get: (id: number) => Promise<{ task: TaskWithStatus; progresses: Progress[] } | null>
    rename: (id: number, title: string) => Promise<void>
    setStatus: (id: number, statusId: number) => Promise<void>
    pin: (id: number, pinned: boolean) => Promise<void>
    archive: (id: number) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  status: {
    list: () => Promise<Status[]>
    create: (input: { name: string; color: string }) => Promise<Status>
    update: (id: number, patch: Partial<Pick<Status, 'name' | 'color' | 'sort_order' | 'is_closed'>>) => Promise<void>
    remove: (id: number, migrateTo?: number) => Promise<void>
    reorder: (ids: number[]) => Promise<void>
  }
  progress: {
    add: (input: { task_id: number; content: string }) => Promise<Progress>
    remove: (id: number) => Promise<void>
  }
  attachment: {
    listByTask: (taskId: number) => Promise<Attachment[]>
    addByPaths: (taskId: number, paths: string[], progressId?: number) => Promise<Attachment[]>
    addByBytes: (taskId: number, name: string, bytes: Uint8Array, mime: string | null, progressId?: number) => Promise<Attachment>
    open: (id: number) => Promise<void>
    reveal: (id: number) => Promise<void>
    remove: (id: number) => Promise<void>
  }
  onTaskChanged: (cb: () => void) => () => void
  app: {
    openDataDir: () => Promise<void>
    openBackupsDir: () => Promise<void>
    version: () => Promise<string>
    quit: () => Promise<void>
    hideWindow: () => Promise<void>
    hideQuickNote: () => Promise<void>
    showQuickNote: () => Promise<void>
    showMain: () => Promise<void>
    exportBackup: (targetPath?: string) => Promise<{ path: string; size: number } | null>
    importBackup: (zipPath?: string) => Promise<{
      imported: { tasks: number; attachments: number }
      backup: string
      sourceDb: string
    } | null>
  }
  prefs: {
    get: () => Promise<Preferences>
    set: (patch: Partial<Preferences>) => Promise<Preferences>
    onChanged: (cb: (next: Preferences) => void) => () => void
  }
  quick: {
    listRecentTasks: (limit?: number) => Promise<TaskWithStatus[]>
    submit: (input: {
      mode: 'new' | 'append'
      task_id?: number
      title: string
      content?: string
    }) => Promise<{ task: TaskWithStatus; progress?: Progress }>
  }
}

declare global {
  interface Window {
    api: Api
  }
}
