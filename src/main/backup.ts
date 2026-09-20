import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'

function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/**
 * 把 userData 下的 shanhaibu.db + attachments/ 打包成 zip
 * 用 PowerShell Compress-Archive（Windows 自带），零原生依赖。
 */
export async function createBackup(targetPath?: string): Promise<{ path: string; size: number }> {
  const userData = app.getPath('userData')
  const dest = targetPath ?? path.join(userData, 'backups', `shanhaibu-${nowStamp()}.zip`)
  fs.mkdirSync(path.dirname(dest), { recursive: true })

  // 临时把数据库与 attachments 拷到一个 staging 目录，避免 Compress-Archive 把 .tmp 等干扰文件一起塞进去
  const staging = path.join(userData, `.backup-stage-${Date.now()}`)
  fs.mkdirSync(staging, { recursive: true })
  const dbSrc = path.join(userData, 'shanhaibu.db')
  const dbDst = path.join(staging, 'shanhaibu.db')
  fs.copyFileSync(dbSrc, dbDst)
  // 顺带把 sqlite 的 wal/shm 也带上
  for (const ext of ['-wal', '-shm']) {
    const f = dbSrc + ext
    if (fs.existsSync(f)) fs.copyFileSync(f, dbDst + ext)
  }
  const attSrc = path.join(userData, 'attachments')
  if (fs.existsSync(attSrc)) {
    const attDst = path.join(staging, 'attachments')
    copyDirSync(attSrc, attDst)
  }

  await new Promise<void>((resolve, reject) => {
    // PowerShell 调 Compress-Archive
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Compress-Archive -Path "${staging}\\*" -DestinationPath "${dest}" -Force`
    ]
    execFile('powershell.exe', args, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve()
    })
  })

  // 清理 staging
  try {
    fs.rmSync(staging, { recursive: true, force: true })
  } catch {}

  const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0
  return { path: dest, size }
}

function copyDirSync(src: string, dst: string) {
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDirSync(s, d)
    else fs.copyFileSync(s, d)
  }
}
