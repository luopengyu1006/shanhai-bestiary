import { useState, useRef, useEffect } from 'react'
import type { Status } from '../../../shared/types'
import { hexToRgba } from '../utils'

interface Props {
  status: Status
  active?: boolean
  size?: 'sm' | 'md'
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  title?: string
}

export function StatusChip({ status, active, size = 'md', onClick, onDoubleClick, title }: Props) {
  const rgba = hexToRgba(status.color, 0.18)
  const border = active ? status.color : 'transparent'
  return (
    <span
      className="chip"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={title}
      style={{
        background: active ? rgba : 'rgba(255,255,255,0.03)',
        borderColor: border,
        color: active ? status.color : 'var(--ink-1)',
        height: size === 'sm' ? 22 : 26,
        padding: size === 'sm' ? '0 8px' : '0 10px',
        fontSize: size === 'sm' ? 11 : 12
      }}
    >
      <span className="dot" style={{ background: status.color, color: status.color }} />
      {status.name}
    </span>
  )
}

interface PickerProps {
  statuses: Status[]
  current: Status
  onPick: (s: Status) => void
  onClose: () => void
  align?: 'left' | 'right'
}

export function StatusPicker({ statuses, current, onPick, onClose, align = 'left' }: PickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', onDoc), 0)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const sorted = [...statuses].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div
      ref={ref}
      className="rise"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        [align]: 0,
        zIndex: 9999,
        // 实色底：--bg-2 是各主题的纯色面板色，保证下拉层不透出下方卡片
        background: 'var(--bg-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 14,
        padding: 6,
        boxShadow:
          '0 0 0 1px rgba(0,0,0,0.5), 0 18px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        minWidth: 200
      }}
    >
      <div style={{ padding: '8px 10px 8px', fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
        切换状态 · 1-9
      </div>
      {sorted.map((s, i) => (
        <button
          key={s.id}
          onClick={() => {
            onPick(s)
            onClose()
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = hexToRgba(s.color, 0.16)
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = s.id === current.id ? hexToRgba(s.color, 0.18) : 'transparent'
          }}
          className="row"
          style={{
            gap: 10,
            padding: '8px 10px',
            background: s.id === current.id ? hexToRgba(s.color, 0.18) : 'transparent',
            border: 'none',
            borderRadius: 8,
            color: 'var(--ink-0)',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            font: '500 13px var(--font-sans)',
            transition: 'background .12s ease'
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 50,
              background: s.color,
              boxShadow: `0 0 10px ${s.color}`
            }}
          />
          <span style={{ flex: 1 }}>{s.name}</span>
          <span className="mono dim" style={{ fontSize: 10 }}>{i < 9 ? i + 1 : '·'}</span>
        </button>
      ))}
    </div>
  )
}
