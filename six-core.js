/* 每日一题 · 纯逻辑（无 DOM），浏览器挂到 window.SixCore，Node 测试用 vm 加载 */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'ielts6.v1';
  const PER_WEEK = 6;

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const pad = (n) => String(n).padStart(2, '0');

  function createState(data, now = Date.now()) {
    return {
      v: 2,
      createdAt: now,
      queue: data.learn.map((it, i) => ({ ...clone(it), id: 'L' + pad(i + 1), phase: 'learn' })),
      cursor: 0,
      entries: {},
      review: null,
      drill: {},
      settings: { pdfOffset: data.pdfOffset }
    };
  }

  function normalize(raw, data) {
    if (!raw || typeof raw !== 'object') return null;
    /* 旧版（先写后查的混乱期）：换成模仿期题单，只保留设置 */
    if (raw.v === 1 && raw.settings) { const s = createState(data); s.settings = { ...s.settings, ...raw.settings }; return s; }
    if (raw.v !== 2 || !Array.isArray(raw.queue) || typeof raw.entries !== 'object') return null;
    const s = { ...createState(data, raw.createdAt || Date.now()), ...raw };
    s.settings = { pdfOffset: data.pdfOffset, ...(raw.settings || {}) };
    delete s.prompts;
    if (!s.drill || typeof s.drill !== 'object') s.drill = {};
    s.cursor = Math.max(0, Math.min(Number(s.cursor) || 0, s.queue.length));
    return s;
  }

  const currentItem = (s) => s.queue[s.cursor] || null;
  const pdf = (s, page) => page + (Number(s.settings.pdfOffset) || 0);

  function question(s, data, id) {
    const q = data.questions[id];
    return q ? { ...q, id, prompt: q.prompt || '' } : null;
  }

  function questionsOf(item, data, s) {
    if (item.kind === 'question' || item.kind === 'imitate') return [question(s, data, item.qid)].filter(Boolean);
    if (item.kind === 'mock' && item.parts) return item.parts.map((id) => question(s, data, id)).filter(Boolean);
    return [];
  }

  function ratingScore(entry) {
    const r = entry && entry.ratings;
    if (!r) return null;
    const vals = Object.values(r).filter((v) => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  /* 重写：从上一次重写之后完成的题里，挑自评最低的一道（同分看错误多的） */
  function pickRewrite(s, data, beforeIndex = s.cursor) {
    let start = 0;
    for (let i = beforeIndex - 1; i >= 0; i--) if (s.queue[i].kind === 'rewrite') { start = i + 1; break; }
    const cands = [];
    for (let i = start; i < beforeIndex; i++) {
      const it = s.queue[i], e = s.entries[it.id];
      if (it.kind !== 'question' || !e || e.status !== 'done' || !e.draft) continue;
      cands.push({ it, e, score: ratingScore(e) ?? 2, errs: (e.errors || []).length });
    }
    cands.sort((a, b) => a.score - b.score || b.errs - a.errs);
    return cands[0] ? cands[0].it : null;
  }

  function resolve(s, data, item = currentItem(s)) {
    if (!item) return null;
    if (item.kind === 'rewrite') {
      const src = item.of ? s.queue.find((q) => q.id === item.of) : pickRewrite(s, data, s.queue.indexOf(item));
      return { item, kind: 'rewrite', source: src, question: src ? question(s, data, src.qid) : null, previous: src ? s.entries[src.id] : null };
    }
    if (item.kind === 'mockBook') return { item, kind: 'mockBook', mock: data.mocks.find((m) => m.id === item.mid) };
    const qs = questionsOf(item, data, s);
    const r = { item, kind: item.kind, questions: qs, question: qs[0] };
    if (item.kind === 'imitate' && item.then) r.then = question(s, data, item.then);
    return r;
  }

  function minutesFor(r) {
    if (!r) return 0;
    if (r.kind === 'mock' || r.kind === 'mockBook') return 60;
    const q = r.question;
    if (!q) return 25;
    if (r.kind === 'imitate') return q.task === 'T1' ? 20 : 25;
    if (q.task === 'T1') return 20;
    return r.item.full ? 40 : 25;
  }

  function entryFor(s, item, now = Date.now()) {
    if (!s.entries[item.id]) s.entries[item.id] = { itemId: item.id, status: 'active', step: 1, startedAt: now, draft: '', errors: [], stuck: [], learned: [], ratings: {} };
    return s.entries[item.id];
  }

  function complete(s, item, now = Date.now()) {
    const e = entryFor(s, item, now);
    e.status = 'done';
    e.finishedAt = now;
    if (item.kind === 'rewrite' && !item.of) {
      const src = pickRewrite(s, null, s.queue.indexOf(item));
      if (src) item.of = src.id;
    }
    if (s.queue[s.cursor] === item) s.cursor += 1;
    return s;
  }

  const wordCount = (t) => ((t || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;

  function phaseOf(s) {
    const item = currentItem(s);
    if (item) return item.phase;
    const learnDone = s.queue.filter((q) => q.phase === 'learn').every((q) => s.entries[q.id]?.status === 'done');
    if (learnDone && !s.review) return 'review';
    return 'free';
  }

  function phaseProgress(s, phase) {
    const items = s.queue.filter((q) => q.phase === phase);
    const done = items.filter((q) => s.entries[q.id]?.status === 'done').length;
    return { done, total: items.length };
  }

  /* 按进度推进：剩余题数 ÷ 每周 6 题，跳过周日，不按日历欠账 */
  function estimateFinish(s, phase, now = Date.now()) {
    const { done, total } = phaseProgress(s, phase);
    let left = total - done;
    const d = new Date(now);
    if (left <= 0) return null;
    while (left > 0) {
      if (d.getDay() !== 0) left -= 1;
      if (left > 0) d.setDate(d.getDate() + 1);
    }
    return d;
  }

  function stats(s, data) {
    const byType = {}, errCount = {}, stuckCount = {};
    let judged = 0, judgedRight = 0, writeSecs = 0, writeN = 0, done = 0, steals = 0;
    for (const it of s.queue) {
      const e = s.entries[it.id];
      if (!e || e.status !== 'done') continue;
      done += 1;
      if (e.steal && e.steal.trim()) steals += 1;
      (e.errors || []).forEach((x) => (errCount[x] = (errCount[x] || 0) + 1));
      (e.stuck || []).forEach((x) => (stuckCount[x] = (stuckCount[x] || 0) + 1));
      if (e.writeSeconds) { writeSecs += e.writeSeconds; writeN += 1; }
      const q = it.kind === 'question' || it.kind === 'imitate' ? data.questions[it.qid] : null;
      if (!q) continue;
      if (e.judgedType) { judged += 1; if (e.judgedType === q.type) judgedRight += 1; }
      const sc = ratingScore(e);
      const t = (byType[q.type] = byType[q.type] || { type: q.type, n: 0, sum: 0, rated: 0 });
      t.n += 1;
      if (sc != null) { t.sum += sc; t.rated += 1; }
    }
    const types = Object.values(byType).map((t) => ({ ...t, avg: t.rated ? t.sum / t.rated : null }));
    const topErrors = Object.entries(errCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, n }));
    return { done, steals, types, errCount, topErrors, stuckCount, judgeRate: judged ? judgedRight / judged : null, judged, avgWriteMin: writeN ? writeSecs / writeN / 60 : null };
  }

  function suggestWeak(st) {
    return st.types.filter((t) => t.avg != null).sort((a, b) => a.avg - b.avg || b.n - a.n).slice(0, 2).map((t) => t.type);
  }

  /* 阶段总结后生成：真题期 2 周（6 成练弱项，全部计时、不看书）+ 全真期 3 套。
   * 模仿期里只写了开头和概述的第二张图（then）还算没写过，可以在真题期整篇写。 */
  function applyReview(s, data, weakTypes, now = Date.now()) {
    const st = stats(s, data);
    const used = new Set(s.queue.flatMap((q) => [q.qid, ...(q.parts || [])]).filter(Boolean));
    const pool = Object.entries(data.questions).filter(([id]) => !used.has(id)).map(([id, q]) => ({ id, ...q }));
    const take = (pred) => {
      const i = pool.findIndex((q) => pred(q) && q.source === 'book');
      const j = i >= 0 ? i : pool.findIndex(pred);
      return j >= 0 ? pool.splice(j, 1)[0].id : null;
    };
    const weak = weakTypes.length ? weakTypes : ['opinion', 'discuss'];
    const t1Rot = ['line', 'bar', 'process', 'map'].filter((t) => !weak.includes(t));
    const t2Rot = ['opinion', 'advdis', 'discuss', 'report', 'mixed'].filter((t) => !weak.includes(t));
    const out = [];
    for (let w = 0; w < 2; w++) {
      const w1 = weak[0], w2 = weak[1] || weak[0];
      const other = w === 0 ? t1Rot[0] : t2Rot[0];
      const slots = [w1, w2, other, w1, 'rewrite', w2];
      slots.forEach((t, k) => {
        if (t === 'rewrite') return out.push({ kind: 'rewrite' });
        const id = take((q) => q.type === t) || take((q) => data.types[t] && q.task === data.types[t].task) || take(() => true);
        if (id) out.push({ kind: 'question', qid: id, full: true, real: true });
      });
      t1Rot.push(t1Rot.shift()); t2Rot.push(t2Rot.shift());
    }
    data.mocks.forEach((m, i) => { out.push({ kind: 'mockBook', mid: m.id }); if (i < data.mocks.length - 1) out.push({ kind: 'rewrite' }); });
    const base = s.queue.length;
    out.forEach((it, i) => s.queue.push({ ...it, id: (it.kind === 'mockBook' ? 'M' : 'F') + pad(base + i + 1), phase: it.kind === 'mockBook' || i >= 12 ? 'mock' : 'focus' }));
    s.review = { at: now, weakTypes: weak, topErrors: st.topErrors.map((e) => e.id) };
    return s;
  }

  function buildPrompt(r, entry, data) {
    const q = r.question || {};
    const isT1 = q.task === 'T1';
    const top = (entry.topErrors || []).join('、');
    const imit = r.kind === 'imitate';
    return [
      '你是严格但友善的雅思写作考官。我的目标是写作 6–6.5 分。',
      `题目（${isT1 ? 'Task 1，图在书上' : 'Task 2'}）：${q.prompt || '（请把书上的题目粘贴在这里）'}`,
      imit ? `我的作文（模仿练习：参照书上范文的结构写的，${wordCount(entry.draft)} 词）：` : `我的作文（限时 ${minutesFor(r)} 分钟，${wordCount(entry.draft)} 词）：`,
      entry.draft || '（未填写）',
      imit ? '这是仿写，结构参考了范文。请重点看：我换成自己的观点和句子后，有没有写错、有没有写偏题。' : '',
      '',
      '请输出：',
      `1. ${isT1 ? 'TA / CC / LR / GRA' : 'TR / CC / LR / GRA'} 四项估分，每项一句依据并引用原文`,
      '2. 离 6.0 和 6.5 各差在哪里（各 2 条）',
      '3. 最影响分数的 3 个问题，按影响大小排序',
      '4. 语法错误逐句指出，并归类到：逗号连句 / 词性 / 谓语时态 / 句子残缺 / 单复数不可数 / 其他',
      '5. 改写我最弱的一段（保持我的意思，只改到 6.5 分水平，不要用生僻词）',
      top ? `另外，我的高频错误是：${top}，请重点检查。` : '',
      '注意：这是单次练习估分，不是正式成绩。'
    ].filter((x) => x !== '').join('\n');
  }


  /* ---------- 配套练习（词块默写 / 句型填空 / 选择题） ---------- */
  const norm = (t) => String(t ?? '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const alts = (t) => String(t || '').split(/\s+\/\s+|\//).map((x) => x.trim()).filter(Boolean);
  const HAN = /[\u3400-\u9fff]/;

  /* 「中文 = English」一行一个；两边顺序随意，= ＝ ： Tab 都能分隔 */
  function parseChunks(text) {
    const out = [];
    String(text || '').split(/\n+/).forEach((line) => {
      const m = line.replace(/^\s*[-*•\d.、)]+\s*/, '').split(/\s*(?:=|＝|\t|：| : )\s*/);
      if (m.length < 2) return;
      let [a, b] = [m[0].trim(), m.slice(1).join(' ').trim()];
      if (!a || !b) return;
      if (HAN.test(b) && !HAN.test(a)) [a, b] = [b, a];
      if (!HAN.test(a) || HAN.test(b)) return;
      out.push({ zh: a, en: b });
    });
    return out;
  }

  /* 把 {答案/备选} 拆成文字片段和空 */
  function clozeParts(text) {
    const parts = [], blanks = [];
    let last = 0;
    String(text || '').replace(/\{([^}]+)\}/g, (m, inner, at) => { parts.push(text.slice(last, at)); blanks.push(alts(inner)); last = at + m.length; return m; });
    parts.push(String(text || '').slice(last));
    return { parts, blanks, full: parts.map((p, i) => p + (blanks[i] ? blanks[i][0] : '')).join('') };
  }

  const hash = (t) => { let h = 0; for (const ch of String(t)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h.toString(36); };

  function mineItems(s, data) {
    const out = [], seen = new Set();
    s.queue.forEach((it) => {
      const e = s.entries[it.id];
      if (!e || !e.chunks) return;
      const qq = data.questions[it.qid];
      parseChunks(e.chunks).forEach((c) => {
        const id = 'm:' + hash(c.zh + '=' + c.en);
        if (seen.has(id)) return;
        seen.add(id);
        out.push({ id, type: 'chunk', zh: c.zh, en: c.en, from: qq ? qq.title : '' });
      });
    });
    return out;
  }

  function packItems(drills, qid) {
    const p = drills && drills.packs && drills.packs[qid];
    return p ? p.items.map((x) => ({ ...x, pack: qid })) : [];
  }

  const isWrong = (s, id) => { const d = s.drill && s.drill[id]; return !!(d && d.bad && !d.streak); };

  function drillItems(s, data, drills, source) {
    const packs = Object.keys((drills && drills.packs) || {});
    const all = () => [...packs.flatMap((k) => packItems(drills, k)), ...mineItems(s, data)];
    if (source === 'mine') return mineItems(s, data);
    if (source === 'wrong') return all().filter((x) => isWrong(s, x.id));
    if (source === 'all' || !source) return all();
    return packItems(drills, source);
  }

  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* 一轮：上次做错的优先 → 没做过的 → 连对次数少、隔得久的 */
  function buildRound(items, s, n = 10, rng = Math.random) {
    const d = s.drill || {};
    const rank = (x) => { const r = d[x.id]; if (!r) return 1; if (r.bad && !r.streak) return 0; return 2 + Math.min(r.streak, 5); };
    return shuffle(items, rng).map((x) => ({ x, r: rank(x), t: (d[x.id] && d[x.id].last) || 0 }))
      .sort((a, b) => a.r - b.r || a.t - b.t).slice(0, n).map((o) => o.x);
  }

  function checkAnswer(item, answer) {
    if (item.type === 'choice') return { ok: Number(answer) === item.a };
    if (item.type === 'cloze') {
      const { blanks } = clozeParts(item.text);
      const given = Array.isArray(answer) ? answer : [answer];
      const per = blanks.map((b, i) => b.some((alt) => norm(alt) === norm(given[i])));
      return { ok: per.every(Boolean), per };
    }
    const n = norm(answer);
    return { ok: !!n && alts(item.en).some((alt) => norm(alt) === n) };
  }

  function recordDrill(s, id, ok, now = Date.now()) {
    s.drill = s.drill || {};
    const r = (s.drill[id] = s.drill[id] || { ok: 0, bad: 0, streak: 0, last: 0 });
    if (ok) { r.ok += 1; r.streak += 1; } else { r.bad += 1; r.streak = 0; }
    r.last = now;
    return r;
  }

  function drillStats(s, items) {
    const d = s.drill || {};
    let seen = 0, mastered = 0, wrong = 0;
    items.forEach((x) => { const r = d[x.id]; if (!r) return; seen += 1; if (r.streak >= 2) mastered += 1; if (r.bad && !r.streak) wrong += 1; });
    return { total: items.length, seen, mastered, wrong };
  }

  function exportJSON(s) { return JSON.stringify({ app: 'ielts6', exportedAt: new Date().toISOString(), state: s }, null, 2); }
  function importJSON(text, data) {
    const obj = JSON.parse(text);
    const s = normalize(obj && obj.app === 'ielts6' ? obj.state : obj, data);
    if (!s) throw new Error('文件格式不对：不是「每日一题」导出的记录。');
    return s;
  }

  root.SixCore = { STORAGE_KEY, PER_WEEK, createState, normalize, currentItem, resolve, questionsOf, entryFor, complete, pickRewrite, ratingScore, minutesFor, wordCount, phaseOf, phaseProgress, estimateFinish, stats, suggestWeak, applyReview, buildPrompt, exportJSON, importJSON, question, pdf, norm, alts, parseChunks, clozeParts, drillItems, buildRound, checkAnswer, recordDrill, drillStats, shuffle };
})(typeof window !== 'undefined' ? window : globalThis);
