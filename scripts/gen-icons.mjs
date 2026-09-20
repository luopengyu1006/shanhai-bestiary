// 程序化绘制 山海簿 应用图标（PNG 多尺寸 + ICO）
// 风格：墨黑底 + 矿紫 / 琥珀金 / 朱砂，呼应《山海经》青绿矿物色
// 不依赖任何第三方库；纯像素合成 + PNG 编码 + ICO 封装
//
// 使用：node scripts/gen-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT = path.resolve('build')
fs.mkdirSync(OUT, { recursive: true })

// ---------- 颜色 ----------
const BG_OUTER = [6, 4, 10] // #06040A
const BG_MID = [14, 10, 20] // #0E0A14
const BG_INNER = [27, 20, 36] // #1B1424

// 矿紫
const VIOLET_TOP = [181, 140, 255] // #B58CFF
const VIOLET_BOT = [106, 72, 201] // #6A48C9

// 琥珀金
const GOLD_TOP = [244, 194, 119] // #F4C277
const GOLD_MID = [232, 168, 87] // #E8A857
const GOLD_BOT = [164, 95, 38] // #A45F26

// 朱砂
const CINN_TOP = [242, 107, 107]
const CINN_BOT = [168, 38, 61]

// 印章
const SEAL = [168, 38, 61]
const SEAL_TEXT = [251, 230, 181]

// ---------- 工具 ----------
const lerp = (a, b, t) => a + (b - a) * t
const lerpRGB = (a, b, t) => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t))
]
const mixRGB = (a, b, t) => lerpRGB(a, b, t)

// 解析 SVG 风格 path 字符串（仅支持 M/L/C/Q/Z + 数字）
// 在 viewBox 单位下，调用前需把每个点的 x/y 通过 mapPoint 映射到实际像素坐标
function parsePath(d) {
  const tokens = []
  let cur = ''
  for (let i = 0; i < d.length; i++) {
    const c = d[i]
    if (c === ',' || c === ' ' || c === '\n' || c === '\t') {
      if (cur) { tokens.push(cur); cur = '' }
    } else if (/[A-Za-z]/.test(c)) {
      if (cur) { tokens.push(cur); cur = '' }
      tokens.push(c)
    } else {
      cur += c
    }
  }
  if (cur) tokens.push(cur)
  const cmds = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (/[A-Za-z]/.test(t)) {
      const cmd = t
      i++
      if (cmd === 'Z' || cmd === 'z') { cmds.push({ c: 'Z', args: [] }); continue }
      const n = (cmd === 'M' || cmd === 'L' || cmd === 'm' || cmd === 'l') ? 2
        : (cmd === 'C' || cmd === 'c') ? 6
        : (cmd === 'Q' || cmd === 'q') ? 4
        : 0
      const args = []
      for (let k = 0; k < n; k++) args.push(parseFloat(tokens[i + k]))
      cmds.push({ c: cmd, args })
      i += n
    } else i++
  }
  return cmds
}

// 对一段 path 命令，把每个 (x,y) 通过 scale/offset 映射到实际坐标
function transformCmd(cmd, scale, ox, oy) {
  const tr = (x, y) => [ox + x * scale, oy + y * scale]
  switch (cmd.c) {
    case 'M': case 'L': {
      const [x, y] = tr(cmd.args[0], cmd.args[1])
      return { c: cmd.c === 'M' ? 'M' : 'L', args: [x, y] }
    }
    case 'm': case 'l': {
      const [x, y] = tr(cmd.args[0], cmd.args[1])
      return { c: 'L', args: [x, y] } // 简化为绝对坐标
    }
    case 'C': {
      const p1 = tr(cmd.args[0], cmd.args[1])
      const p2 = tr(cmd.args[2], cmd.args[3])
      const p3 = tr(cmd.args[4], cmd.args[5])
      return { c: 'C', args: [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]] }
    }
    case 'Q': {
      const p1 = tr(cmd.args[0], cmd.args[1])
      const p2 = tr(cmd.args[2], cmd.args[3])
      return { c: 'Q', args: [p1[0], p1[1], p2[0], p2[1]] }
    }
    default: return cmd
  }
}

// 把解析后的命令序列展平为多边形采样点（用递归细分近似贝塞尔）
function flattenPath(cmds, samples = 24) {
  const pts = []
  let cx = 0, cy = 0
  let startX = 0, startY = 0
  for (const cmd of cmds) {
    switch (cmd.c) {
      case 'M':
        cx = cmd.args[0]; cy = cmd.args[1]
        startX = cx; startY = cy
        pts.push([cx, cy])
        break
      case 'L':
        cx = cmd.args[0]; cy = cmd.args[1]
        pts.push([cx, cy])
        break
      case 'C': {
        const [x1, y1, x2, y2, x, y] = cmd.args
        const p0 = [cx, cy], p1 = [x1, y1], p2 = [x2, y2], p3 = [x, y]
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const u = 1 - t
          const xx = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
          const yy = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
          pts.push([xx, yy])
        }
        cx = x; cy = y
        break
      }
      case 'Q': {
        const [x1, y1, x, y] = cmd.args
        const p0 = [cx, cy], p1 = [x1, y1], p2 = [x, y]
        for (let i = 1; i <= samples; i++) {
          const t = i / samples
          const u = 1 - t
          const xx = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
          const yy = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
          pts.push([xx, yy])
        }
        cx = x; cy = y
        break
      }
      case 'Z':
        pts.push([startX, startY])
        cx = startX; cy = startY
        break
    }
  }
  return pts
}

// 扫描线填充多边形
function fillPolygon(buf, W, H, poly, getColor) {
  if (poly.length < 3) return
  let minY = poly[0][1], maxY = poly[0][1]
  for (const [, y] of poly) {
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const yStart = Math.max(0, Math.floor(minY))
  const yEnd = Math.min(H - 1, Math.ceil(maxY))
  for (let y = yStart; y <= yEnd; y++) {
    const xs = []
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]
      const [xj, yj] = poly[j]
      if ((yi > y) !== (yj > y)) {
        const t = (y - yi) / (yj - yi)
        xs.push(xi + t * (xj - xi))
      }
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.floor(xs[k]))
      const x1 = Math.min(W - 1, Math.ceil(xs[k + 1]))
      for (let x = x0; x <= x1; x++) {
        const c = getColor(x, y)
        const idx = (y * W + x) * 4
        buf[idx] = c[0]; buf[idx + 1] = c[1]; buf[idx + 2] = c[2]; buf[idx + 3] = 255
      }
    }
  }
}

// 把一个 path（SVG 字符串）画成"填充 + 描边"
function drawPath(buf, W, H, dStr, scale, ox, oy, fillColor, strokeColor, strokeWidth) {
  const cmds = parsePath(dStr).map(c => transformCmd(c, scale, ox, oy))
  const poly = flattenPath(cmds)
  if (fillColor) fillPolygon(buf, W, H, poly, () => fillColor)
  if (strokeColor && strokeWidth > 0) {
    for (let i = 0; i < poly.length - 1; i++) {
      const [x1, y1] = poly[i]
      const [x2, y2] = poly[i + 1]
      plotLine(buf, W, H, x1, y1, x2, y2, strokeWidth, () => strokeColor)
    }
  }
  return poly
}

// 在画布缓冲中以 (cx,cy) 为中心、半径 r 抗锯齿画一个圆
function plotDisk(buf, w, h, cx, cy, r, getColor) {
  const r2 = r * r
  const x0 = Math.max(0, Math.floor(cx - r - 1))
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1))
  const y0 = Math.max(0, Math.floor(cy - r - 1))
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > r + 0.6) continue
      const aa = Math.max(0, Math.min(1, r + 0.6 - d))
      const c = getColor(x, y)
      const idx = (y * w + x) * 4
      // alpha blend
      const A = aa
      buf[idx] = Math.round(buf[idx] * (1 - A) + c[0] * A)
      buf[idx + 1] = Math.round(buf[idx + 1] * (1 - A) + c[1] * A)
      buf[idx + 2] = Math.round(buf[idx + 2] * (1 - A) + c[2] * A)
      buf[idx + 3] = 255
    }
  }
}

// 圆环（描边）
function plotRing(buf, w, h, cx, cy, r, thickness, getColor) {
  const rOuter = r + thickness / 2
  const rInner = r - thickness / 2
  const x0 = Math.max(0, Math.floor(cx - rOuter - 1))
  const x1 = Math.min(w - 1, Math.ceil(cx + rOuter + 1))
  const y0 = Math.max(0, Math.floor(cy - rOuter - 1))
  const y1 = Math.min(h - 1, Math.ceil(cy + rOuter + 1))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > rOuter + 0.6 || d < rInner - 0.6) continue
      const aaOuter = Math.max(0, Math.min(1, rOuter + 0.6 - d))
      const aaInner = Math.max(0, Math.min(1, d - (rInner - 0.6)))
      const aa = Math.min(aaOuter, aaInner)
      const c = getColor(x, y)
      const idx = (y * w + x) * 4
      const A = aa
      buf[idx] = Math.round(buf[idx] * (1 - A) + c[0] * A)
      buf[idx + 1] = Math.round(buf[idx + 1] * (1 - A) + c[1] * A)
      buf[idx + 2] = Math.round(buf[idx + 2] * (1 - A) + c[2] * A)
      buf[idx + 3] = 255
    }
  }
}

// 描线（带端点圆形 cap）
function plotLine(buf, w, h, x1, y1, x2, y2, thickness, getColor) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.001) return
  const steps = Math.ceil(len * 2)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = x1 + dx * t
    const y = y1 + dy * t
    plotDisk(buf, w, h, x, y, thickness / 2, getColor)
  }
}

// 圆角矩形填充
function plotRoundRect(buf, w, h, x0, y0, x1, y1, radius, getColor) {
  const r = radius
  const X0 = Math.max(0, Math.floor(x0))
  const X1 = Math.min(w - 1, Math.ceil(x1))
  const Y0 = Math.max(0, Math.floor(y0))
  const Y1 = Math.min(h - 1, Math.ceil(y1))
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      // 找最近边
      const cx = Math.max(x0 + r, Math.min(x1 - r, x))
      const cy = Math.max(y0 + r, Math.min(y1 - r, y))
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      let aa
      if (d <= r - 0.6) aa = 1
      else if (d >= r + 0.6) aa = 0
      else aa = r + 0.6 - d
      if (aa <= 0) continue
      const c = getColor(x, y)
      const idx = (y * w + x) * 4
      buf[idx] = Math.round(buf[idx] * (1 - aa) + c[0] * aa)
      buf[idx + 1] = Math.round(buf[idx + 1] * (1 - aa) + c[1] * aa)
      buf[idx + 2] = Math.round(buf[idx + 2] * (1 - aa) + c[2] * aa)
      buf[idx + 3] = 255
    }
  }
}

// 印章用字模：7×9 篆刻风（横平竖直、笔画端方、对称）
const FONT_7x9 = {
  '山': [
    '0001000',
    '0001000',
    '0001000',
    '0001000',
    '0001000',
    '0011100',
    '0111110',
    '1100011',
    '1111111'
  ],
  '海': [
    '0100100',
    '0100100',
    '0111100',
    '1100011',
    '0111100',
    '0011000',
    '0111100',
    '1100011',
    '0111110'
  ]
}

// 把字符栅格化到 buf 中（中心 cx,cy）
function plotChar(buf, w, h, cx, cy, scale, ch, color) {
  const g = FONT_7x9[ch]
  if (!g) return
  const W = 7 * scale
  const H = 9 * scale
  const x0 = Math.floor(cx - W / 2)
  const y0 = Math.floor(cy - H / 2)
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 7; col++) {
      if (g[row][col] !== '1') continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = x0 + col * scale + dx
          const y = y0 + row * scale + dy
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          const idx = (y * w + x) * 4
          buf[idx] = color[0]
          buf[idx + 1] = color[1]
          buf[idx + 2] = color[2]
          buf[idx + 3] = 255
        }
      }
    }
  }
}

// ---------- 主体绘制 ----------
function drawIcon(size) {
  const W = size
  const H = size
  const buf = Buffer.alloc(W * H * 4)
  // 初始透明
  for (let i = 3; i < buf.length; i += 4) buf[i] = 0

  const cx = W / 2
  const cy = H / 2

  // 1) 圆角方形底（墨黑径向渐变）
  const rad = size * 0.18 // 圆角半径
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx
      const dy = y - cy * 0.9 // 偏上
      const d = Math.sqrt(dx * dx + dy * dy) / (W * 0.7)
      const t = Math.max(0, Math.min(1, d))
      const c = mixRGB(BG_INNER, BG_OUTER, t)
      const idx = (y * W + x) * 4
      buf[idx] = c[0]; buf[idx + 1] = c[1]; buf[idx + 2] = c[2]; buf[idx + 3] = 255
    }
  }
  // 把圆角外透明化（保留圆角矩形）
  // 重新 alpha mask
  const radius = rad
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const rx = x < radius ? radius - x - 0.5 : x > W - radius ? x - (W - radius) - 0.5 : -1
      const ry = y < radius ? radius - y - 0.5 : y > H - radius ? y - (H - radius) - 0.5 : -1
      if (rx >= 0 && ry >= 0) {
        const d = Math.sqrt(rx * rx + ry * ry)
        if (d > radius) {
          const idx = (y * W + x) * 4
          buf[idx + 3] = 0
        }
      }
    }
  }

  // 2) 不对称外环（矿紫）
  const ringR = size * 0.43
  const ringT = Math.max(1, size * 0.012)
  const angle0 = (-Math.PI / 2) - 0.6 // 缺口起点
  const angle1 = (-Math.PI / 2) + 1.4 // 缺口终点
  // 缺口外的环：分段画
  const seg = 360
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2
    const a1 = ((i + 1) / seg) * Math.PI * 2
    const aMid = (a0 + a1) / 2
    // 跳过缺口
    if (aMid >= angle0 && aMid <= angle1) continue
    const x0 = cx + Math.cos(a0) * ringR
    const y0 = cy + Math.sin(a0) * ringR
    const x1 = cx + Math.cos(a1) * ringR
    const y1 = cy + Math.sin(a1) * ringR
    // 颜色按角度渐变：矿紫 top→bot
    const tt = (aMid / (Math.PI * 2)) % 1
    const col = mixRGB(VIOLET_TOP, VIOLET_BOT, tt)
    plotLine(buf, W, H, x0, y0, x1, y1, ringT, () => col)
  }
  // 端点小圆点
  const cap = ringT * 1.2
  plotDisk(buf, W, H, cx + Math.cos(angle0) * ringR, cy + Math.sin(angle0) * ringR, cap, () => VIOLET_BOT)
  plotDisk(buf, W, H, cx + Math.cos(angle1) * ringR, cy + Math.sin(angle1) * ringR, cap, () => VIOLET_BOT)

  // 3) 异兽主体：龙首侧面（用 SVG 路径绘制）
  //    viewBox 0..512,锚定中心 (256, 280)
  // 配色：金色填充 + 暗金描边
  const beastScale = size / 512
  const beastOX = cx - 256 * beastScale
  const beastOY = cy - 256 * beastScale - size * 0.02

  // 主轮廓：龙首（吻部突出、颧骨弧线、颈脊线）
  const beastFill = GOLD_TOP
  const beastFill2 = GOLD_BOT
  const beastStroke = GOLD_BOT
  // 用绝对像素颜色（每像素都画纯色，简化渐变效果——通过叠加半透明副色实现近似渐变）
  const headPath = `
    M 130 320
    C 130 220, 200 175, 280 175
    C 350 175, 405 215, 415 265
    C 420 295, 410 320, 380 330
    L 360 340
    C 350 350, 345 360, 350 370
    C 360 380, 375 378, 388 370
    L 410 358
    C 420 355, 425 360, 422 368
    L 410 388
    C 395 405, 370 410, 350 400
    L 320 380
    C 310 375, 300 375, 290 380
    L 260 400
    C 245 408, 230 408, 215 400
    L 175 380
    C 150 365, 130 350, 125 330
    Z
  `
  drawPath(buf, W, H, headPath, beastScale, beastOX, beastOY,
    beastFill, beastStroke, Math.max(2, size * 0.008))

  // 龙首上的深色纹理（颧骨线 + 吻部高光分割）
  const detailPath = `
    M 145 305
    C 180 260, 240 230, 300 235
    C 340 240, 370 255, 388 280
    C 360 300, 320 308, 280 305
    C 240 302, 200 308, 170 318
    Z
  `
  drawPath(buf, W, H, detailPath, beastScale, beastOX, beastOY,
    beastFill2, null, 0)

  // 鼻梁棱线（暗金，把头部切成"前脸/上额"两块面）
  const noseRidge = `
    M 230 250
    C 260 230, 320 225, 360 245
  `
  drawPath(buf, W, H, noseRidge, beastScale, beastOX, beastOY,
    null, GOLD_BOT, Math.max(1, size * 0.005))

  // 后颈鳍（向上延伸的尖锐鳍状几何，山海报本异兽特征）
  const crest = `
    M 270 175
    L 255 130
    L 280 160
    L 290 110
    L 300 165
    L 320 120
    L 325 175
    Z
  `
  drawPath(buf, W, H, crest, beastScale, beastOX, beastOY,
    GOLD_TOP, GOLD_BOT, Math.max(1, size * 0.006))

  // 4) 鹿角：两支向后回环（金色一支 + 矿紫一支）
  const hornScale = size / 512
  const hornOX = cx - 256 * hornScale
  const hornOY = cy - 256 * hornScale - size * 0.02
  // 左角（金色，向左上后卷）
  const leftHorn = `
    M 220 175
    C 200 110, 165 80, 130 95
    C 100 110, 95 145, 130 165
    C 155 175, 180 175, 200 180
  `
  drawPath(buf, W, H, leftHorn, hornScale, hornOX, hornOY,
    null, GOLD_TOP, Math.max(3, size * 0.022))
  // 左角刺
  const leftHornTine = `
    M 140 105 L 120 75 M 145 130 L 115 125
  `
  plotLine(buf, W, H,
    beastOX + 140 * hornScale, beastOY + 105 * hornScale,
    beastOX + 120 * hornScale, beastOY + 75 * hornScale,
    Math.max(2, size * 0.014), () => GOLD_TOP)
  plotLine(buf, W, H,
    beastOX + 145 * hornScale, beastOY + 130 * hornScale,
    beastOX + 115 * hornScale, beastOY + 125 * hornScale,
    Math.max(2, size * 0.014), () => GOLD_TOP)

  // 右角（矿紫，向右上后卷）
  const rightHorn = `
    M 320 178
    C 350 115, 400 90, 425 115
    C 450 138, 445 175, 410 195
    C 390 205, 370 200, 355 195
  `
  drawPath(buf, W, H, rightHorn, hornScale, hornOX, hornOY,
    null, VIOLET_TOP, Math.max(3, size * 0.022))
  // 右角刺
  plotLine(buf, W, H,
    beastOX + 410 * hornScale, beastOY + 115 * hornScale,
    beastOX + 440 * hornScale, beastOY + 88 * hornScale,
    Math.max(2, size * 0.014), () => VIOLET_TOP)
  plotLine(buf, W, H,
    beastOX + 415 * hornScale, beastOY + 160 * hornScale,
    beastOX + 448 * hornScale, beastOY + 162 * hornScale,
    Math.max(2, size * 0.014), () => VIOLET_TOP)

  // 5) 眼：朱砂瞳 + 金环 + 白高光
  const eyeX = beastOX + 345 * beastScale
  const eyeY = beastOY + 270 * beastScale
  const eyeR = Math.max(2, size * 0.035)
  plotRing(buf, W, H, eyeX, eyeY, eyeR * 1.1, Math.max(1, size * 0.006), () => GOLD_TOP)
  plotDisk(buf, W, H, eyeX, eyeY, eyeR, () => CINN_TOP)
  plotDisk(buf, W, H, eyeX - eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.32, () => [255, 240, 220])

  // 6) 鱼尾 / 卷云须（颈后飘带）
  const whisker1 = `
    M 380 360
    C 430 360, 460 335, 470 295
  `
  drawPath(buf, W, H, whisker1, beastScale, beastOX, beastOY,
    null, VIOLET_TOP, Math.max(2, size * 0.015))
  const whisker2 = `
    M 370 388
    C 425 392, 460 378, 482 350
  `
  drawPath(buf, W, H, whisker2, beastScale, beastOX, beastOY,
    null, GOLD_TOP, Math.max(2, size * 0.012))

  // 7) 鼻孔/吻端点
  plotDisk(buf, W, H,
    beastOX + 412 * beastScale, beastOY + 290 * beastScale,
    Math.max(1, size * 0.008), () => CINN_BOT)

  // 7) 篆刻印章"山海"（右下）
  const sealSize = size * 0.22
  const sealX = cx + size * 0.17
  const sealY = cy + size * 0.16
  plotRoundRect(buf, W, H,
    sealX, sealY, sealX + sealSize, sealY + sealSize,
    size * 0.028,
    () => SEAL)
  // 内框
  const inPad = size * 0.020
  const ix0 = sealX + inPad
  const iy0 = sealY + inPad
  const ix1 = sealX + sealSize - inPad
  const iy1 = sealY + sealSize - inPad
  const frameColor = GOLD_TOP
  // 顶部
  plotLine(buf, W, H, ix0 + size * 0.018, iy0, ix1 - size * 0.018, iy0, Math.max(1, size * 0.008), () => frameColor)
  // 底部
  plotLine(buf, W, H, ix0 + size * 0.018, iy1, ix1 - size * 0.018, iy1, Math.max(1, size * 0.008), () => frameColor)
  // 左
  plotLine(buf, W, H, ix0, iy0 + size * 0.018, ix0, iy1 - size * 0.018, Math.max(1, size * 0.008), () => frameColor)
  // 右
  plotLine(buf, W, H, ix1, iy0 + size * 0.018, ix1, iy1 - size * 0.018, Math.max(1, size * 0.008), () => frameColor)
  // 字（7×9 像素字模，按印章大小自适应）
  const charScale = Math.max(1, Math.floor((sealSize * 0.42) / 7))
  plotChar(buf, W, H, sealX + sealSize / 2, sealY + sealSize * 0.32, charScale, '山', SEAL_TEXT)
  plotChar(buf, W, H, sealX + sealSize / 2, sealY + sealSize * 0.72, charScale, '海', SEAL_TEXT)

  // 8) 一颗朱砂小星（外环缺口附近）+ 一颗金点
  plotDisk(buf, W, H, cx + size * 0.36, cy - size * 0.28, Math.max(1, size * 0.014), () => CINN_TOP)
  plotDisk(buf, W, H, cx - size * 0.36, cy + size * 0.20, Math.max(1, size * 0.010), () => GOLD_TOP)

  return buf
}

// ---------- PNG 编码 ----------
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crcBuf])
}

function encodePNG(rgba, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  // 每行前缀 1 字节 filter
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---------- ICO 封装（多尺寸 PNG 嵌入） ----------
function encodeICO(pngs /* [{w, buf}] */) {
  // ICONDIR header (6) + entries (16 each) + PNG data
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type 1 = icon
  header.writeUInt16LE(pngs.length, 4) // count
  const entries = Buffer.alloc(16 * pngs.length)
  let offset = 6 + 16 * pngs.length
  for (let i = 0; i < pngs.length; i++) {
    const { w, buf } = pngs[i]
    const e = entries.subarray(i * 16, (i + 1) * 16)
    e.writeUInt8(w >= 256 ? 0 : w, 0) // 0 means 256
    e.writeUInt8(w >= 256 ? 0 : w, 1) // height
    e.writeUInt8(0, 2) // color palette
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // color planes
    e.writeUInt16LE(32, 6) // bpp
    e.writeUInt32LE(buf.length, 8) // image size
    e.writeUInt32LE(offset, 12) // offset
    offset += buf.length
  }
  return Buffer.concat([header, entries, ...pngs.map(p => p.buf)])
}

// ---------- 主流程 ----------
const sizes = [256, 128, 64, 48, 32, 16]
const pngs = sizes.map(s => {
  const rgba = drawIcon(s)
  const png = encodePNG(rgba, s, s)
  const outPath = path.join(OUT, `icon-${s}.png`)
  fs.writeFileSync(outPath, png)
  console.log('  wrote', outPath, `(${png.length} bytes)`)
  return { w: s, buf: png }
})

// icon.ico（多尺寸）
const ico = encodeICO(pngs)
fs.writeFileSync(path.join(OUT, 'icon.ico'), ico)
console.log('  wrote build/icon.ico (', ico.length, 'bytes )')

// 单独的 512 大图（README/营销用）
const big = drawIcon(512)
const bigPng = encodePNG(big, 512, 512)
fs.writeFileSync(path.join(OUT, 'icon-512.png'), bigPng)
console.log('  wrote build/icon-512.png (', bigPng.length, 'bytes )')

console.log('\n✓ 山海簿 图标生成完成')