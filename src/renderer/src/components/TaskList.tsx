import { useStore, loadTasks } from '../store'
import type { Status, TaskWithStatus } from '../../../shared/types'
import { TaskItem } from './TaskItem'
import { hexToRgba } from '../utils'
import { useEffect, useMemo, useState } from 'react'

export function TaskList() {
  const tasks = useStore((s) => s.tasks)
  const statuses = useStore((s) => s.statuses)
  const selectedId = useStore((s) => s.selectedId)
  const setSelected = useStore((s) => s.setSelected)
  const loading = useStore((s) => s.loading)
  const filterStatusIds = useStore((s) => s.filterStatusIds)

  const hasFilter = filterStatusIds.size > 0
  const groups = useMemo(() => groupTasks(tasks, statuses), [tasks, statuses])

  // 当 filter 切换时，未选中分组默认折叠；用户可手动展开
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  useEffect(() => {
    setExpanded(new Set())
  }, [filterStatusIds])

  useEffect(() => {
    return window.api.onTaskChanged(() => loadTasks())
  }, [])

  async function onSetStatus(taskId: number, statusId: number) {
    await window.api.task.setStatus(taskId, statusId)
  }

  if (loading) {
    return (
      <div className="col" style={{ padding: 40, alignItems: 'center', gap: 10, color: 'var(--ink-3)' }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.16em' }}>LOADING</div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="col" style={{ gap: 22 }}>
      {groups.map((g, gIdx) => {
        const isFilterActive = filterStatusIds.has(g.status.id)
        const collapsed = hasFilter && !expanded.has(g.status.id) && !isFilterActive
        return (
        <section
          key={g.status.id}
          className="col"
          style={{
            gap: 8,
            padding: gIdx > 0 ? '14px 0 0' : '0',
            borderTop: gIdx > 0 ? '1px dashed var(--line-2)' : 'none'
          }}
        >
          <header
            onClick={() => {
              if (collapsed) {
                setExpanded((s) => {
                  const next = new Set(s)
                  next.add(g.status.id)
                  return next
                })
              } else if (hasFilter) {
                setExpanded((s) => {
                  const next = new Set(s)
                  next.delete(g.status.id)
                  return next
                })
              }
            }}
            style={{
              cursor: hasFilter ? 'pointer' : 'default',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '4px 8px',
              borderRadius: 8,
              fontSize: 10,
              letterSpacing: '0.18em',
              color: isFilterActive ? g.status.color : 'var(--ink-3)',
              textTransform: 'uppercase',
              userSelect: 'none',
              background: isFilterActive ? hexToRgba(g.status.color, 0.08) : 'transparent',
              border: isFilterActive ? `1px solid ${hexToRgba(g.status.color, 0.35)}` : '1px solid transparent',
              transition: 'background .15s, border-color .15s, color .15s'
            }}
          >
            {hasFilter && (
              <span
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: `4px solid var(--ink-3)`,
                  borderTop: `4px solid transparent`,
                  borderBottom: `4px solid transparent`,
                  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform .15s',
                  opacity: 0.6
                }}
              />
            )}
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 50,
                background: g.status.color,
                boxShadow: isFilterActive ? `0 0 10px ${g.status.color}` : `0 0 8px ${g.status.color}`
              }}
            />
            <span className="mono" style={{ fontWeight: isFilterActive ? 700 : 600, color: isFilterActive ? g.status.color : 'var(--ink-3)' }}>
              {g.status.name}
            </span>
            <span className="dim">·</span>
            <span className="mono">{g.tasks.length}</span>
          </header>
          {!collapsed && (
            <div className="col" style={{ gap: 8 }}>
              {g.tasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  statuses={statuses}
                  selected={t.id === selectedId}
                  onSelect={() => setSelected(t.id)}
                  onSetStatus={(sid) => onSetStatus(t.id, sid)}
                />
              ))}
            </div>
          )}
        </section>
        )
      })}
    </div>
  )
}

interface Group {
  status: Status
  tasks: TaskWithStatus[]
}

function groupTasks(tasks: TaskWithStatus[], statuses: Status[]): Group[] {
  const map = new Map<number, Group>()
  for (const s of statuses) map.set(s.id, { status: s, tasks: [] })
  for (const t of tasks) {
    const g = map.get(t.status_id)
    if (g) g.tasks.push(t)
  }
  const list = Array.from(map.values()).filter((g) => g.tasks.length > 0)
  // pinned 提到每个分组的头部
  for (const g of list) {
    g.tasks.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned - a.pinned
      return b.updated_at.localeCompare(a.updated_at)
    })
  }
  return list
}

function EmptyState() {
  return (
    <div
      className="col"
      style={{
        alignItems: 'center',
        padding: '60px 20px',
        gap: 18,
        color: 'var(--ink-2)',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 38,
          fontWeight: 500,
          fontStyle: 'italic',
          color: 'var(--ink-1)',
          letterSpacing: '-0.01em',
          background: 'linear-gradient(180deg, var(--amber) 0%, #7A5A2F 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        从一件事开始。
      </div>
      <div className="muted" style={{ maxWidth: 280, fontSize: 13, lineHeight: 1.7 }}>
        在上方输入框敲下脑子里冒出的第一件事，回车保存。<br />状态、进度、附件，等你再来填。
      </div>
    </div>
  )
}
