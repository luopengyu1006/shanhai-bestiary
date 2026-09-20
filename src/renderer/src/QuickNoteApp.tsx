import { useEffect, useRef, useState } from 'react'

export function QuickNoteApp() {
  const [text, setText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const ipcOnFocus = () => inputRef.current?.focus()
    window.addEventListener('focus', ipcOnFocus)
    return () => window.removeEventListener('focus', ipcOnFocus)
  }, [])

  function close() {
    window.api.app.hideQuickNote()
  }

  async function openMain() {
    const content = text.trim()
    if (content) {
      try {
        await window.api.quick.submit({ mode: 'new', title: content, content: '' })
      } catch (e) {
        console.error('快速保存失败：', e)
      }
    }
    setText('')
    try {
      await window.api.app.showMain()
    } catch (e) {
      console.error('打开主窗口失败：', e)
    }
  }

  async function save() {
    const content = text.trim()
    if (!content) {
      close()
      return
    }
    try {
      await window.api.quick.submit({ mode: 'new', title: content, content: '' })
      setText('')
      setFlash('已保存')
      setTimeout(() => setFlash(null), 900)
      setTimeout(() => close(), 250)
    } catch (e) {
      setFlash('保存失败')
      setTimeout(() => setFlash(null), 1500)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      save()
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      save()
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        boxSizing: 'border-box',
        padding: '10px 12px 10px',
        background: 'var(--panel-1)',
        border: '1px solid rgba(232,168,87,0.25)',
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
      onKeyDown={onKey}
    >
      {/* 顶部：标题栏 + 关闭按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          userSelect: 'none'
        }}
      >
        <span
          style={{
            font: '500 10px/1 var(--font-mono)',
            letterSpacing: '0.18em',
            color: 'var(--ink-2)'
          }}
        >
          QUICK NOTE
        </span>
        <button
          onClick={close}
          title="关闭 (Esc)"
          style={{
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--line-2)',
            borderRadius: 6,
            color: 'var(--ink-1)',
            font: '500 14px/1 var(--font-sans)',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>

      {/* 输入框 */}
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="随手记一件事…"
        style={{
          flex: 1,
          width: '100%',
          padding: '4px 2px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          color: 'var(--ink-0)',
          font: '500 15px/1.55 var(--font-display)',
          fontStyle: 'italic'
        }}
      />

      {/* 底部：提示 + 操作按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 6
        }}
      >
        <span
          style={{
            font: '500 10px/1 monospace',
            color: 'var(--ink-3)',
            letterSpacing: '0.06em',
            flex: 1,
            whiteSpace: 'nowrap'
          }}
        >
          Ctrl+S 保存 · Esc 关闭
        </span>
        <button
          onClick={openMain}
          title="保存并切换到主窗口"
          style={{
            height: 28,
            padding: '0 12px',
            background: 'transparent',
            border: '1px solid var(--line-2)',
            borderRadius: 8,
            color: 'var(--ink-1)',
            font: '500 12px/1 var(--font-sans)',
            cursor: 'pointer'
          }}
        >
          主窗口 →
        </button>
        <button
          onClick={save}
          className="btn primary"
          style={{ height: 28, padding: '0 14px', fontSize: 12 }}
        >
          保存
        </button>
      </div>

      {flash && (
        <div
          className="fade"
          style={{
            position: 'absolute',
            top: 36,
            right: 12,
            padding: '4px 10px',
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 999,
            color: '#7FE2A0',
            font: '500 11px var(--font-sans)'
          }}
        >
          ✓ {flash}
        </div>
      )}
    </div>
  )
}