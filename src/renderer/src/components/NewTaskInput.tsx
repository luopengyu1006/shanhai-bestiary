import { useState, useRef, useEffect } from 'react'
import { loadTasks } from '../store'
import type { TaskWithStatus } from '../../../shared/types'

export function NewTaskInput() {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let depth = 0
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      depth++
      setDragOver(true)
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragOver(false)
    }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      const paths = files
        .map((f: any) => f?.path)
        .filter((p: unknown): p is string => typeof p === 'string' && !!p)
      if (!paths.length) return
      const fallback = value.trim() || `从文件新建 · ${new Date().toLocaleString('zh-CN', { hour12: false })}`
      const t: TaskWithStatus = await window.api.task.create(fallback)
      await window.api.attachment.addByPaths(t.id, paths)
      setValue('')
      await loadTasks()
      inputRef.current?.focus()
    }
    el.addEventListener('dragenter', onOver)
    el.addEventListener('dragleave', onLeave)
    el.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    })
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragenter', onOver)
      el.removeEventListener('dragleave', onLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [value])

  async function submit() {
    const title = value.trim()
    if (!title) return
    const t: TaskWithStatus = await window.api.task.create(title)
    setValue('')
    inputRef.current?.focus()
    const evt = new CustomEvent('task:created', { detail: t })
    window.dispatchEvent(evt)
    await loadTasks()
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        background: 'var(--panel-2)',
        border: `1px solid ${dragOver ? 'rgba(232,168,87,0.6)' : focused ? 'rgba(232,168,87,0.45)' : 'var(--line-2)'}`,
        borderRadius: 14,
        padding: '14px 18px 14px 22px',
        boxShadow: dragOver
          ? '0 0 0 4px rgba(232,168,87,0.18), var(--shadow-2)'
          : focused
          ? '0 0 0 4px rgba(232,168,87,0.10), var(--shadow-2)'
          : 'var(--shadow-1)',
        transition: 'border-color .2s, box-shadow .2s',
        marginBottom: 18
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 14,
          bottom: 14,
          width: 3,
          borderRadius: 4,
          background: 'linear-gradient(180deg, var(--amber) 0%, var(--amber-2) 100%)',
          opacity: focused || dragOver ? 1 : 0.5
        }}
      />
      <input
        className="input"
        placeholder={dragOver ? '松手即新建任务并附带文件' : '记一件事，回车保存…'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        style={{
          font: '500 16px/1.4 var(--font-sans)',
          padding: '4px 0',
          color: 'var(--ink-0)'
        }}
        ref={inputRef}
      />
      <div className="row" style={{ gap: 14, marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>
        <span className="mono">⏎ 新建</span>
        <span className="dim">·</span>
        <span className="mono">⌘K 聚焦</span>
        <span className="dim">·</span>
        <span>记下脑子里冒出来的任何事</span>
      </div>
    </div>
  )
}