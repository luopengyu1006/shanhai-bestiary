import { useStore, loadTasks } from '../store'
import type { Status } from '../../../shared/types'
import { useState } from 'react'
import { contrastFg } from '../utils'

export function TopBar() {
  const statuses = useStore((s) => s.statuses)
  const filterStatusIds = useStore((s) => s.filterStatusIds)
  const toggleFilter = useStore((s) => s.toggleFilter)
  const clearFilter = useStore((s) => s.clearFilter)
  const keyword = useStore((s) => s.keyword)
  const setKeyword = useStore((s) => s.setKeyword)
  const openSettings = useStore((s) => s.openSettings)

  const [version, setVersion] = useState('')

  // load version once
  useState(() => {
    window.api.app.version().then(setVersion)
  })

  const sorted = [...statuses].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <header
      className="col"
      style={{
        padding: '18px 28px 16px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--topbar)'
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="col" style={{ gap: 2 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <Logo />
            <h1
              className="serif"
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: '0.04em',
                color: 'var(--ink-0)'
              }}
            >
              <span style={{ color: 'var(--amber)' }}>山</span>海
              <span style={{ color: 'var(--violet)' }}>簿</span>
            </h1>
          </div>
          <span className="muted" style={{ fontSize: 11, letterSpacing: '0.04em', paddingLeft: 38 }}>
            每件事是一只异兽 · 文档是图鉴 · 记录是游历 · <span className="mono">v{version || '0.1'}</span>
          </span>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <SearchBox value={keyword} onChange={setKeyword} onSubmit={loadTasks} />
          <button
            className="btn ghost"
            onClick={() => window.api.app.openDataDir()}
            title="打开数据目录"
            style={{ height: 34 }}
          >
            <span style={{ fontSize: 14 }}>📁</span>
            <span style={{ fontSize: 12 }}>数据</span>
          </button>
          <button
            className="btn ghost"
            onClick={openSettings}
            title="状态设置"
            style={{ height: 34, padding: '0 10px' }}
          >
            <span style={{ fontSize: 14 }}>⚙</span>
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 6, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="mono dim" style={{ fontSize: 10, letterSpacing: '0.18em', marginRight: 4 }}>
          FILTER
        </span>
        <button
          className={`chip ${filterStatusIds.size === 0 ? 'active' : ''}`}
          onClick={() => clearFilter()}
          style={
            filterStatusIds.size === 0
              ? (() => {
                  const fg = contrastFg(getComputedStyle(document.documentElement).getPropertyValue('--ink-0').trim() || '#F5F2EC')
                  return { background: 'var(--ink-0)', borderColor: 'var(--ink-0)', color: fg, fontWeight: 600 }
                })()
              : undefined
          }
        >
          全部
          <span
            className="mono"
            style={{
              fontSize: 10,
              marginLeft: 4,
              opacity: filterStatusIds.size === 0 ? 0.7 : 0.55
            }}
          >
            {useStore.getState().tasks.length}
          </span>
        </button>
        {sorted.map((s) => {
          const active = filterStatusIds.has(s.id)
          const count = useStore.getState().tasks.filter((t) => t.status_id === s.id).length
          if (count === 0 && !active) return null
          const fg = active ? contrastFg(s.color) : undefined
          return (
            <button
              key={s.id}
              className={`chip ${active ? 'active' : ''}`}
              onClick={() => toggleFilter(s.id)}
              style={
                active
                  ? {
                      background: s.color,
                      borderColor: s.color,
                      color: fg,
                      fontWeight: 600
                    }
                  : undefined
              }
            >
              <span
                className="dot"
                style={{
                  background: active ? fg : s.color,
                  color: active ? fg : s.color
                }}
              />
              {s.name}
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  marginLeft: 4,
                  opacity: active ? 0.7 : 0.55
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </header>
  )
}

function Logo() {
  // 山海簿 · 异兽图腾（迷你版）
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        overflow: 'hidden',
        boxShadow: '0 6px 18px rgba(155,127,230,0.25), inset 0 0 0 1px rgba(255,255,255,0.04)',
        flex: 'none'
      }}
    >
      <svg viewBox="0 0 64 64" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="lg-bg" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#1B1424" />
            <stop offset="100%" stopColor="#06040A" />
          </radialGradient>
          <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F4C277" />
            <stop offset="100%" stopColor="#A45F26" />
          </linearGradient>
          <linearGradient id="lg-violet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B58CFF" />
            <stop offset="100%" stopColor="#6A48C9" />
          </linearGradient>
          <linearGradient id="lg-goldDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A45F26" />
            <stop offset="100%" stopColor="#5A3318" />
          </linearGradient>
        </defs>
        {/* 底 */}
        <rect width="64" height="64" rx="12" fill="url(#lg-bg)" />
        {/* 矿紫断环 */}
        <circle cx="32" cy="32" r="26" fill="none" stroke="url(#lg-violet)" strokeWidth="1.2" opacity="0.55"
                strokeDasharray="140 14" strokeDashoffset="-40" />
        {/* 后颈鳍 */}
        <path d="M 30 22 L 27 14 L 32 19 L 33 11 L 35 19 L 39 13 L 40 22 Z"
              fill="url(#lg-gold)" stroke="#5A3318" strokeWidth="0.5" />
        {/* 龙首 */}
        <path d="M 14 38
                 C 14 26, 22 20, 30 20
                 C 38 20, 44 24, 46 30
                 C 47 33, 45 36, 42 37
                 L 40 38
                 C 39 39, 38 40, 39 41
                 C 40 42, 42 42, 44 41
                 L 47 40
                 L 49 41
                 L 46 45
                 C 43 47, 39 47, 36 45
                 L 33 43
                 L 30 45
                 C 27 47, 24 47, 21 45
                 L 17 43
                 C 15 41, 14 39, 14 38 Z"
              fill="url(#lg-gold)" stroke="#5A3318" strokeWidth="0.6" />
        {/* 颧骨暗面 */}
        <path d="M 16 36
                 C 20 30, 26 27, 32 27
                 C 37 27, 41 29, 44 32
                 C 40 34, 36 35, 32 35
                 C 28 35, 24 36, 20 37 Z"
              fill="url(#lg-goldDark)" />
        {/* 左角 */}
        <path d="M 24 22 C 20 13, 14 11, 11 15 C 9 19, 13 22, 18 23"
              stroke="url(#lg-gold)" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* 右角 */}
        <path d="M 36 22 C 40 13, 46 11, 48 15 C 50 19, 47 22, 42 23"
              stroke="url(#lg-violet)" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* 眼 */}
        <circle cx="40" cy="32" r="2.4" fill="#F26B6B" />
        <circle cx="39.4" cy="31.4" r="0.7" fill="#FFE9CC" />
        {/* 颈后卷云须 */}
        <path d="M 44 42 C 50 42, 54 38, 56 32"
              stroke="url(#lg-violet)" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.9" />
      </svg>
    </div>
  )
}

function SearchBox({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <div
      className="row"
      style={{
        gap: 8,
        height: 34,
        padding: '0 12px',
        border: '1px solid var(--line-2)',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        minWidth: 240
      }}
    >
      <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>⌕</span>
      <input
        className="input"
        placeholder="搜索标题与进度…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
        style={{ fontSize: 13, color: 'var(--ink-0)' }}
      />
      {value && (
        <button
          onClick={() => {
            onChange('')
            setTimeout(onSubmit, 0)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
