import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore, loadTasks } from '../store'
import type { TaskWithStatus, Progress, Attachment } from '../../../shared/types'
import { StatusPicker } from './StatusChip'
import { Lightbox } from './Lightbox'
import { formatDateTime, fileSize, hexToRgba } from '../utils'
import { marked } from 'marked'

interface DetailData {
  task: TaskWithStatus
  progresses: Progress[]
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : 'bin'
}

export function TaskDetail() {
  const selectedId = useStore((s) => s.selectedId)
  const statuses = useStore((s) => s.statuses)
  const [data, setData] = useState<DetailData | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [pastingHint, setToast] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ images: Attachment[]; index: number } | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async (id: number) => {
    const [d, atts] = await Promise.all([
      window.api.task.get(id),
      window.api.attachment.listByTask(id)
    ])
    setData(d as DetailData | null)
    setAttachments(atts)
    if (d) setTitleDraft((d as DetailData).task.title)
  }, [])

  useEffect(() => {
    if (selectedId == null) {
      setData(null)
      setAttachments([])
      return
    }
    setLoading(true)
    refresh(selectedId).then(() => setLoading(false))
  }, [selectedId, refresh])

  // 整页拖拽监听（图片 / 文件）
  useEffect(() => {
    if (!selectedId) return
    const el = dropRef.current
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
      if (paths.length) {
        await window.api.attachment.addByPaths(selectedId, paths)
        await refresh(selectedId)
        await loadTasks()
        setToast(`已添加 ${paths.length} 个文件`)
        setTimeout(() => setToast(null), 1800)
      }
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
  }, [selectedId, refresh])

  // 全局 paste：当焦点不在输入框时，截图直接贴到当前任务
  useEffect(() => {
    if (!selectedId) return
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const items = Array.from(e.clipboardData?.items ?? [])
      const img = items.find((i) => i.type.startsWith('image/'))
      if (!img) return
      const file = img.getAsFile()
      if (!file) return
      e.preventDefault()
      const buf = new Uint8Array(await file.arrayBuffer())
      const name = `pasted-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.png`
      await window.api.attachment.addByBytes(selectedId, name, buf, file.type || 'image/png')
      await refresh(selectedId)
      await loadTasks()
      setToast('已粘贴截图')
      setTimeout(() => setToast(null), 1800)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [selectedId, refresh])

  if (selectedId == null) return <Placeholder />
  if (loading || !data) return <div className="fade" style={{ padding: 40, color: 'var(--ink-3)' }}>加载中…</div>

  const { task, progresses } = data
  const current = statuses.find((s) => s.id === task.status_id)!
  const images = attachments.filter((a) => (a.mime ?? '').startsWith('image/'))

  async function removeAttachment(id: number) {
    await window.api.attachment.remove(id)
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    await loadTasks()
  }

  return (
    <div
      ref={dropRef}
      className="col"
      style={{ position: 'relative', height: '100%', padding: '32px 40px 28px', overflow: 'auto' }}
    >
      {dragOver && <DragOverlay />}
      {pastingHint && (
        <div
          className="fade"
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            background: 'rgba(20,20,28,0.92)',
            border: '1px solid rgba(232,168,87,0.4)',
            borderRadius: 999,
            color: 'var(--amber)',
            font: '500 12px var(--font-sans)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 60
          }}
        >
          ✓ {pastingHint}
        </div>
      )}

      <div className="row mono dim" style={{ gap: 8, fontSize: 10, letterSpacing: '0.16em', marginBottom: 14 }}>
        <span>TASK</span>
        <span>›</span>
        <span style={{ color: current.color }}>{current.name.toUpperCase()}</span>
        <span>›</span>
        <span>#{task.id.toString().padStart(3, '0')}</span>
      </div>

      {editingTitle ? (
        <input
          className="input"
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={async () => {
            setEditingTitle(false)
            if (titleDraft.trim() && titleDraft !== task.title) {
              await window.api.task.rename(task.id, titleDraft.trim())
              await refresh(task.id)
              await loadTasks()
            } else {
              setTitleDraft(task.title)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setTitleDraft(task.title)
              setEditingTitle(false)
            }
          }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 30,
            fontWeight: 500,
            fontStyle: 'italic',
            color: 'var(--ink-0)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            marginBottom: 18,
            outline: 'none',
            border: 'none',
            background: 'transparent',
            width: '100%'
          }}
        />
      ) : (
        <h2
          className="serif"
          onClick={() => setEditingTitle(true)}
          style={{
            margin: '0 0 18px',
            fontSize: 30,
            fontWeight: 500,
            fontStyle: 'italic',
            color: 'var(--ink-0)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            cursor: 'text'
          }}
        >
          {task.title}
        </h2>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 20, position: 'relative' }}>
        <span
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            font: '500 12px var(--font-sans)',
            background: hexToRgba(current.color, 0.18),
            color: current.color,
            border: `1px solid ${hexToRgba(current.color, 0.5)}`,
            cursor: 'pointer'
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 50,
              background: current.color,
              boxShadow: `0 0 10px ${current.color}`
            }}
          />
          {current.name}
          <span className="mono dim" style={{ fontSize: 10 }}>▾</span>
        </span>
        {pickerOpen && (
          <StatusPicker
            statuses={statuses}
            current={current}
            onPick={async (s) => {
              await window.api.task.setStatus(task.id, s.id)
              await refresh(task.id)
              await loadTasks()
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        <span className="mono dim" style={{ fontSize: 11, marginLeft: 6 }}>
          创建于 {formatDateTime(task.created_at)}
        </span>
        {task.closed_at && (
          <>
            <span className="dim">·</span>
            <span className="mono dim" style={{ fontSize: 11 }}>
              结案于 {formatDateTime(task.closed_at)}
            </span>
          </>
        )}
      </div>

      <hr className="hr" style={{ marginBottom: 22 }} />

      <ProgressInput
        value={input}
        onChange={setInput}
        onPickFiles={async () => {
          const inp = document.createElement('input')
          inp.type = 'file'
          inp.multiple = true
          inp.onchange = async () => {
            const files = Array.from(inp.files ?? [])
            for (const f of files) {
              const buf = new Uint8Array(await f.arrayBuffer())
              await window.api.attachment.addByBytes(task.id, f.name, buf, f.type || null)
            }
            await refresh(task.id)
            await loadTasks()
            setToast(`已添加 ${files.length} 个文件`)
            setTimeout(() => setToast(null), 1800)
          }
          inp.click()
        }}
        onPasteImage={async (file) => {
          const buf = new Uint8Array(await file.arrayBuffer())
          const ext = extOf(file.name) || 'png'
          const name = file.name || `pasted-${Date.now()}.${ext}`
          await window.api.attachment.addByBytes(task.id, name, buf, file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`)
          await refresh(task.id)
          await loadTasks()
          setToast('已粘贴截图')
          setTimeout(() => setToast(null), 1800)
        }}
        onSubmit={async () => {
          if (!input.trim()) return
          await window.api.progress.add({ task_id: task.id, content: input })
          setInput('')
          await refresh(task.id)
          await loadTasks()
        }}
      />

      <section style={{ marginTop: 28 }}>
        <SectionTitle title="任务资料" count={attachments.length} />
        {attachments.length === 0 ? (
          <div
            className="col"
            style={{
              marginTop: 12,
              padding: '24px 18px',
              border: '1px dashed var(--line-2)',
              borderRadius: 12,
              alignItems: 'center',
              gap: 6,
              color: 'var(--ink-3)',
              background: 'rgba(255,255,255,0.015)'
            }}
          >
            <span className="mono" style={{ fontSize: 11, letterSpacing: '0.16em' }}>EMPTY</span>
            <span style={{ fontSize: 12 }}>把文件拖到这里，或在输入框粘贴截图</span>
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10
            }}
          >
            {attachments.map((a, i) => {
              const isImg = (a.mime ?? '').startsWith('image/')
              const imgIdx = images.findIndex((x) => x.id === a.id)
              return (
                <AttachmentCard
                  key={a.id}
                  att={a}
                  isImage={isImg}
                  onOpen={() => {
                    if (isImg) setLightbox({ images, index: imgIdx >= 0 ? imgIdx : 0 })
                    else window.api.attachment.open(a.id)
                    setMenuOpenId(null)
                  }}
                  menuOpen={menuOpenId === a.id}
                  onToggleMenu={(e) => {
                    e.stopPropagation()
                    setMenuOpenId(menuOpenId === a.id ? null : a.id)
                  }}
                  onReveal={() => {
                    window.api.attachment.reveal(a.id)
                    setMenuOpenId(null)
                  }}
                  onRemove={async () => {
                    await removeAttachment(a.id)
                    setMenuOpenId(null)
                  }}
                />
              )
            })}
          </div>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <SectionTitle title="处理记录" count={progresses.length} />
        <div className="col" style={{ gap: 14, marginTop: 14 }}>
          {progresses.length === 0 && (
            <div className="muted" style={{ fontSize: 13, padding: '12px 0' }}>
              还没有记录。在上方输入框写下第一条进展，或拖入文件。
            </div>
          )}
          {progresses.map((p) => (
            <TimelineItem key={p.id} p={p} />
          ))}
        </div>
      </section>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) => setLightbox({ images: lightbox.images, index: i })}
        />
      )}
    </div>
  )
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
      <span className="serif" style={{ fontSize: 16, fontStyle: 'italic', color: 'var(--ink-0)', letterSpacing: '0.01em' }}>
        {title}
      </span>
      {count != null && (
        <span className="mono dim" style={{ fontSize: 11 }}>
          {count}
        </span>
      )}
      <div
        style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, var(--line-2) 0%, transparent 100%)',
          marginLeft: 8
        }}
      />
    </div>
  )
}

function ProgressInput({
  value,
  onChange,
  onPickFiles,
  onPasteImage,
  onSubmit
}: {
  value: string
  onChange: (v: string) => void
  onPickFiles: () => void
  onPasteImage: (file: File) => void
  onSubmit: () => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div
      style={{
        border: `1px solid ${focused ? 'rgba(155,127,230,0.45)' : 'var(--line-2)'}`,
        borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, transparent 100%)',
        padding: '14px 16px 12px',
        transition: 'border-color .2s, box-shadow .2s',
        boxShadow: focused ? '0 0 0 4px rgba(155,127,230,0.08)' : 'none'
      }}
    >
      <textarea
        className="textarea"
        placeholder="写下这一步做了什么…   支持 Markdown · Ctrl+Enter 保存 · 可粘贴截图"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={async (e) => {
          const items = Array.from(e.clipboardData.items)
          const img = items.find((i) => i.type.startsWith('image/'))
          if (img) {
            const file = img.getAsFile()
            if (file) {
              e.preventDefault()
              onPasteImage(file)
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onSubmit()
          }
        }}
        style={{ width: '100%', minHeight: 60, font: '14px/1.6 var(--font-sans)', color: 'var(--ink-0)', outline: 'none', border: 'none', background: 'transparent', resize: 'none' }}
      />
      <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost" onClick={onPickFiles} style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
            + 附件
          </button>
          <span className="dim" style={{ fontSize: 11, alignSelf: 'center' }}>
            也可直接拖拽文件到本输入框
          </span>
        </div>
        <button className="btn primary" onClick={onSubmit} style={{ height: 28, padding: '0 14px', fontSize: 12 }}>
          保存 <span className="mono" style={{ fontSize: 10, color: 'var(--primary-fg)', opacity: 0.65 }}>Ctrl+Enter</span>
        </button>
      </div>
    </div>
  )
}

function TimelineItem({ p }: { p: Progress }) {
  const html = (marked.parse(p.content || '', { async: false }) as string) || ''
  return (
    <div className="col slide" style={{ position: 'relative', paddingLeft: 22 }}>
      <div style={{ position: 'absolute', left: 5, top: 8, bottom: -14, width: 1, background: 'var(--line)' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 6,
          width: 11,
          height: 11,
          borderRadius: 50,
          background: 'var(--bg-1)',
          border: '2px solid var(--violet)',
          boxShadow: '0 0 10px rgba(155,127,230,0.4)'
        }}
      />
      <div className="row mono dim" style={{ fontSize: 10, letterSpacing: '0.1em', marginBottom: 4 }}>
        {formatDateTime(p.created_at)}
      </div>
      <div
        className="col"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: 'var(--ink-1)',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          cursor: 'text'
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function AttachmentCard({
  att,
  isImage,
  onOpen,
  menuOpen,
  onToggleMenu,
  onReveal,
  onRemove
}: {
  att: Attachment
  isImage: boolean
  onOpen: () => void
  menuOpen: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  onReveal: () => void
  onRemove: () => void
}) {
  const ext = extOf(att.origin_name)
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
      }}
      onClick={onOpen}
      style={{
        position: 'relative',
        aspectRatio: '1.4 / 1',
        background: 'var(--bg-2)',
        border: `1px solid ${hover ? 'var(--line-2)' : 'var(--line)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: hover ? '0 6px 22px rgba(0,0,0,0.4)' : 'none'
      }}
      title={att.origin_name}
    >
      {isImage ? (
        <>
          <img
            src={`wb://thumb/${att.task_id}/${att.hash}.jpg`}
            alt={att.origin_name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {hover && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '14px 10px 6px',
                background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.78) 100%)',
                color: 'rgba(255,255,255,0.92)',
                fontSize: 11,
                lineHeight: 1.4
              }}
            >
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500
                }}
              >
                {att.origin_name}
              </div>
              <div className="mono" style={{ opacity: 0.6, fontSize: 10 }}>
                {fileSize(att.size)}
              </div>
            </div>
          )}
        </>
      ) : (
        <DocAttachmentCard att={att} ext={ext} />
      )}

      {/* 右上角 ·· 菜单 */}
      {hover && (
        <button
          onClick={onToggleMenu}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: 6,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            display: 'grid',
            placeItems: 'center',
            backdropFilter: 'blur(6px)'
          }}
          title="更多"
        >
          ⋯
        </button>
      )}

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 160,
            background: 'var(--panel-1)',
            border: '1px solid var(--line-2)',
            borderRadius: 10,
            padding: 4,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            zIndex: 30,
            textAlign: 'left'
          }}
        >
          <MenuItem label="在系统中打开" onClick={onOpen} />
          <MenuItem label="打开所在文件夹" onClick={onReveal} />
          <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
          <MenuItem label="删除" danger onClick={onRemove} />
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        color: danger ? 'var(--rose, #E6788E)' : 'var(--ink-0)',
        font: '500 12px var(--font-sans)',
        textAlign: 'left',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      {label}
    </button>
  )
}

function DragOverlay() {
  return (
    <div
      className="fade"
      style={{
        position: 'absolute',
        inset: 12,
        border: '2px dashed rgba(232,168,87,0.6)',
        borderRadius: 16,
        background: 'rgba(232,168,87,0.06)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        pointerEvents: 'none'
      }}
    >
      <div
        className="serif"
        style={{
          fontSize: 26,
          fontStyle: 'italic',
          color: 'var(--amber)',
          background: 'linear-gradient(180deg, var(--amber) 0%, #C6883F 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        松手即可添加到这条任务
      </div>
    </div>
  )
}

function Placeholder() {
  return (
    <div
      className="col"
      style={{ height: '100%', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-3)' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 48,
          fontStyle: 'italic',
          opacity: 0.4,
          background: 'linear-gradient(180deg, var(--ink-1) 0%, transparent 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        ⌘
      </div>
      <div style={{ fontSize: 12, letterSpacing: '0.04em' }}>选一条任务开始，或在左侧新建一条</div>
    </div>
  )
}

/* =================== 文档/通用附件卡片 =================== */

function docAccent(ext: string): { color: string; bg: string; ring: string; label: string } {
  const e = ext.toUpperCase()
  // 常见文档类型用对应的"现代商务配色"
  if (e === 'PDF')  return { color: '#F26B6B', bg: 'rgba(242,107,107,0.14)',  ring: 'rgba(242,107,107,0.45)',  label: 'PDF'  }
  if (e === 'DOC' || e === 'DOCX') return { color: '#9B7FE6', bg: 'rgba(155,127,230,0.16)', ring: 'rgba(155,127,230,0.45)', label: 'DOCX' }
  if (e === 'XLS' || e === 'XLSX') return { color: '#22C55E', bg: 'rgba(34,197,94,0.14)',   ring: 'rgba(34,197,94,0.45)',   label: 'XLSX' }
  if (e === 'PPT' || e === 'PPTX') return { color: '#F97316', bg: 'rgba(249,115,22,0.14)',  ring: 'rgba(249,115,22,0.45)',  label: 'PPTX' }
  if (e === 'ZIP' || e === 'RAR' || e === '7Z') return { color: '#E8A857', bg: 'rgba(232,168,87,0.14)', ring: 'rgba(232,168,87,0.45)', label: e }
  else if (e === 'MD' || e === 'TXT' || e === 'LOG') return { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', ring: 'rgba(148,163,184,0.40)', label: e }
  return { color: '#5BB9B0', bg: 'rgba(91,185,176,0.12)', ring: 'rgba(91,185,176,0.45)', label: e }
}

function DocAttachmentCard({ att, ext }: { att: Attachment; ext: string }) {
  const accent = docAccent(ext)
  // 取文件主名（去后缀），用以在徽章下方展示更醒目的标题
  const dotIdx = att.origin_name.lastIndexOf('.')
  const baseName = dotIdx > 0 ? att.origin_name.slice(0, dotIdx) : att.origin_name
  const subExt = dotIdx > 0 ? att.origin_name.slice(dotIdx + 1).toLowerCase() : ''
  return (
    <div
      className="col"
      style={{
        position: 'absolute',
        inset: 0,
        padding: '12px 12px 0',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 60%)'
      }}
    >
      {/* 顶部：扩展名徽章（按文档类型上色） */}
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 22,
            padding: '0 8px',
            borderRadius: 999,
            background: accent.bg,
            border: `1px solid ${accent.ring}`,
            color: accent.color,
            font: '600 10px var(--font-mono)',
            letterSpacing: '0.08em'
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: accent.color,
              boxShadow: `0 0 6px ${accent.color}`
            }}
          />
          {accent.label}
        </div>
        <span className="dim mono" style={{ fontSize: 10, marginLeft: 'auto' }}>
          {subExt ? `.${subExt}` : 'FILE'}
        </span>
      </div>

      {/* 中部：文件主名（双行截断，留白更舒展） */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 2px'
        }}
      >
        <div
          style={{
            font: '500 13px/1.4 var(--font-sans)',
            color: 'var(--ink-0)',
            textAlign: 'center',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-all'
          }}
        >
          {baseName}
        </div>
      </div>

      {/* 底部：大小 + 强调色彩条 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0 0',
          borderTop: `1px solid var(--line)`,
          marginTop: 4
        }}
      >
        <span className="dim mono" style={{ fontSize: 10 }}>
          {fileSize(att.size)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>点击打开</span>
      </div>
      {/* 彩条（与设计语言一致的"印章/矿物"色） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent.color} 0%, transparent 80%)`
        }}
      />
    </div>
  )
}
