import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app, nativeImage } from 'electron'
import { getAttachmentsRoot } from './db'
import { attachmentRepo } from './repo'
import type { Attachment } from '../shared/types'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'])

export function ensureTaskDir(taskId: number): string {
  const root = getAttachmentsRoot()
  const dir = path.join(root, String(taskId))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function ensureThumbsDir(taskId: number): string {
  const dir = path.join(ensureTaskDir(taskId), '.thumbs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function sha1(buf: Buffer): string {
  return crypto.createHash('sha1').update(buf).digest('hex')
}

/** 生成缩略图（jpg，宽度 480，q=78）。失败返回 null。 */
export function generateThumbnail(taskId: number, hash: string, origAbs: string): string | null {
  try {
    const img = nativeImage.createFromPath(origAbs)
    if (img.isEmpty()) return null
    const { width } = img.getSize()
    if (width <= 480) {
      const resized = img.resize({ width: 480, quality: 'good' })
      const buf = resized.toJPEG(82)
      const dir = ensureThumbsDir(taskId)
      const thumbPath = path.join(dir, `${hash}.jpg`)
      fs.writeFileSync(thumbPath, buf)
      return thumbPath
    }
    const resized = img.resize({ width: 480, quality: 'good' })
    const buf = resized.toJPEG(78)
    const dir = ensureThumbsDir(taskId)
    const thumbPath = path.join(dir, `${hash}.jpg`)
    fs.writeFileSync(thumbPath, buf)
    return thumbPath
  } catch (e) {
    console.error('thumbnail failed:', e)
    return null
  }
}

export function saveBytes(taskId: number, name: string, bytes: Buffer, mime: string | null): Attachment {
  const hash = sha1(bytes)
  const existed = attachmentRepo.findByHash(taskId, hash)
  if (existed) return existed

  const ext = (path.extname(name) || guessExt(mime) || '.bin').toLowerCase()
  const dir = ensureTaskDir(taskId)
  const filename = `${hash}${ext}`
  const abs = path.join(dir, filename)
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, bytes)

  if (isImage(mime, name)) generateThumbnail(taskId, hash, abs)

  return attachmentRepo.insert({
    task_id: taskId,
    progress_id: null,
    origin_name: name,
    stored_path: abs,
    mime: mime ?? guessMime(ext),
    size: bytes.length,
    hash
  })
}

export function saveFromPath(taskId: number, srcPath: string, progressId?: number): Attachment | null {
  if (!fs.existsSync(srcPath)) return null
  const buf = fs.readFileSync(srcPath)
  const hash = sha1(buf)
  const existed = attachmentRepo.findByHash(taskId, hash)
  if (existed) return existed

  const name = path.basename(srcPath)
  const ext = path.extname(name).toLowerCase()
  const dir = ensureTaskDir(taskId)
  const filename = `${hash}${ext}`
  const abs = path.join(dir, filename)
  if (!fs.existsSync(abs)) fs.copyFileSync(srcPath, abs)

  if (isImage(guessMime(ext), name)) generateThumbnail(taskId, hash, abs)

  return attachmentRepo.insert({
    task_id: taskId,
    progress_id: progressId ?? null,
    origin_name: name,
    stored_path: abs,
    mime: guessMime(ext),
    size: buf.length,
    hash
  })
}

/** 仅把磁盘上的文件按 hash 落盘并入库（用于截图直贴，名字由调用方传） */
export function saveBufferAs(taskId: number, name: string, bytes: Buffer): Attachment {
  const hash = sha1(bytes)
  const existed = attachmentRepo.findByHash(taskId, hash)
  if (existed) return existed
  const ext = path.extname(name).toLowerCase() || '.png'
  const dir = ensureTaskDir(taskId)
  const abs = path.join(dir, `${hash}${ext}`)
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, bytes)
  const mime = guessMime(ext) || 'image/png'
  if (isImage(mime, name)) generateThumbnail(taskId, hash, abs)
  return attachmentRepo.insert({
    task_id: taskId,
    progress_id: null,
    origin_name: name,
    stored_path: abs,
    mime,
    size: bytes.length,
    hash
  })
}

function guessExt(mime: string | null): string {
  if (!mime) return ''
  if (mime.includes('png')) return '.png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg'
  if (mime.includes('gif')) return '.gif'
  if (mime.includes('bmp')) return '.bmp'
  if (mime.includes('webp')) return '.webp'
  return ''
}

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.log': 'text/plain',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.document'.replace('document', 'sheet'),
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

function guessMime(ext: string): string {
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

export function isImage(mime: string | null, name: string): boolean {
  if (mime && mime.startsWith('image/')) return true
  return IMAGE_EXTS.has(path.extname(name).toLowerCase())
}

export function attachmentsRootPublic(): string {
  return getAttachmentsRoot()
}

export function userDataDir(): string {
  return app.getPath('userData')
}

/**
 * 解析 wb:// 请求到磁盘绝对路径。
 * 支持：
 *   wb://local/<taskId>/<hash>.<ext>   → 原图
 *   wb://thumb/<taskId>/<hash>.<ext>   → 缩略图（不存在则回落原图）
 */
export function resolveAttachmentPath(kind: 'local' | 'thumb', taskIdStr: string, file: string): {
  abs: string
  root: string
} | null {
  if (!/^\d+$/.test(taskIdStr)) return null
  const root = getAttachmentsRoot()
  const taskDir = path.join(root, taskIdStr)
  const safeName = path.basename(file)
  let abs: string
  if (kind === 'thumb') {
    const tryThumb = path.normalize(path.join(taskDir, '.thumbs', safeName))
    if (fs.existsSync(tryThumb)) abs = tryThumb
    else {
      const hash = safeName.split('.')[0]
      const candidates = fs.existsSync(taskDir)
        ? fs.readdirSync(taskDir).filter((f) => f.startsWith(hash + '.') && !f.endsWith('.tmp'))
        : []
      if (candidates.length) abs = path.normalize(path.join(taskDir, candidates[0]))
      else return null
    }
  } else {
    abs = path.normalize(path.join(taskDir, safeName))
    if (!fs.existsSync(abs)) return null
  }
  if (!abs.startsWith(root)) return null
  return { abs, root }
}
