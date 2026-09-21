import { useEffect } from 'react'
import { useStore, loadTasks, loadStatuses } from './store'
import { TopBar } from './components/TopBar'
import { TaskList } from './components/TaskList'
import { TaskDetail } from './components/TaskDetail'
import { NewTaskInput } from './components/NewTaskInput'
import { SettingsModal } from './components/SettingsModal'

export function App() {
  const setLoading = useStore((s) => s.setLoading)
  const selectedId = useStore((s) => s.selectedId)
  const setSelected = useStore((s) => s.setSelected)
  const tasks = useStore((s) => s.tasks)
  const filterStatusIds = useStore((s) => s.filterStatusIds)
  const keyword = useStore((s) => s.keyword)

  useEffect(() => {
    ;(async () => {
      await loadStatuses()
      await loadTasks()
      setLoading(false)
    })()
  }, [])

  // 过滤变化时重新加载
  useEffect(() => {
    loadTasks()
  }, [keyword])

  // 键盘：ESC 清空选中
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null)
      }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        const idx = tasks.findIndex((t) => t.id === selectedId)
        const next = tasks[Math.min(idx + 1, tasks.length - 1)]
        if (next) setSelected(next.id)
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        const idx = tasks.findIndex((t) => t.id === selectedId)
        const prev = tasks[Math.max(idx - 1, 0)]
        if (prev) setSelected(prev.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tasks, selectedId])

  return (
    <div
      className="col"
      style={{
        height: '100%',
        background:
          'radial-gradient(900px 600px at 90% -10%, var(--halo-1), transparent 60%), var(--bg-0)'
      }}
    >
      <TopBar />

      <div
        className="row"
        style={{
          flex: 1,
          minHeight: 0,
          alignItems: 'stretch'
        }}
      >
        {/* 左侧：列表 */}
        <aside
          style={{
            width: 380,
            minWidth: 380,
            borderRight: '1px solid var(--line)',
            padding: '20px 18px',
            overflow: 'auto',
            background: 'rgba(255,255,255,0.012)',
            isolation: 'isolate'
          }}
        >
          <NewTaskInput />
          <TaskList />
        </aside>

        {/* 右侧：详情 */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <TaskDetail />
        </main>
      </div>
      <SettingsModal />
    </div>
  )
}
