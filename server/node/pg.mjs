/**
 * Cloudflare D1 API(prepare·bind·first·all·run·batch)를 PostgreSQL(Railway) 위에 흉내 낸다.
 * server/core.js의 SQLite 문법을 그대로 받아 Postgres 문법으로 바꿔 실행한다.
 */
import pg from 'pg';

// COUNT(*)·BIGINT를 문자열이 아닌 숫자로(값은 2^53보다 훨씬 작다)
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

const norm = (v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  return v;
};

/** SQLite → Postgres. core.js의 SQL에는 문자열 안에 ?가 없다 */
export function translate(sql) {
  const pragma = sql.match(/^\s*PRAGMA\s+table_info\((\w+)\)\s*$/i);
  if (pragma)
    return `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${pragma[1]}'`;
  let s = sql;
  if (/^\s*CREATE\s+TABLE/i.test(s))
    s = s.replace(/\bINTEGER PRIMARY KEY AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY').replace(/\bINTEGER\b/g, 'BIGINT').replace(/\bBLOB\b/g, 'BYTEA');
  s = s.replace(/\bLIKE\b/g, 'ILIKE'); // SQLite LIKE는 대소문자 구분 없음
  if (/^\s*INSERT\s+INTO\s+(posts|media|inquiries)\b/i.test(s) && !/\bRETURNING\b/i.test(s)) s += ' RETURNING id';
  let i = 0;
  return s.replace(/\?/g, () => '$' + ++i);
}

class Statement {
  constructor(pool, sql, args = []) {
    this.pool = pool;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.pool, this.sql, args.map(norm));
  }
  exec(client = this.pool) {
    return client.query(translate(this.sql), this.args);
  }
  async first(col) {
    const r = (await this.exec()).rows[0];
    if (!r) return null;
    return col ? r[col] ?? null : r;
  }
  async all() {
    return { results: (await this.exec()).rows, success: true, meta: {} };
  }
  async run() {
    const r = await this.exec();
    return { results: [], success: true, meta: { last_row_id: r.rows[0]?.id ?? 0, changes: r.rowCount } };
  }
}

export async function openPg(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30000 });
  pool.on('error', (e) => console.error('postgres pool error', e.message));
  await pool.query('SELECT 1');
  return {
    pool,
    prepare: (sql) => new Statement(pool, sql),
    async batch(stmts) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = [];
        for (const s of stmts) out.push({ results: (await s.exec(client)).rows, success: true, meta: {} });
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    /** 번호를 지정해 넣은 뒤(seed) 다음 글 번호가 겹치지 않게 */
    async syncIds() {
      for (const t of ['posts', 'media'])
        await pool.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), GREATEST(COALESCE((SELECT MAX(id) FROM ${t}), 0), 1), (SELECT COUNT(*) > 0 FROM ${t}))`);
    },
    close: () => pool.end(),
  };
}
