/** Cloudflare D1 API(prepare·bind·first·all·run·batch)를 node:sqlite 위에 흉내 낸다. server/core.js를 그대로 쓰기 위함. */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const norm = (v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return v;
};
const plain = (r) => (r ? { ...r } : null);

class Statement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.db, this.sql, args.map(norm));
  }
  firstSync(col) {
    const r = plain(this.db.prepare(this.sql).get(...this.args));
    if (!r) return null;
    return col ? r[col] ?? null : r;
  }
  allSync() {
    return { results: this.db.prepare(this.sql).all(...this.args).map(plain), success: true, meta: {} };
  }
  runSync() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { results: [], success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
  }
  async first(col) {
    return this.firstSync(col);
  }
  async all() {
    return this.allSync();
  }
  async run() {
    return this.runSync();
  }
}

export function openD1(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  return {
    raw: db,
    close: () => db.close(),
    prepare: (sql) => new Statement(db, sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => (/^\s*(select|pragma)/i.test(s.sql) ? s.allSync() : s.runSync()));
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
