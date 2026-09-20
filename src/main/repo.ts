import { getDb, nowIso } from './db'
import { prep } from './stmt'
import type { Status, TaskWithStatus, Progress, Attachment, TaskFilter } from '../shared/types'

const TASK_SELECT = `
  SELECT t.id, t.title, t.status_id, t.pinned, t.archived, t.created_at, t.updated_at, t.closed_at,
         s.name AS status_name, s.color AS status_color, s.is_closed AS is_closed,
         (SELECT COUNT(1) FROM progress p WHERE p.task_id = t.id) AS progress_count,
         (SELECT COUNT(1) FROM attachment a WHERE a.task_id = t.id AND a.deleted_at IS NULL) AS attachment_count
  FROM task t
  JOIN status s ON s.id = t.status_id
`

export const taskRepo = {
  create(title: string): TaskWithStatus {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('标题不能为空')
    const now = nowIso()
    const defaultStatus = prep("SELECT id FROM status ORDER BY sort_order ASC LIMIT 1").get<{ id: number }>()
    if (!defaultStatus) throw new Error('状态字典为空')
    const info = prep('INSERT INTO task (title, status_id, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(trimmed, defaultStatus.id, now, now)
    prep('INSERT INTO activity (task_id, from_status_id, to_status_id, created_at) VALUES (?, NULL, ?, ?)')
      .run(Number(info.lastInsertRowid), defaultStatus.id, now)
    return this.get(Number(info.lastInsertRowid))!
  },

  get(id: number): TaskWithStatus | null {
    const row = prep(`${TASK_SELECT} WHERE t.id = ?`).get<TaskWithStatus>(id)
    return row ?? null
  },

  list(filter: TaskFilter = {}): TaskWithStatus[] {
    const wheres: string[] = ['t.archived = 0']
    const params: any[] = []
    if (filter.status_ids && filter.status_ids.length) {
      wheres.push(`t.status_id IN (${filter.status_ids.map(() => '?').join(',')})`)
      params.push(...filter.status_ids)
    }
    if (filter.includeArchived) wheres[0] = '1 = 1'
    if (filter.keyword) {
      wheres.push('(t.title LIKE ? OR EXISTS (SELECT 1 FROM progress p WHERE p.task_id = t.id AND p.content LIKE ?))')
      const kw = `%${filter.keyword}%`
      params.push(kw, kw)
    }
    const order = filter.sort === 'created' ? 't.created_at DESC' : 't.updated_at DESC'
    return prep(`${TASK_SELECT} WHERE ${wheres.join(' AND ')} ORDER BY t.pinned DESC, ${order}`)
      .all<TaskWithStatus>(...params)
  },

  rename(id: number, title: string) {
    prep('UPDATE task SET title = ?, updated_at = ? WHERE id = ?').run(title.trim(), nowIso(), id)
  },

  setStatus(id: number, statusId: number) {
    const task = prep('SELECT status_id FROM task WHERE id = ?').get<{ status_id: number }>(id)
    if (!task) throw new Error('任务不存在')
    if (task.status_id === statusId) return
    const target = prep('SELECT is_closed FROM status WHERE id = ?').get<{ is_closed: 0 | 1 }>(statusId)
    if (!target) throw new Error('状态不存在')
    const now = nowIso()
    if (target.is_closed) {
      prep('UPDATE task SET status_id = ?, updated_at = ?, closed_at = ? WHERE id = ?')
        .run(statusId, now, now, id)
    } else {
      prep('UPDATE task SET status_id = ?, updated_at = ?, closed_at = NULL WHERE id = ?')
        .run(statusId, now, id)
    }
    prep('INSERT INTO activity (task_id, from_status_id, to_status_id, created_at) VALUES (?, ?, ?, ?)')
      .run(id, task.status_id, statusId, now)
  },

  pin(id: number, pinned: boolean) {
    prep('UPDATE task SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id)
  },

  archive(id: number) {
    prep('UPDATE task SET archived = 1 WHERE id = ?').run(id)
  },

  remove(id: number) {
    prep('DELETE FROM task WHERE id = ?').run(id)
  }
}

export const statusRepo = {
  list(): Status[] {
    return prep('SELECT * FROM status ORDER BY sort_order ASC').all<Status>()
  },
  create(input: { name: string; color: string }): Status {
    const max = prep('SELECT COALESCE(MAX(sort_order), -1) AS m FROM status').get<{ m: number }>()!.m
    const info = prep('INSERT INTO status (name, color, sort_order, is_closed) VALUES (?, ?, ?, 0)')
      .run(input.name.trim(), input.color, max + 1)
    return prep('SELECT * FROM status WHERE id = ?').get<Status>(Number(info.lastInsertRowid))!
  },
  update(id: number, patch: Partial<Pick<Status, 'name' | 'color' | 'sort_order' | 'is_closed'>>) {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
    if (!entries.length) return
    const sql = `UPDATE status SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`
    prep(sql).run(...entries.map(([, v]) => v), id)
  },
  remove(id: number, migrateTo?: number) {
    const count = prep('SELECT COUNT(1) AS c FROM task WHERE status_id = ?').get<{ c: number }>(id)?.c ?? 0
    if (count > 0 && !migrateTo) throw new Error(`有 ${count} 个任务正使用该状态，请指定迁移目标`)
    if (migrateTo) prep('UPDATE task SET status_id = ? WHERE status_id = ?').run(migrateTo, id)
    prep('DELETE FROM status WHERE id = ?').run(id)
  },
  reorder(ids: number[]) {
    const stmt = prep('UPDATE status SET sort_order = ? WHERE id = ?')
    ids.forEach((id, i) => stmt.run(i, id))
  }
}

export const progressRepo = {
  listByTask(taskId: number): Progress[] {
    return prep('SELECT * FROM progress WHERE task_id = ? ORDER BY created_at DESC').all<Progress>(taskId)
  },
  add(input: { task_id: number; content: string }): Progress {
    const now = nowIso()
    const info = prep('INSERT INTO progress (task_id, content, created_at) VALUES (?, ?, ?)')
      .run(input.task_id, input.content ?? '', now)
    prep('UPDATE task SET updated_at = ? WHERE id = ?').run(now, input.task_id)
    return prep('SELECT * FROM progress WHERE id = ?').get<Progress>(Number(info.lastInsertRowid))!
  },
  remove(id: number) {
    prep('DELETE FROM progress WHERE id = ?').run(id)
  }
}

export const metaRepo = {
  get(key: string): string | undefined {
    return prep('SELECT value FROM meta WHERE key = ?').get<{ value: string }>(key)?.value
  },
  set(key: string, value: string) {
    prep('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  },
  remove(key: string) {
    prep('DELETE FROM meta WHERE key = ?').run(key)
  }
}

export const attachmentRepo = {
  listByTask(taskId: number): Attachment[] {
    return prep('SELECT * FROM attachment WHERE task_id = ? AND deleted_at IS NULL ORDER BY created_at DESC')
      .all<Attachment>(taskId)
  },
  insert(row: Omit<Attachment, 'id' | 'created_at'>): Attachment {
    const now = nowIso()
    const info = prep(`INSERT INTO attachment
      (task_id, progress_id, origin_name, stored_path, mime, size, hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        row.task_id,
        row.progress_id,
        row.origin_name,
        row.stored_path,
        row.mime,
        row.size,
        row.hash,
        now
      )
    prep('UPDATE task SET updated_at = ? WHERE id = ?').run(now, row.task_id)
    return prep('SELECT * FROM attachment WHERE id = ?').get<Attachment>(Number(info.lastInsertRowid))!
  },
  findByHash(taskId: number, hash: string): Attachment | undefined {
    return prep('SELECT * FROM attachment WHERE task_id = ? AND hash = ? AND deleted_at IS NULL LIMIT 1')
      .get<Attachment>(taskId, hash)
  },
  open(id: number): string | null {
    const row = prep('SELECT stored_path FROM attachment WHERE id = ?').get<{ stored_path: string }>(id)
    return row?.stored_path ?? null
  },
  remove(id: number) {
    prep("UPDATE attachment SET deleted_at = ? WHERE id = ?").run(nowIso(), id)
  }
}
