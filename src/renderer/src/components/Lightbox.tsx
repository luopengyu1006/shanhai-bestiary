import { useEffect, useState, useCallback, useRef } from 'react'
import type { Attachment } from '../../../shared/types'
import { fileSize } from '../utils'

interface Props {
  images: Attachment[]
  index: number
  onClose: () => void
  onIndex: (i: number) => void
}

export function Lightbox({ images, index, onClose, onIndex }: Props) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const current = images[index]

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    reset()
  }, [index, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < images.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, images.length, onClose, onIndex])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.002
    setScale((s) => Math.min(5, Math.max(0.5, s + delta)))
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const d = dragRef.current
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) })
  }
  const onMouseUp = () => {
    dragRef.current = null
  }

  if (!current) return null

  return (
    <div
      className="fade"
      onClick={onClose}
      onWheel={onWheel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.86)',
        backdropFilter: 'blur(10px)',
        zIndex: 200,
        display: 'grid',
        placeItems: 'center',
        cursor: scale > 1 ? 'grab' : 'zoom-out'
      }}
    >
      {/* 顶部栏 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13
        }}
      >
        <div className="col" style={{ gap: 4 }}>
          <span className="serif" style={{ fontSize: 16, fontStyle: 'italic' }}>
            {current.origin_name}
          </span>
          <span className="mono dim" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {fileSize(current.size)} · {index + 1} / {images.length}
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            onClick={reset}
            title="重置缩放"
            style={btnStyle}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              window.api.attachment.open(current.id)
            }}
            title="打开原文件"
            style={btnStyle}
          >
            ⤴ 打开
          </button>
          <button onClick={onClose} title="关闭 (Esc)" style={btnStyle}>
            ✕
          </button>
        </div>
      </div>

      {/* 上一张 / 下一张 */}
      {index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onIndex(index - 1)
          }}
          title="上一张 (←)"
          style={{
            ...navBtnStyle,
            left: 24
          }}
        >
          ‹
        </button>
      )}
      {index < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onIndex(index + 1)
          }}
          title="下一张 (→)"
          style={{
            ...navBtnStyle,
            right: 24
          }}
        >
          ›
        </button>
      )}

      {/* 图片 */}
      <img
        ref={imgRef}
        src={`wb://local/${current.task_id}/${current.hash}.${current.origin_name.split('.').pop() ?? 'png'}`}
        alt={current.origin_name}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setScale((s) => (s > 1 ? 1 : 2))
          setOffset({ x: 0, y: 0 })
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        draggable={false}
        style={{
          maxWidth: '90vw',
          maxHeight: '82vh',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: dragRef.current ? 'none' : 'transform .18s ease',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          userSelect: 'none',
          cursor: scale > 1 ? 'grab' : 'zoom-in'
        }}
      />

      {/* 底部缩略图条 */}
      {images.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            padding: '6px 8px',
            background: 'rgba(20,20,28,0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            maxWidth: '80vw',
            overflow: 'auto'
          }}
        >
          {images.map((a, i) => (
            <div
              key={a.id}
              onClick={() => onIndex(i)}
              style={{
                width: 48,
                height: 36,
                borderRadius: 6,
                overflow: 'hidden',
                cursor: 'pointer',
                border: i === index ? '2px solid var(--amber)' : '2px solid transparent',
                opacity: i === index ? 1 : 0.6,
                transition: 'opacity .15s',
                flexShrink: 0
              }}
            >
              <img
                src={`wb://thumb/${a.task_id}/${a.hash}.jpg`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  cursor: 'pointer',
  font: '500 12px var(--font-sans)',
  transition: 'background .15s'
}

const navBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 64,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'rgba(255,255,255,0.85)',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 28,
  lineHeight: 1,
  display: 'grid',
  placeItems: 'center',
  transition: 'background .15s'
}