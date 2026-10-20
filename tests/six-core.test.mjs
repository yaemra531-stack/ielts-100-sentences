import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
for (const f of ['six-data.js', 'six-core.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
const D = ctx.SIX_DATA, C = ctx.SixCore;

function finish(s, ratings = { task: 2, ideas: 2, develop: 2, language: 2 }, extra = {}) {
  const it = C.currentItem(s);
  const e = C.entryFor(s, it);
  Object.assign(e, { draft: 'Some words here.', ratings, writeSeconds: 1200, judgedType: it.qid ? D.questions[it.qid].type : undefined }, extra);
  C.complete(s, it);
  return it;
}

test('数据：每道题的要点都有页码，混乱期覆盖 5 种大作文题型和 4 种图', () => {
  for (const [id, q] of Object.entries(D.questions)) {
    assert.ok(D.types[q.type], id);
    for (const n of q.points) assert.ok(D.points[q.task === 'T1' ? 'T' + n : String(n)], `${id} 要点 ${n}`);
    if (q.source === 'book') assert.ok(q.a >= q.q, id);
  }
  const types = new Set(D.explore.flatMap((x) => x.parts || [x.qid]).filter(Boolean).map((id) => D.questions[id].type));
  assert.equal(types.size, 9);
});

test('按进度推进：完成一题才前进，不按日历欠账', () => {
  const s = C.createState(D, 0);
  assert.equal(C.currentItem(s).qid, 'B2.2.9');
  C.entryFor(s, C.currentItem(s));
  assert.equal(s.cursor, 0);
  finish(s);
  assert.equal(C.currentItem(s).qid, 'B3.2.1');
  assert.equal(C.phaseOf(s), 'explore');
});

test('重写日挑自评最低、同分错误更多的一题，并锁定', () => {
  const s = C.createState(D, 0);
  finish(s, { task: 3, ideas: 3, develop: 3, language: 3 });
  finish(s, { task: 2, ideas: 2, develop: 2, language: 2 });
  finish(s, { task: 2, ideas: 2, develop: 2, language: 2 }, { errors: ['comma', 'verb'] });
  finish(s, { task: 1, ideas: 3, develop: 3, language: 3 });
  const r = C.resolve(s, D);
  assert.equal(r.kind, 'rewrite');
  assert.equal(r.source.qid, 'B2.2.13');
  const it = finish(s);
  assert.equal(it.of, 'E03');
});

test('预计完成日期跳过周日', () => {
  const s = C.createState(D, 0);
  const sat = new Date(2026, 0, 3, 20).getTime(); // 周六
  const d = C.estimateFinish(s, 'explore', sat);
  // 12 题：周六算 1，之后每周 6 题，跳过周日
  assert.notEqual(d.getDay(), 0);
  assert.equal(d.getDate() - 3 >= 13, true);
});

test('混乱期结束 → 复盘 → 生成针对期 + 全真期', () => {
  const s = C.createState(D, 0);
  while (C.currentItem(s)) {
    const it = C.currentItem(s);
    const weak = it.qid && ['discuss', 'line'].includes(D.questions[it.qid].type);
    finish(s, weak ? { task: 1, ideas: 1, develop: 2, language: 1 } : undefined, { errors: ['comma'] });
  }
  assert.equal(C.phaseOf(s), 'review');
  const st = C.stats(s, D);
  assert.equal(JSON.stringify(C.suggestWeak(st).sort()), '["discuss","line"]');
  assert.equal(st.topErrors[0].id, 'comma');
  assert.equal(st.judgeRate, 1);
  C.applyReview(s, D, ['discuss', 'line']);
  assert.equal(C.phaseOf(s), 'focus');
  const focus = s.queue.filter((q) => q.phase === 'focus');
  assert.equal(focus.length, 12);
  const qs = focus.filter((q) => q.kind === 'question').map((q) => D.questions[q.qid].type);
  assert.ok(qs.filter((t) => t === 'discuss' || t === 'line').length >= 6);
  assert.equal(new Set(s.queue.map((q) => q.qid).filter(Boolean)).size, s.queue.filter((q) => q.qid).length, '不重复出题');
  assert.equal(s.queue.filter((q) => q.phase === 'mock' && q.kind === 'mockBook').length, 3);
});

test('仓库数据不含题目原文；本机导入原文包后提示词才带题目；导入导出可往返', () => {
  for (const [id, q] of Object.entries(D.questions)) assert.ok(!q.prompt, `${id} 不应带原文`);
  const s = C.createState(D, 0);
  const entry = { draft: 'Tax is necessary for public services.', topErrors: ['逗号连句'] };
  const bare = C.buildPrompt(C.resolve(s, D), entry, D);
  assert.match(bare, /请把书上的题目粘贴/);
  assert.throws(() => C.importPrompts(s, '{"foo":1}', D));
  assert.throws(() => C.importPrompts(s, JSON.stringify({ format: 'ielts6-prompts', version: 1, prompts: { nope: 'x' } }), D));
  const n = C.importPrompts(s, JSON.stringify({ format: 'ielts6-prompts', version: 1, prompts: { 'B2.2.9': 'Some people think that individuals should be allowed to keep all the money they earn.', nope: 'x' } }), D);
  assert.equal(n, 1);
  const p = C.buildPrompt(C.resolve(s, D), entry, D);
  assert.match(p, /6–6\.5/);
  assert.match(p, /keep all the money/);
  assert.match(p, /6 词/);
  assert.match(p, /逗号连句/);
  const back = C.importJSON(C.exportJSON(s), D);
  assert.equal(back.queue.length, s.queue.length);
  assert.equal(back.prompts['B2.2.9'], s.prompts['B2.2.9']);
  assert.throws(() => C.importJSON('{"foo":1}', D));
});
