/**
 * IndexedDB ielts6.v1 存储与运行时索引模块
 * 严格只读 ielts100.* 键，绝不写入任何 ielts100.* localStorage 键或触碰 ielts100.audio.v1
 */

import { validatePack, sanitizePack, PACK_FORMAT, PACK_VERSION } from './pack.js';

export const DB_NAME = 'ielts6.v1';
export const DB_VERSION = 1;

let dbInstance = null;

/**
 * 打开 IndexedDB 数据库
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('points')) {
        db.createObjectStore('points', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('questions')) {
        db.createObjectStore('questions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    req.onerror = (e) => {
      reject(new Error('无法打开 IndexedDB ' + DB_NAME + ': ' + e.target.error));
    };
  });
}

/**
 * 执行事务辅助函数
 */
function transaction(storeNames, mode, fn) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const res = fn(tx);
      tx.oncomplete = () => resolve(res);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

/**
 * 获取所有要点
 */
export async function getPoints() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('points', 'readonly');
    const req = tx.objectStore('points').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取单个要点
 */
export async function getPoint(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('points', 'readonly');
    const req = tx.objectStore('points').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 批量保存要点
 */
export async function putPoints(points) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('points', 'readwrite');
    const store = tx.objectStore('points');
    for (const p of points) {
      store.put(p);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取所有题目
 */
export async function getQuestions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readonly');
    const req = tx.objectStore('questions').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取单个题目
 */
export async function getQuestion(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readonly');
    const req = tx.objectStore('questions').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 批量保存题目
 */
export async function putQuestions(questions) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readwrite');
    const store = tx.objectStore('questions');
    for (const q of questions) {
      store.put(q);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取所有会话记录
 */
export async function getSessions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || ''));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 保存单个会话记录
 */
export async function saveSession(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put(session);
    tx.oncomplete = () => resolve(session);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取/写入元数据 (key-value)
 */
export async function getMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 导出完整数据包
 */
export async function exportFullPack() {
  const [points, questions, sessions] = await Promise.all([
    getPoints(),
    getQuestions(),
    getSessions()
  ]);

  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    points,
    questions,
    sessions
  };
}

/**
 * 导入完整数据包（覆盖或合并）
 */
export async function importFullPack(packData) {
  const validation = validatePack(packData);
  if (!validation.valid) {
    throw new Error('数据包格式错误: ' + validation.errors.join('; '));
  }

  const { points, questions, sessions } = validation.pack;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['points', 'questions', 'sessions', 'meta'], 'readwrite');
    const ptStore = tx.objectStore('points');
    const qStore = tx.objectStore('questions');
    const sStore = tx.objectStore('sessions');
    const mStore = tx.objectStore('meta');

    // 清空现有数据
    ptStore.clear();
    qStore.clear();
    sStore.clear();

    for (const p of points) ptStore.put(p);
    for (const q of questions) qStore.put(q);
    for (const s of sessions) sStore.put(s);

    mStore.put({ key: 'lastImport', value: new Date().toISOString() });

    tx.oncomplete = () => resolve({
      pointsCount: points.length,
      questionsCount: questions.length,
      sessionsCount: sessions.length
    });
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 重置全部数据
 */
export async function resetDatabase() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['points', 'questions', 'sessions', 'meta'], 'readwrite');
    tx.objectStore('points').clear();
    tx.objectStore('questions').clear();
    tx.objectStore('sessions').clear();
    tx.objectStore('meta').clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 初始化题库与要点（若数据库为空则从 public data 载入）
 */
export async function ensureInitialized() {
  const [points, questions] = await Promise.all([getPoints(), getQuestions()]);
  if (points.length > 0 && questions.length > 0) {
    return { initialized: false, pointsCount: points.length, questionsCount: questions.length };
  }

  try {
    const resp = await fetch('data/default-pack.json', { cache: 'no-store' });
    if (resp.ok) {
      const defaultPack = await resp.json();
      await importFullPack(defaultPack);
      return { initialized: true, pointsCount: defaultPack.points.length, questionsCount: defaultPack.questions.length };
    }
  } catch (err) {
    console.warn('无法载入 data/default-pack.json:', err);
  }

  return { initialized: false, pointsCount: 0, questionsCount: 0 };
}

/**
 * 运行时反向索引计算（不单独存储）
 * 计算「要点 → 关联题目」以及「要点 → 历史练习错误」
 */
export function computeRuntimeIndexes({ points = [], questions = [], sessions = [] }) {
  const pointToQuestions = {};
  const pointToIssues = {};

  for (const p of points) {
    pointToQuestions[p.id] = [];
    pointToIssues[p.id] = [];
  }

  for (const q of questions) {
    if (Array.isArray(q.pointIds)) {
      for (const pid of q.pointIds) {
        if (!pointToQuestions[pid]) pointToQuestions[pid] = [];
        pointToQuestions[pid].push(q);
      }
    }
  }

  for (const s of sessions) {
    if (Array.isArray(s.issues)) {
      for (const iss of s.issues) {
        if (Array.isArray(iss.pointIds)) {
          for (const pid of iss.pointIds) {
            if (!pointToIssues[pid]) pointToIssues[pid] = [];
            pointToIssues[pid].push({
              sessionId: s.id,
              date: s.date,
              questionId: s.questionId,
              issue: iss
            });
          }
        }
      }
    }
  }

  return { pointToQuestions, pointToIssues };
}

/**
 * 只读读取 ielts100.chunks.bank.v1
 * 严格只读！
 */
export function readChunksBank() {
  try {
    const raw = localStorage.getItem('ielts100.chunks.bank.v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 只读读取 ielts100.theme.v1
 * 严格只读！
 */
export function readTheme() {
  try {
    return localStorage.getItem('ielts100.theme.v1');
  } catch {
    return null;
  }
}
