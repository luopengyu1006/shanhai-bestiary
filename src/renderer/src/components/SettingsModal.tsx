import { useEffect, useState, useRef } from 'react'
import { useStore, loadStatuses, loadTasks } from '../store'
import type { Status, Preferences, ThemeId } from '../../../shared/types'
import { hexToRgba, fileSize } from '../utils'
import { useShortcutCapture } from '../utils/shortcut'
import { THEMES } from '../theme'

type Tab = 'status' | 'prefs' | 'data'

const PALETTE = [
  '#94A3B8', '#64748B', '#6B7280',
  '#F59E0B', '#EAB308', '#F97316', '#E8A857',
  '#3B82F6', '#06B6D4', '#0EA5E9', '#5BB9B0',
  '#8B5CF6', '#9B7FE6', '#A78BFA',
  '#22C55E', '#10B981', '#84CC16',
  '#EF4444', '#E6788E', '#F472B6'
]

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen)
  const close = useStore((s) => s.closeSettings)
  const [tab, setTab] = useState<Tab>('status')
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (open) window.api.app.version().then(setVersion)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div
      className="fade"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--scrim)',
        backdropFilter: 'blur(10px)',
        zIndex: 150,
        display: 'grid',
        placeItems: 'center',
        padding: 40
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rise"
        style={{
          width: 'min(820px, 100%)',
          maxHeight: 'calc(100vh - 80px)',
          height: 'min(680px, calc(100vh - 80px))',
          background: 'var(--panel-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 16,
          boxShadow: '0 40px 100px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gridTemplateRows: '100%',
          minHeight: 0
        }}
      >
        {/* 左侧导航 */}
        <aside
          style={{
            padding: '20px 14px',
            borderRight: '1px solid var(--line)',
            background: 'rgba(255,255,255,0.012)',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            className="serif"
            style={{
              padding: '0 12px 16px',
              fontSize: 18,
              fontStyle: 'italic',
              color: 'var(--ink-0)',
              letterSpacing: '-0.01em'
            }}
          >
            <span style={{ background: 'linear-gradient(180deg, var(--amber) 0%, var(--amber-2) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>设置</span>
          </div>
          <nav className="col" style={{ gap: 2 }}>
            <NavItem icon="◆" label="状态" active={tab === 'status'} onClick={() => setTab('status')} />
            <NavItem icon="◇" label="偏好" active={tab === 'prefs'} onClick={() => setTab('prefs')} />
            <NavItem icon="◈" label="数据" active={tab === 'data'} onClick={() => setTab('data')} />
          </nav>
          <div style={{ flex: 1 }} />
          <div
            className="mono dim"
            style={{
              padding: '0 12px',
              fontSize: 10,
              letterSpacing: '0.18em',
              borderTop: '1px solid var(--line)',
              paddingTop: 12,
              color: 'var(--ink-3)'
            }}
          >
            WORKBUDDY · v{version || '0.1'}
          </div>
        </aside>

        {/* 右侧内容 */}
        <section
          style={{
            position: 'relative',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 顶栏关闭 */}
          <button
            onClick={close}
            title="关闭 (Esc)"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--ink-1)',
              cursor: 'pointer',
              fontSize: 14,
              zIndex: 2
            }}
          >
            ✕
          </button>

          {tab === 'status' && <StatusPanel />}
          {tab === 'prefs' && <PreferencesPanel />}
          {tab === 'data' && <DataPanel />}
        </section>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: active ? 'rgba(232,168,87,0.10)' : 'transparent',
        border: 'none',
        borderLeft: `2px solid ${active ? 'var(--amber)' : 'transparent'}`,
        color: active ? 'var(--ink-0)' : 'var(--ink-2)',
        font: '500 13px var(--font-sans)',
        cursor: 'pointer',
        borderRadius: 8,
        textAlign: 'left',
        transition: 'background .12s, color .12s'
      }}
    >
      <span style={{ color: active ? 'var(--amber)' : 'var(--ink-3)', fontSize: 14 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

/* =================== 状态面板 =================== */

function StatusPanel() {
  const statuses = useStore((s) => s.statuses)
  const [items, setItems] = useState<Status[]>([])
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [pickingColorId, setPickingColorId] = useState<number | null>(null)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [migrating, setMigrating] = useState<Status | null>(null)
  const [counts, setCounts] = useState<Record<number, number>>({})
  const newInputRef = useRef<HTMLInputElement>(null)
  const colorBtnRefs = useRef<Record<number, HTMLButtonElement | null>>({})

  useEffect(() => {
    setItems([...statuses].sort((a, b) => a.sort_order - b.sort_order))
    window.api.task.list({ includeArchived: true }).then((tasks) => {
      const map: Record<number, number> = {}
      for (const t of tasks) map[t.status_id] = (map[t.status_id] ?? 0) + 1
      setCounts(map)
    })
    setTimeout(() => newInputRef.current?.focus(), 50)
  }, [statuses])

  // 关闭色板弹层：点击外部或按 Esc
  useEffect(() => {
    if (pickingColorId == null) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-color-picker]')) return
      if (target.closest('[data-color-trigger]')) return
      setPickingColorId(null)
      setPickerPos(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPickingColorId(null)
        setPickerPos(null)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [pickingColorId])

  async function persist(next: Status[]) {
    setItems(next)
    await window.api.status.reorder(next.map((s) => s.id))
    await loadStatuses()
    await loadTasks()
  }
  async function update(id: number, patch: Partial<Status>) {
    await window.api.status.update(id, patch)
    const next = items.map((s) => (s.id === id ? { ...s, ...patch } : s))
    setItems(next)
    await loadStatuses()
  }
  async function create() {
    const name = newName.trim()
    if (!name) return
    const s = await window.api.status.create({ name, color: PALETTE[Math.floor(Math.random() * PALETTE.length)] })
    setNewName('')
    setItems([...items, s].sort((a, b) => a.sort_order - b.sort_order))
    await loadStatuses()
    newInputRef.current?.focus()
  }
  async function remove(target: Status) {
    const count = counts[target.id] ?? 0
    if (count > 0) {
      setMigrating(target)
      return
    }
    if (!confirm(`确定要删除状态「${target.name}」吗？`)) return
    await window.api.status.remove(target.id)
    setItems(items.filter((s) => s.id !== target.id))
    await loadStatuses()
    await loadTasks()
  }
  async function removeWithMigrate(target: Status, migrateTo: number) {
    await window.api.status.remove(target.id, migrateTo)
    setMigrating(null)
    setItems(items.filter((s) => s.id !== target.id))
    await loadStatuses()
    await loadTasks()
  }

  const onDragStart = (id: number) => (e: React.DragEvent) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }
  const onDragOver = (id: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (draggingId && draggingId !== id) setOverId(id)
  }
  const onDrop = (id: number) => async (e: React.DragEvent) => {
    e.preventDefault()
    const from = draggingId
    setDraggingId(null)
    setOverId(null)
    if (from == null || from === id) return
    const next = items.slice()
    const fromIdx = next.findIndex((s) => s.id === from)
    const toIdx = next.findIndex((s) => s.id === id)
    if (fromIdx === -1 || toIdx === -1) return
    const [m] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, m)
    await persist(next)
  }

  const maxCount = Math.max(1, ...Object.values(counts))

  return (
    <div
      className="col"
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <PanelHeader title="状态" subtitle="拖动排序 · 点击色块换色 · 点文字改名" />
      </div>
      <div
        className="col"
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: 'calc(100vh - 280px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '14px 22px 18px',
          gap: 6
        }}
      >
        {items.map((s) => {
          const count = counts[s.id] ?? 0
          const isDragging = draggingId === s.id
          const isOver = overId === s.id
          return (
            <div
              key={s.id}
              draggable={editingId !== s.id}
              onDragStart={onDragStart(s.id)}
              onDragOver={onDragOver(s.id)}
              onDragLeave={() => setOverId(null)}
              onDrop={onDrop(s.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 32px 1fr auto auto',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                border: `1px solid ${isOver ? 'var(--amber)' : 'var(--line)'}`,
                borderRadius: 10,
                background: isDragging ? 'rgba(255,255,255,0.04)' : 'transparent',
                transition: 'background .12s, border-color .12s, opacity .12s',
                opacity: isDragging ? 0.5 : 1
              }}
            >
              <span style={{ color: 'var(--ink-3)', fontSize: 14, cursor: 'grab', textAlign: 'center' }} title="拖动排序">⋮⋮</span>
              <button
                ref={(el) => { colorBtnRefs.current[s.id] = el }}
                data-color-trigger
                onClick={() => {
                  if (pickingColorId === s.id) {
                    setPickingColorId(null)
                    return
                  }
                  const rect = colorBtnRefs.current[s.id]?.getBoundingClientRect()
                  if (rect) {
                    setPickerPos({ top: rect.bottom + 6, left: rect.left })
                  }
                  setPickingColorId(s.id)
                }}
                style={{
                  position: 'relative',
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: s.color,
                  border: '1px solid rgba(0,0,0,0.3)',
                  boxShadow: `0 0 0 1px ${hexToRgba(s.color, 0.25)}, 0 0 14px ${hexToRgba(s.color, 0.35)}`,
                  cursor: 'pointer'
                }}
                title="点击换色"
              />
              <div className="col" style={{ gap: 2, minWidth: 0 }}>
                {editingId === s.id ? (
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={async () => {
                      setEditingId(null)
                      const v = nameDraft.trim()
                      if (v && v !== s.name) await update(s.id, { name: v })
                      else setNameDraft(s.name)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                      if (e.key === 'Escape') { setNameDraft(s.name); setEditingId(null) }
                    }}
                    style={{
                      font: '500 14px var(--font-sans)',
                      color: 'var(--ink-0)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--amber)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <span
                    onClick={() => { setEditingId(s.id); setNameDraft(s.name) }}
                    style={{ font: '500 14px var(--font-sans)', color: 'var(--ink-0)', cursor: 'text', padding: '4px 0' }}
                  >
                    {s.name}
                  </span>
                )}
                <span className="mono dim" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {count} 个任务
                  <span style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(count / maxCount) * 100}%`, background: s.color, opacity: 0.7 }} />
                  </span>
                </span>
              </div>
              <button
                onClick={async () => update(s.id, { is_closed: s.is_closed ? 0 : 1 })}
                title={s.is_closed ? '取消结束态' : '标记为结束态'}
                style={{
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 999,
                  background: s.is_closed ? 'rgba(34,197,94,0.15)' : 'transparent',
                  border: `1px solid ${s.is_closed ? 'rgba(34,197,94,0.5)' : 'var(--line)'}`,
                  color: s.is_closed ? '#7FE2A0' : 'var(--ink-3)',
                  font: '500 11px var(--font-mono)',
                  letterSpacing: '0.06em',
                  cursor: 'pointer'
                }}
              >
                {s.is_closed ? '● END' : '○ END'}
              </button>
              <button
                onClick={() => remove(s)}
                title="删除"
                style={{
                  width: 26, height: 26, borderRadius: 6, background: 'transparent',
                  border: '1px solid var(--line)', color: 'var(--ink-3)',
                  cursor: 'pointer', fontSize: 13
                }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#E6788E'; el.style.borderColor = 'rgba(230,120,142,0.4)' }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--ink-3)'; el.style.borderColor = 'var(--line)' }}
              >
                ✕
              </button>
            </div>
          )
        })}
        {items.length === 0 && (
          <div className="muted" style={{ textAlign: 'center', padding: 20, fontSize: 12 }}>还没有任何状态。</div>
        )}
      </div>
      <div
        className="row"
        style={{
          flexShrink: 0,
          padding: '12px 22px 16px',
          borderTop: '1px solid var(--line)',
          gap: 8,
          background: 'rgba(255,255,255,0.015)'
        }}
      >
        <input
          ref={newInputRef}
          className="input"
          placeholder="新建状态名（回车保存）"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create() }}
          style={{
            flex: 1, height: 34, padding: '0 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--line-2)', borderRadius: 8,
            color: 'var(--ink-0)', font: '500 13px var(--font-sans)', outline: 'none'
          }}
        />
        <button onClick={create} className="btn primary" style={{ height: 34 }}>+ 新建</button>
      </div>
      {pickingColorId != null && pickerPos && (
        <div
          data-color-picker
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: pickerPos.top,
            left: pickerPos.left,
            zIndex: 220,
            background: 'rgba(20,20,28,0.98)',
            border: '1px solid var(--line-2)',
            borderRadius: 10,
            padding: 8,
            boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 22px)',
            gap: 6
          }}
        >
          {PALETTE.map((c) => {
            const current = items.find((x) => x.id === pickingColorId)
            return (
              <button
                key={c}
                onClick={async () => {
                  await update(pickingColorId, { color: c })
                  setPickingColorId(null)
                  setPickerPos(null)
                }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: c,
                  border: current && c === current.color ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                  cursor: 'pointer'
                }}
              />
            )
          })}
          <label
            title="自定义颜色"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: '1px dashed var(--line-2)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              color: 'var(--ink-2)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            +
            <input
              type="color"
              defaultValue={items.find((x) => x.id === pickingColorId)?.color || '#E8A857'}
              onChange={async (e) => {
                await update(pickingColorId, { color: e.target.value })
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
            />
          </label>
        </div>
      )}
      {migrating && (
        <div className="fade" onClick={() => setMigrating(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'grid', placeItems: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} className="rise" style={{ width: 420, padding: '20px 22px', background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 14, boxShadow: 'var(--shadow-2)' }}>
            <div className="serif" style={{ fontSize: 18, fontStyle: 'italic', color: 'var(--ink-0)', marginBottom: 8 }}>
              删除「{migrating.name}」
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.7 }}>
              该状态有 <b style={{ color: 'var(--amber)' }}>{counts[migrating.id] ?? 0}</b> 个任务正在使用。请指定它们要迁移到的状态：
            </div>
            <div className="col" style={{ gap: 4, maxHeight: 220, overflow: 'auto' }}>
              {items.filter((x) => x.id !== migrating.id).map((x) => (
                <button key={x.id} onClick={() => removeWithMigrate(migrating, x.id)} className="row" style={{ gap: 10, padding: '8px 10px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink-0)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 50, background: x.color, boxShadow: `0 0 8px ${x.color}` }} />
                  {x.name}
                </button>
              ))}
            </div>
            <button onClick={() => setMigrating(null)} className="btn ghost" style={{ marginTop: 14, width: '100%' }}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* =================== 偏好面板 =================== */

function PreferencesPanel() {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [autoStartEnabled, setAutoStartEnabled] = useState(false)
  const cap = useShortcutCapture()

  useEffect(() => {
    window.api.prefs.get().then((p) => {
      setPrefs(p)
    })
  }, [])

  if (!prefs) return <div className="muted fade" style={{ padding: 30 }}>加载中…</div>

  async function update(patch: Partial<Preferences>) {
    const next = await window.api.prefs.set(patch)
    setPrefs(next)
  }

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <PanelHeader title="偏好" subtitle="外观、开机自启、关闭行为、全局快捷键" />
      <div className="col" style={{ flex: 1, overflow: 'auto', padding: '14px 22px', gap: 14 }}>
        <Card title="外观">
          <ThemePicker
            value={prefs.theme}
            onChange={(v) => update({ theme: v })}
          />
        </Card>

        <Card title="开机自启">
          <SettingRow
            label="开机自动启动 山海簿"
            description="登录 Windows 后在后台运行，可随时从托盘打开。"
            checked={prefs.autoStart}
            onChange={(v) => update({ autoStart: v })}
          />
          <SettingRow
            label="启动时最小化到托盘"
            description="勾选后开机不显示主窗口，只在托盘常驻。"
            checked={prefs.startMinimized}
            disabled={!prefs.autoStart}
            onChange={(v) => update({ startMinimized: v })}
          />
        </Card>

        <Card title="关闭行为">
          <SettingRow
            label="关闭窗口时释放内存（托盘常驻）"
            description="关闭主窗口时彻底释放渲染进程，按 Ctrl+Alt+N 或单击托盘重新唤起（约 1～2 秒）。关闭此选项后，关闭窗口会直接退出山海簿。"
            checked={prefs.closeToTray}
            onChange={(v) => update({ closeToTray: v })}
          />
        </Card>

        <Card title="全局快捷键">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ font: '500 13px var(--font-sans)', color: 'var(--ink-0)' }}>唤起速记窗</span>
              <span className="dim" style={{ fontSize: 11 }}>任意界面按下，快速记录一件事。</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div
                style={{
                  font: '500 13px var(--font-mono)',
                  color: cap.capturing ? 'var(--amber)' : 'var(--ink-0)',
                  background: cap.capturing ? 'rgba(232,168,87,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${cap.capturing ? 'rgba(232,168,87,0.4)' : 'var(--line-2)'}`,
                  padding: '6px 12px',
                  borderRadius: 8,
                  letterSpacing: '0.04em',
                  minWidth: 140,
                  textAlign: 'center'
                }}
              >
                {cap.capturing ? '按下任意组合键…' : formatShortcut(prefs.quickNoteShortcut)}
              </div>
              <button onClick={cap.start} className="btn ghost" style={{ height: 32 }}>
                改键
              </button>
              {cap.capturing && (
                <button onClick={cap.cancel} className="btn ghost" style={{ height: 32 }}>取消</button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function formatShortcut(s: string): string {
  return s
    .replace(/CommandOrControl/gi, 'Ctrl')
    .replace(/\bAlt\b/g, 'Alt')
    .replace(/\bShift\b/g, 'Shift')
    .split('+')
    .join(' + ')
}

function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (v: ThemeId) => void }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 10,
        padding: 12
      }}
    >
      {THEMES.map((t) => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              position: 'relative',
              padding: 0,
              borderRadius: 10,
              border: `1px solid ${active ? 'var(--amber)' : 'var(--line-2)'}`,
              background: t.sample.bg,
              cursor: 'pointer',
              overflow: 'hidden',
              textAlign: 'left',
              boxShadow: active ? '0 0 0 3px rgba(232,168,87,0.18)' : 'none',
              transition: 'border-color .15s, box-shadow .15s'
            }}
          >
            {/* 缩略预览：用渐变 + 一根代表行的分割线 */}
            <div
              style={{
                height: 64,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: t.sample.accent,
                    boxShadow: `0 0 8px ${t.sample.accent}`
                  }}
                />
                <span
                  style={{
                    font: '500 11px var(--font-mono)',
                    letterSpacing: '0.06em',
                    color: t.sample.fg,
                    opacity: 0.85
                  }}
                >
                  Aa
                </span>
              </div>
              <div
                style={{
                  height: 1,
                  background: t.sample.fg,
                  opacity: 0.25
                }}
              />
            </div>
            {/* 名称栏 */}
            <div
              style={{
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-2)',
                borderTop: '1px solid var(--line-2)'
              }}
            >
              <span
                style={{
                  font: '500 13px var(--font-sans)',
                  color: 'var(--ink-0)'
                }}
              >
                {t.name}
              </span>
              {active && (
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: 'var(--amber)',
                    color: '#1A1206',
                    fontSize: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                >
                  ✓
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.012)'
      }}
    >
      <div
        className="mono dim"
        style={{
          padding: '10px 14px',
          fontSize: 10,
          letterSpacing: '0.18em',
          borderBottom: '1px solid var(--line)',
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        {title.toUpperCase()}
      </div>
      <div className="col" style={{ padding: '6px 4px', gap: 0 }}>
        {children}
      </div>
    </div>
  )
}

function SettingRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        padding: '10px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        borderRadius: 8,
        transition: 'background .12s'
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      <div className="col" style={{ gap: 2 }}>
        <span style={{ font: '500 13px var(--font-sans)', color: 'var(--ink-0)' }}>{label}</span>
        <span className="dim" style={{ fontSize: 11 }}>{description}</span>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </label>
  )
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: checked ? 'var(--amber)' : 'rgba(255,255,255,0.08)',
        border: '1px solid',
        borderColor: checked ? 'var(--amber-2)' : 'var(--line-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background .15s, border-color .15s',
        flexShrink: 0
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: checked ? 17 : 1,
          width: 16,
          height: 16,
          borderRadius: 50,
          background: checked ? '#1A1206' : 'var(--ink-1)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          transition: 'left .15s, background .15s'
        }}
      />
    </button>
  )
}

/* =================== 数据面板 =================== */

function DataPanel() {
  const [backupState, setBackupState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [lastBackup, setLastBackup] = useState<{ path: string; size: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [importState, setImportState] = useState<'idle' | 'busy' | 'done' | 'needRestart'>('idle')
  const [importInfo, setImportInfo] = useState<{ tasks: number; attachments: number; backup: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function doBackup() {
    setError(null)
    setBackupState('busy')
    try {
      const r = await window.api.app.exportBackup()
      if (r) {
        setLastBackup(r)
        setBackupState('done')
        setTimeout(() => setBackupState('idle'), 2000)
      } else {
        setBackupState('idle')
      }
    } catch (e: any) {
      setError(String(e?.message || e))
      setBackupState('idle')
    }
  }

  async function doImport() {
    setError(null)
    // 触发隐藏的 file input（不调原生 dialog，避免遮挡设置面板）
    fileInputRef.current?.click()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选同一文件
    if (!file) return
    setImportState('busy')
    try {
      const r = await window.api.app.importBackup((file as any).path)
      if (!r) {
        setImportState('idle')
        return
      }
      setImportInfo({ tasks: r.imported.tasks, attachments: r.imported.attachments, backup: r.backup })
      setImportState('needRestart')
    } catch (err: any) {
      setError(String(err?.message || err))
      setImportState('idle')
    }
  }

  async function restartApp() {
    await window.api.app.quit()
  }

  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <PanelHeader title="数据" subtitle="数据落在本地，随时可备份或迁移" />
      <div className="col" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 22px', gap: 14 }}>
        <Card title="数据目录">
          <div className="col" style={{ padding: 12, gap: 10 }}>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ font: '500 13px var(--font-sans)', color: 'var(--ink-0)' }}>你的数据完全保存在本地</span>
              <span className="dim" style={{ fontSize: 11 }}>包含 shanhaibu.db 与所有附件文件，无任何云同步。</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button onClick={() => window.api.app.openDataDir()} className="btn ghost" style={{ height: 32 }}>
                📁 打开数据目录
              </button>
              <button onClick={() => window.api.app.openBackupsDir()} className="btn ghost" style={{ height: 32 }}>
                📦 备份目录
              </button>
            </div>
          </div>
        </Card>

        <Card title="备份导出">
          <div className="col" style={{ padding: 12, gap: 10 }}>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ font: '500 13px var(--font-sans)', color: 'var(--ink-0)' }}>一键打包成 zip</span>
              <span className="dim" style={{ fontSize: 11 }}>把数据库与全部附件打成一个 zip，可拷贝到新电脑/网盘。</span>
            </div>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <button
                onClick={doBackup}
                disabled={backupState === 'busy'}
                className="btn primary"
                style={{ height: 34, opacity: backupState === 'busy' ? 0.6 : 1 }}
              >
                {backupState === 'busy' ? '打包中…' : backupState === 'done' ? '✓ 已导出' : '⬇ 导出备份 zip'}
              </button>
              {lastBackup && (
                <span
                  className="mono dim"
                  style={{ fontSize: 11 }}
                  title={lastBackup.path}
                >
                  {lastBackup.path.split(/[\\/]/).pop()} · {fileSize(lastBackup.size)}
                </span>
              )}
            </div>
            {error && (
              <div style={{ font: '500 12px var(--font-sans)', color: '#E6788E', padding: 8, background: 'rgba(230,120,142,0.08)', borderRadius: 8 }}>
                导出失败：{error}
              </div>
            )}
          </div>
        </Card>

        <Card title="从备份导入">
          <div className="col" style={{ padding: 12, gap: 10 }}>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ font: '500 13px var(--font-sans)', color: 'var(--ink-0)' }}>把旧版 zip 恢复到这台机器</span>
              <span className="dim" style={{ fontSize: 11 }}>
                兼容旧的 WorkBuddy 备份。导入前会先校验数据库格式与 schema，并把当前数据备份为
                <span className="mono"> shanhaibu.db.prev-…</span>。
              </span>
            </div>

            {importState === 'needRestart' && importInfo ? (
              <div
                className="col"
                style={{
                  gap: 8,
                  padding: 10,
                  background: 'rgba(91,185,176,0.08)',
                  border: '1px solid rgba(91,185,176,0.35)',
                  borderRadius: 10
                }}
              >
                <span style={{ font: '500 12px var(--font-sans)', color: '#7FE2C8' }}>
                  ✓ 已写入 {importInfo.tasks} 条异兽记录与 {importInfo.attachments} 个附件
                </span>
                <span className="dim" style={{ fontSize: 11 }}>
                  重启应用后生效。旧数据库已备份到 <span className="mono">{importInfo.backup.split(/[\\/]/).pop()}</span>
                </span>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    onClick={restartApp}
                    className="btn primary"
                    style={{ height: 32 }}
                  >
                    立即重启
                  </button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <button
                  onClick={doImport}
                  disabled={importState === 'busy'}
                  className="btn ghost"
                  style={{ height: 34, opacity: importState === 'busy' ? 0.6 : 1 }}
                >
                  {importState === 'busy' ? '校验中…' : '⬆ 选 zip 导入'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={onFile}
                />
                <span className="dim" style={{ fontSize: 11 }}>
                  旧版（WorkBuddy）数据也可以用同一按钮导入
                </span>
              </div>
            )}
            {importState !== 'needRestart' && error && (
              <div style={{ font: '500 12px var(--font-sans)', color: '#E6788E', padding: 8, background: 'rgba(230,120,142,0.08)', borderRadius: 8 }}>
                导入失败：{error}
              </div>
            )}
          </div>
        </Card>

        <Card title="关于">
          <div className="col" style={{ padding: 12, gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 12 }}>版本</span>
              <span className="mono" style={{ font: '500 12px var(--font-mono)', color: 'var(--ink-1)' }}>0.1.0</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="dim" style={{ fontSize: 12 }}>技术栈</span>
              <span className="mono" style={{ font: '500 12px var(--font-mono)', color: 'var(--ink-1)' }}>Electron · React · sql.js</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="col" style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--line)' }}>
      <span
        className="serif"
        style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink-0)' }}
      >
        {title}
      </span>
      <span className="dim" style={{ fontSize: 12, marginTop: 4 }}>{subtitle}</span>
    </div>
  )
}
