import { readFile } from 'node:fs/promises';
import path from 'node:path';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function createSource(store, dataDir, fetchImpl) {
  async function get(route, query = '', settings = store.settings()) {
    if (!settings.studioOrigin) fail(503, '尚未配置作品来源');
    let response;
    try { response = await fetchImpl(settings.studioOrigin + route + query, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(settings.timeoutSeconds * 1000) }); }
    catch { fail(502, '作品来源暂不可用'); }
    if (!response.ok) fail(response.status === 404 ? 404 : 502, response.status === 404 ? '作品不存在' : '作品来源暂不可用');
    let payload;
    try { payload = await response.json(); } catch { fail(502, '作品来源返回格式错误'); }
    if (payload.success === false) fail(502, '作品来源暂不可用');
    return payload.data;
  }
  async function list() {
    const settings = store.settings();
    const items = []; const seen = new Set();
    for (let page = 1; page <= 100; page++) {
      const data = await get('/api/novels', page === 1 ? '?limit=100' : `?limit=100&page=${page}`, settings);
      if (!Array.isArray(data?.items)) fail(502, '作品列表格式错误');
      const previousSize = seen.size;
      for (const item of data.items) {
        if (typeof item?.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(item.id) || seen.has(item.id)) continue;
        seen.add(item.id); items.push(item);
      }
      if (!Number.isInteger(data.totalPages) || page >= data.totalPages) return { items };
      if (!data.items.length || seen.size === previousSize) fail(502, '作品来源分页不完整');
    }
    fail(502, '作品数量超出单次读取范围');
  }
  async function snapshot() {
    const empty = { generatedAt: '', source: 'snapshot', works: [] };
    if (!store.settings().snapshotEnabled) return empty;
    try {
      const value = JSON.parse(await readFile(path.join(dataDir, 'snapshot.json'), 'utf8'));
      if (!Array.isArray(value.works)) throw new Error('Invalid snapshot');
      return value;
    } catch (error) { if (error.code === 'ENOENT') return empty; fail(503, '离线快照不可用'); }
  }
  async function catalog() {
    let live = []; let warning = '';
    try { live = (await list()).items; } catch (error) { warning = error.message; }
    let offline = [];
    try { offline = (await snapshot()).works; } catch (error) { warning = [warning, error.message].filter(Boolean).join('；'); }
    const merged = new Map(offline.map(item => [item.id, { id: item.id, title: item.title || '未命名作品', genre: item.genre?.name || '未分类', source: 'snapshot' }]));
    for (const item of live) merged.set(item.id, { id: item.id, title: item.title || '未命名作品', genre: item.genre?.name || '未分类', source: 'live' });
    return { items: [...merged.values()], warning };
  }
  return { get, list, snapshot, catalog };
}
