// Khung test nhỏ dùng chung cho tests/exams-*.test.mts (không phụ thuộc thư viện ngoài).
export type Row = {id: string; name: string; pass: boolean; error?: string};
export function suite(prefix: string) {
  const rows: Row[] = [];
  const test = (name: string, fn: () => unknown) => {
    const id = prefix + String(rows.length + 1).padStart(2, '0');
    try { fn(); rows.push({id, name, pass: true}); }
    catch (e) { rows.push({id, name, pass: false, error: e instanceof Error ? e.message : String(e)}); }
  };
  const finish = (extra: Record<string, unknown> = {}) => {
    const failed = rows.filter(r => !r.pass);
    for (const r of rows) console.log(`${r.pass ? '  ok ' : '  LỖI'} ${r.id} ${r.name}${r.error ? '\n       ' + r.error : ''}`);
    console.log(JSON.stringify({suite: prefix, total: rows.length, passed: rows.length - failed.length, failed: failed.length, ...extra}));
    process.exitCode = failed.length ? 1 : 0;
  };
  return {test, finish, rows};
}

/** Bộ nhớ giả thay localStorage. Có thể tiêm lỗi đọc/ghi, đầy bộ nhớ, đọc lại khác, thẻ khác ghi chen. */
export class FakeStore {
  data = new Map<string, string>();
  failGet = false;
  failSet: 'none' | 'quota' | 'denied' = 'none';
  /** Số lần setItem còn được phép trước khi bắt đầu lỗi (giả lập đầy giữa chừng). */
  setsBeforeFail = Infinity;
  /** Móc sửa giá trị trả về của getItem (giả lập đọc lại khác hoặc thẻ khác vừa ghi). */
  getHook: ((key: string, value: string | null, call: number) => string | null) | null = null;
  gets = 0;
  sets = 0;
  constructor(init: Record<string, string> = {}) { for (const [k, v] of Object.entries(init)) this.data.set(k, v); }
  getItem(key: string): string | null {
    if (this.failGet) throw new Error('SecurityError: giả lập không đọc được');
    const value = this.data.has(key) ? this.data.get(key)! : null;
    this.gets++;
    return this.getHook ? this.getHook(key, value, this.gets) : value;
  }
  setItem(key: string, value: string): void {
    if (this.failSet === 'quota' || this.sets >= this.setsBeforeFail) { const e = new Error('QuotaExceededError: giả lập bộ nhớ đầy'); e.name = 'QuotaExceededError'; throw e; }
    if (this.failSet === 'denied') throw new Error('SecurityError: giả lập bị chặn ghi');
    this.data.set(key, String(value)); this.sets++;
  }
  snapshot() { return JSON.stringify([...this.data.entries()].sort()); }
}
