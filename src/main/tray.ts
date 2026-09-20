import { Tray, Menu, BrowserWindow, app, nativeImage, NativeImage } from 'electron'
import path from 'path'

function buildTrayIcon(): NativeImage {
  // 程序化生成一颗琥珀色圆点（PNG，16×16，RGBA），避免依赖外部图标文件
  const w = 32
  const h = 32
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0 // filter byte
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2 + 0.5) / (w / 2)
      const dy = (y - h / 2 + 0.5) / (h / 2)
      const d = Math.sqrt(dx * dx + dy * dy)
      const aa = Math.max(0, Math.min(1, 1.05 - d * 0.95))
      const off = y * (1 + w * 4) + 1 + x * 4
      raw[off] = 232
      raw[off + 1] = 168
      raw[off + 2] = 87
      raw[off + 3] = Math.round(255 * aa)
    }
  }
  // CRC32
  const tbl: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tbl[n] = c >>> 0
  }
  function crc32(buf: Buffer): number {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = tbl[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const t = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
    return Buffer.concat([len, t, data, crc])
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const zlib = require('zlib')
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
  return nativeImage.createFromBuffer(png)
}

export function createTray(onShowMain: () => void, onQuickNote: () => void): Tray {
  const tray = new Tray(buildTrayIcon())
  tray.setToolTip('山海簿')
  const menu = Menu.buildFromTemplate([
    { label: '主窗口', click: () => onShowMain() },
    { label: '速记', accelerator: 'CommandOrControl+Alt+N', click: () => onQuickNote() },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit() } }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => onShowMain())
  tray.on('double-click', () => onShowMain())
  return tray
}
