import { useState } from 'react'
import type { TaskWithStatus, Status } from '../../../shared/types'
import { StatusPicker } from './StatusChip'
import { formatRelative, hexToRgba, nextStatus } from '../utils'

interface Props {
  task: TaskWithStatus
  statuses: Status[]
  selected: boolean
  onSelect: () => void
  onSetStatus: (statusId: number) => void
}

export function TaskItem({ task, statuses, selected, onSelect, onSetStatus }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const current = statuses.find((s) => s.id === task.status_id)
  if (!current) return null

  const nxt = nextStatus(current.id, statuses)
  const color = current.color
  const isClosed = current.is_closed === 1

  return (
    <div
      onClick={onSelect}
      className="rise"
      style={{
        position: 'relative',
        padding: '14px 16px 14px 22px',
        background: selected
          ? 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)'
          : 'transparent',
        borderRadius: 12,
        cursor: 'pointer',
        border: selected ? '1px solid var(--line-2)' : '1px solid transparent',
        transition: 'background .15s, border-color .15s',
        opacity: isClosed ? 0.62 : 1
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: 3,
          borderRadius: 4,
          background: color,
          boxShadow: selected ? `0 0 12px ${hexToRgba(color, 0.6)}` : 'none'
        }}
      />

      <div className="col" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span
            className="serif"
            style={{
              fontSize: 15.5,
              fontWeight: 500,
              lineHeight: 1.35,
              color: 'var(--ink-0)',
              textDecoration: isClosed ? 'line-through' : 'none',
              textDecorationColor: hexToRgba(color, 0.5),
              letterSpacing: '0.005em',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {task.pinned === 1 && (
              <span style={{ marginRight: 6, color: 'var(--amber)', fontSize: 12 }}>◆</span>
            )}
            {task.title}
          </span>
        </div>

        <div className="row" style={{ gap: 10, fontSize: 11, color: 'var(--ink-3)' }}>
          <span className="mono">{formatRelative(task.updated_at)}</span>
          {task.progress_count > 0 && (
            <>
              <span className="dim">·</span>
              <span className="mono"># {task.progress_count}</span>
            </>
          )}
          {task.attachment_count > 0 && (
            <>
              <span className="dim">·</span>
              <span className="mono">@ {task.attachment_count}</span>
            </>
          )}
        </div>

        <div className="row" style={{ gap: 8, marginTop: 2, position: 'relative' }}>
          <span
            onClick={(e) => {
              e.stopPropagation()
              setPickerOpen((v) => !v)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (nxt) onSetStatus(nxt.id)
            }}
            title="单击切换状态 / 双击推进到下一状态"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 999,
              font: '500 11px var(--font-sans)',
              background: hexToRgba(color, 0.16),
              color,
              border: `1px solid ${hexToRgba(color, 0.4)}`,
              cursor: 'pointer'
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 50,
                background: color,
                boxShadow: `0 0 8px ${color}`
              }}
            />
            {current.name}
          </span>

          {nxt && !isClosed && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSetStatus(nxt.id)
              }}
              title={`推进到：${nxt.name}`}
              style={{
                height: 22,
                padding: '0 9px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                font: '500 11px var(--font-sans)',
                color: 'var(--ink-3)',
                background: 'transparent',
                border: '1px dashed var(--line-2)',
                borderRadius: 999,
                cursor: 'pointer',
                transition: 'all .15s'
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.color = nxt.color
                el.style.borderColor = nxt.color
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.color = 'var(--ink-3)'
                el.style.borderColor = 'var(--line-2)'
              }}
            >
              → {nxt.name}
            </button>
          )}

          {pickerOpen && (
            <StatusPicker
              statuses={statuses}
              current={current}
              onPick={(s) => onSetStatus(s.id)}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
