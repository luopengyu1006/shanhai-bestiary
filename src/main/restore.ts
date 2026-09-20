import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import initSqlJs, { type SqlJsStatic } from 'sql.js'

let SQL: SqlJsStatic | null = null

async function getSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  const candidates = [
    path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.join(__dirname, 'sql-wasm.wasm'),
    path.join(process.resourcesPath || '', 'sql-wasm.wasm')
  ]
  const wasmPath = candidates.find((p) => fs.existsSync(p))
  if (wasmPath) {
    const buf = fs.readFileSync(wasmPath)
    SQL = await initSqlJs({ wasmBinary: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) })
  } else {
    SQL = await initSqlJs()
  }
  if (!SQL) throw new Error('sql.js 初始化失败')
  return SQL
}

/**
 * 从一个 zip 备份文件恢复数据到当前 userData。
 *
 * 备份格式（由 createBackup 生成）：
 *   - <root>/<dbName>.db           （主数据库）
 *   - <root>/<dbName>.db-wal       （可选）
 *   - <root>/<dbName>.db-shm       （可选）
 *   - <root>/attachments/...       （可选）
 *
 * 行为：
 *   - 把 zip 解压到一个临时目录
 *   - 校验：必须至少有一个 *.db 文件，且能解析为 sqlite + 包含 task 表
 *   - 校验通过：把当前 userData 的 shanhaibu.db 备份为 shanhaibu.db.prev-<ts>，
 *     然后把 zip 里的 db 文件复制为 shanhaibu.db
 *   - 如果 zip 里有 attachments/，合并到 userData 的 attachments/（按 hash 去重）
 *   - 校验失败：原样不动，抛错
 */
export async function importBackup(zipPath: string): Promise<{
  imported: { tasks: number; attachments: number }
  backup: string
  sourceDb: string
}> {
  const userData = app.getPath('userData')
  if (!fs.existsSync(zipPath)) throw new Error(`备份文件不存在：${zipPath}`)
  if (!/\.zip$/i.test(zipPath)) throw new Error('仅支持 .zip 备份文件')

  // 1. 解压到临时目录
  const staging = path.join(userData, `.import-stage-${Date.now()}`)
  fs.mkdirSync(staging, { recursive: true })
  await new Promise<void>((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${staging}" -Force`
      ],
      (err, _stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve())
    )
  })

  try {
    // 2. 找到 db 文件（兼容 shanhaibu.db / workbuddy.db / 其他 *.db）
    const dbFile = findDbFile(staging)
    if (!dbFile) throw new Error('备份中未找到任何 .db 数据库文件')

    // 3. 校验
    const sql = await getSql()
    const probeBuf = fs.readFileSync(dbFile)
    const probe = new sql.Database(probeBuf)
    let taskCount = 0
    try {
      const hasTask = probe.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='task'")[0]
      if (!hasTask || !hasTask.values.length) {
        probe.close()
        throw new Error('备份数据库不含 task 表，格式不兼容')
      }
      const cnt = probe.exec('SELECT COUNT(*) FROM task')[0]
      taskCount = cnt?.values[0]?.[0] ? Number(cnt.values[0][0]) : 0
      probe.close()
    } catch (e) {
      probe.close()
      throw e
    }

    // 4. 把当前 db 备份
    const currentDb = path.join(userData, 'shanhaibu.db')
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)
    const backupPath = path.join(userData, 'shanhaibu.db.prev-' + ts)
    if (fs.existsSync(currentDb)) {
      fs.copyFileSync(currentDb, backupPath)
      for (const ext of ['-wal', '-shm']) {
        if (fs.existsSync(currentDb + ext)) {
          fs.copyFileSync(currentDb + ext, backupPath + ext)
        }
      }
    }

    // 5. 复制新 db（保留原文件名 → 强制命名为 shanhaibu.db）
    fs.copyFileSync(dbFile, currentDb)
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(dbFile + ext)) {
        fs.copyFileSync(dbFile + ext, currentDb + ext)
      }
    }

    // 6. 合并 attachments
    const srcAtt = path.join(staging, 'attachments')
    const dstAtt = path.join(userData, 'attachments')
    let attCopied = 0
    if (fs.existsSync(srcAtt)) {
      attCopied = copyDirSkipExisting(srcAtt, dstAtt)
    }

    return {
      imported: { tasks: taskCount, attachments: attCopied },
      backup: backupPath,
      sourceDb: path.basename(dbFile)
    }
  } finally {
    // 清理 staging
    try {
      fs.rmSync(staging, { recursive: true, force: true })
    } catch {}
  }
}

function findDbFile(dir: string): string | null {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isFile()) continue
    if (/\.db$/.test(e.name) && !/-\.wallet$/.test(e.name)) {
      return path.join(dir, e.name)
    }
  }
  return null
}

/** 递归拷贝：跳过已存在的同名文件（按 hash 文件名天然不会重复） */
function copyDirSkipExisting(src: string, dst: string): number {
  fs.mkdirSync(dst, { recursive: true })
  let n = 0
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      n += copyDirSkipExisting(s, d)
    } else {
      if (!fs.existsSync(d)) {
        fs.copyFileSync(s, d)
        n++
      }
    }
  }
  return n
}