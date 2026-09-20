import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let dbPath = ''
let dirty = false
let persistTimer: NodeJS.Timeout | null = null

const SCHEMA_VERSION = 1

export async function initDb(): Promise<Database> {
  if (db) return db

  // wasm 文件路径：开发态与打包后都能找到
  // 开发: node_modules/sql.js/dist/sql-wasm.wasm
  // 打包: electron-builder asarUnpack 会解开 sql.js，确保 __dirname 能拿到
  const wasmCandidates = [
    path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.join(__dirname, 'sql-wasm.wasm'),
    path.join(process.resourcesPath || '', 'sql-wasm.wasm')
  ]
  let wasmPath = wasmCandidates.find((p) => fs.existsSync(p))
  if (!wasmPath) {
    // 退路：让 sql.js 自己找（可能从网络下载，但通常本地有）
    SQL = await initSqlJs()
  } else {
    const wasmBinary = fs.readFileSync(wasmPath)
    SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) })
  }

  const userData = app.getPath('userData')
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true })
  dbPath = path.join(userData, 'shanhaibu.db')

  // —— 一次性迁移：旧版本数据库文件名为 workbuddy.db ——
  // schema 兼容，直接改名为 shanhaibu.db 即可。
  // 若用户原本已有 shanhaibu.db，不动；旧文件保留 .legacy 备份。
  const legacyDb = path.join(userData, 'workbuddy.db')
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyDb)) {
    try {
      // 先把旧文件复制为新名字，验证可解析再删旧文件
      fs.copyFileSync(legacyDb, dbPath)
      for (const ext of ['-wal', '-shm']) {
        if (fs.existsSync(legacyDb + ext)) fs.copyFileSync(legacyDb + ext, dbPath + ext)
      }
      // 校验：必须能解析为 sqlite 且包含 task 表
      try {
        const probe = new SQL.Database(fs.readFileSync(dbPath))
        const ok = probe.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='task'")[0]
        probe.close()
        if (!ok || !ok.values.length) {
          // 解析成功但不是我们的 db，回滚
          fs.rmSync(dbPath, { force: true })
          for (const ext of ['-wal', '-shm']) {
            if (fs.existsSync(dbPath + ext)) fs.rmSync(dbPath + ext, { force: true })
          }
        } else {
          // 迁移成功，旧文件改名为 .legacy
          fs.renameSync(legacyDb, legacyDb + '.legacy')
          for (const ext of ['-wal', '-shm']) {
            if (fs.existsSync(legacyDb + ext)) fs.renameSync(legacyDb + ext, legacyDb + ext + '.legacy')
          }
          console.info('[山海簿] 已从旧版 db 迁移数据')
        }
      } catch (e) {
        // 校验失败，回滚
        fs.rmSync(dbPath, { force: true })
        for (const ext of ['-wal', '-shm']) {
          if (fs.existsSync(dbPath + ext)) fs.rmSync(dbPath + ext, { force: true })
        }
        console.error('[山海簿] 旧数据库迁移失败，保留原始文件:', e)
      }
    } catch (e) {
      console.error('[山海簿] 旧数据库迁移失败:', e)
    }
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.exec(`PRAGMA foreign_keys = ON;`)
  migrate(db)
  seed(db)
  persist()
  return db
}

export function getDb(): Database {
  if (!db) throw new Error('数据库尚未初始化，请先调用 initDb()')
  return db
}

function migrate(d: Database) {
  d.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  const versionRow = d.exec("SELECT value FROM meta WHERE key='schema_version'")[0]
  const currentVersion = versionRow?.values[0]?.[0] as number | undefined

  if (!currentVersion) {
    d.run(`INSERT INTO meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}')`)
    createTables(d)
  }
}

function createTables(d: Database) {
  d.run(`
    CREATE TABLE IF NOT EXISTS task (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      status_id   INTEGER NOT NULL,
      pinned      INTEGER NOT NULL DEFAULT 0,
      archived    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL,
      closed_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS progress (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id     INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      content     TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachment (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id      INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      progress_id  INTEGER REFERENCES progress(id) ON DELETE SET NULL,
      origin_name  TEXT    NOT NULL,
      stored_path  TEXT    NOT NULL,
      mime         TEXT,
      size         INTEGER NOT NULL DEFAULT 0,
      hash         TEXT    NOT NULL,
      created_at   TEXT    NOT NULL,
      deleted_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS status (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      color       TEXT    NOT NULL,
      sort_order  INTEGER NOT NULL,
      is_closed   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activity (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id        INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      from_status_id INTEGER,
      to_status_id   INTEGER NOT NULL,
      created_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_task_status      ON task(status_id);
    CREATE INDEX IF NOT EXISTS idx_task_updated_at  ON task(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_progress_task    ON progress(task_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_attachment_task  ON attachment(task_id);
  `)
}

const DEFAULT_STATUSES: Array<{ name: string; color: string; is_closed: 0 | 1 }> = [
  { name: '未开始', color: '#94A3B8', is_closed: 0 },
  { name: '待确认', color: '#F59E0B', is_closed: 0 },
  { name: '待开发', color: '#8B5CF6', is_closed: 0 },
  { name: '进行中', color: '#3B82F6', is_closed: 0 },
  { name: '待联调', color: '#06B6D4', is_closed: 0 },
  { name: '待测试', color: '#EAB308', is_closed: 0 },
  { name: '待上线', color: '#F97316', is_closed: 0 },
  { name: '已完成', color: '#22C55E', is_closed: 1 },
  { name: '已暂停', color: '#64748B', is_closed: 0 },
  { name: '已取消', color: '#EF4444', is_closed: 1 }
]

function seed(d: Database) {
  const row = d.exec("SELECT value FROM meta WHERE key='seed_v1'")[0]
  if (row && row.values.length) return

  const stmt = d.prepare('INSERT INTO status (name, color, sort_order, is_closed) VALUES (?, ?, ?, ?)')
  DEFAULT_STATUSES.forEach((s, i) => stmt.run([s.name, s.color, i, s.is_closed]))
  stmt.free()
  d.run("INSERT INTO meta (key, value) VALUES ('seed_v1', '1')")
}

/** 标记脏并延迟落盘（合并连续写） */
export function markDirty() {
  dirty = true
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    persist()
  }, 300)
}

/** 立即同步落盘 */
export function persist() {
  if (!db || !dbPath) return
  try {
    const data = db.export()
    const tmp = dbPath + '.tmp'
    fs.writeFileSync(tmp, Buffer.from(data))
    fs.renameSync(tmp, dbPath)
    dirty = false
  } catch (e) {
    console.error('persist failed:', e)
  }
}

export function getAttachmentsRoot(): string {
  const root = path.join(app.getPath('userData'), 'attachments')
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
  return root
}

export function nowIso(): string {
  return new Date().toISOString()
}
