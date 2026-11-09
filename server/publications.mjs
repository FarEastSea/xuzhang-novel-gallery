import { digest } from './store.mjs';
const scopes = new Set(['public', 'members', 'selected', 'admins']);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function createPublications(store) {
  const { db } = store;
  const sourceKey = () => digest(store.settings().studioOrigin || 'snapshot');
  function policy(id, source = sourceKey()) {
    const row = db.prepare('SELECT * FROM publications WHERE source_key=? AND novel_id=?').get(source, id);
    return { published: Boolean(row?.published), visibility: row?.visibility || 'public', revision: row?.revision || 0,
      userIds: row ? db.prepare('SELECT user_id FROM publication_users WHERE source_key=? AND novel_id=? ORDER BY user_id').all(source, id).map(v => v.user_id) : [], updatedAt: row?.updated_at || null };
  }
  function canRead(id, user, source = sourceKey()) {
    if (user?.role === 'admin') return true;
    const row = db.prepare('SELECT published, visibility FROM publications WHERE source_key=? AND novel_id=?').get(source, id);
    if (!row?.published) return false;
    if (row.visibility === 'public') return true;
    if (!user) return false;
    if (row.visibility === 'members') return true;
    return row.visibility === 'selected' && Boolean(db.prepare('SELECT 1 FROM publication_users WHERE source_key=? AND novel_id=? AND user_id=?').get(source, id, user.id));
  }
  function save(id, value, source, metadata) {
    if (value.sourceKey !== source || source !== sourceKey()) fail(409, '作品来源已变更，请刷新作品列表后重试');
    if (typeof value.published !== 'boolean' || !scopes.has(value.visibility) || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.userIds) || value.userIds.length > 200 || new Set(value.userIds).size !== value.userIds.length || value.userIds.some(v => typeof v !== 'string')) fail(400, '上架状态、可见范围或授权用户格式错误');
    if (value.visibility !== 'selected' && value.userIds.length) fail(400, '仅指定用户范围可以选择授权用户');
    if (value.visibility === 'selected' && value.published && !value.userIds.length) fail(400, '上架前请至少选择一位用户');
    for (const userId of value.userIds) if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(userId)) fail(400, '授权用户已不存在，请刷新用户列表');
    const current = policy(id, source);
    if (current.revision !== value.revision) fail(409, '此作品已被其他管理员修改，请刷新后重新设置');
    const updated = new Date().toISOString();
    db.prepare(`INSERT INTO publications (source_key, novel_id, published, visibility, revision, updated_at, title, genre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_key, novel_id) DO UPDATE SET published=excluded.published, visibility=excluded.visibility, revision=excluded.revision, updated_at=excluded.updated_at, title=excluded.title, genre=excluded.genre`).run(source, id, Number(value.published), value.visibility, current.revision + 1, updated, metadata?.title || id, metadata?.genre || '未分类');
    db.prepare('DELETE FROM publication_users WHERE source_key=? AND novel_id=?').run(source, id);
    const add = db.prepare('INSERT INTO publication_users VALUES (?, ?, ?)');
    for (const userId of value.userIds) add.run(source, id, userId);
    store.touchAccess();
    return policy(id, source);
  }
  return { sourceKey, policy, canRead, save };
}
