import type { Database, Statement } from 'sql.js'
import { markDirty } from './db'

/** 把 sql.js 的 prepared statement 包成类 better-sqlite3 的同步 API */
export function prep(sql: string) {
  return new Stmt(getDbInternal().prepare(sql))
}

class Stmt {
  constructor(private stmt: Statement) {}

  private bind(args: any[]) {
    if (args.length) {
      this.stmt.bind(args as any)
    }
  }

  run(...args: any[]): { lastInsertRowid: number; changes: number } {
    this.bind(args)
    this.stmt.run()
    this.stmt.reset()
    const id = getDbInternal().exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] as number ?? 0
    markDirty()
    return { lastInsertRowid: Number(id), changes: 0 }
  }

  get<T = any>(...args: any[]): T | undefined {
    this.bind(args)
    const r = this.stmt.step() ? (this.stmt.getAsObject() as T) : undefined
    this.stmt.reset()
    return r
  }

  all<T = any>(...args: any[]): T[] {
    this.bind(args)
    const rows: T[] = []
    while (this.stmt.step()) rows.push(this.stmt.getAsObject() as T)
    this.stmt.reset()
    return rows
  }
}

// 内部用，避免循环依赖
let _db: Database | null = null
export function setDb(d: Database) {
  _db = d
}
function getDbInternal(): Database {
  if (!_db) throw new Error('db not ready')
  return _db
}
