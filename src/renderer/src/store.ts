import { create } from 'zustand'
import type { TaskWithStatus, Status } from '../../shared/types'

interface State {
  tasks: TaskWithStatus[]
  statuses: Status[]
  selectedId: number | null
  filterStatusIds: Set<number>
  keyword: string
  loading: boolean
  settingsOpen: boolean
}

interface Actions {
  setTasks: (tasks: TaskWithStatus[]) => void
  setStatuses: (statuses: Status[]) => void
  setSelected: (id: number | null) => void
  toggleFilter: (id: number) => void
  clearFilter: () => void
  setKeyword: (kw: string) => void
  setLoading: (v: boolean) => void
  upsertTask: (t: TaskWithStatus) => void
  removeTask: (id: number) => void
  openSettings: () => void
  closeSettings: () => void
}

export const useStore = create<State & Actions>((set) => ({
  tasks: [],
  statuses: [],
  selectedId: null,
  filterStatusIds: new Set<number>(),
  keyword: '',
  loading: true,
  settingsOpen: false,

  setTasks: (tasks) => set({ tasks }),
  setStatuses: (statuses) => set({ statuses }),
  setSelected: (id) => set({ selectedId: id }),
  toggleFilter: (id) =>
    set((s) => {
      if (s.filterStatusIds.has(id)) {
        return { filterStatusIds: new Set<number>() }
      }
      return { filterStatusIds: new Set([id]) }
    }),
  clearFilter: () => set({ filterStatusIds: new Set<number>() }),
  setKeyword: (keyword) => set({ keyword }),
  setLoading: (loading) => set({ loading }),
  upsertTask: (t) =>
    set((s) => {
      const idx = s.tasks.findIndex((x) => x.id === t.id)
      if (idx === -1) return { tasks: [t, ...s.tasks] }
      const next = s.tasks.slice()
      next[idx] = t
      return { tasks: next }
    }),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false })
}))

export async function loadTasks() {
  const { keyword } = useStore.getState()
  const tasks = await window.api.task.list({
    keyword: keyword.trim() || undefined
  })
  useStore.getState().setTasks(tasks)
}

export async function loadStatuses() {
  const statuses = await window.api.status.list()
  useStore.getState().setStatuses(statuses)
}
