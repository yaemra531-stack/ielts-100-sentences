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
  Object.assign(e, { draft: 'Some words here.', ratings: it.kind === 'imitate' ? {} : ratings, writeSeconds: 1200, judgedType: it.qid ? D.questions[it.qid].type : undefined }, extra);
  C.complete(s, it);
  return it;
}

test('数据：每道题有英文题目和要点页码；模仿期按题型分单元', () => {
  for (const [id, q] of Object.entries(D.questions)) {
    assert.ok(D.types[q.type], id);
    assert.ok(q.prompt && q.prompt.length > 40, `${id} 缺英文题目`);
    for (const n of q.points) assert.ok(D.points[q.task === 'T1' ? 'T' + n : String(n)], `${id} 要点 ${n}`);
    if (q.source === 'book') assert.ok(q.a >= q.q, id);
  }
  const units = [];
  for (const it of D.learn) if (units[units.length - 1] !== it.unit) units.push(it.unit);
  assert.equal(JSON.stringify(units), JSON.stringify(['opinion', 'line', 'advdis', 'bar', 'discuss', 'process', 'report', 'map', 'mixed', 'stage']));
  for (const u of ['opinion', 'advdis', 'discuss', 'report', 'mixed']) {
    const days = D.learn.filter((x) => x.unit === u);
    assert.equal(days.map((x) => x.kind).join(), 'imitate,imitate,question', u);
    assert.ok(days[1].less && days[2].real && days[2].full, u);
    for (const d of days) assert.equal(D.questions[d.qid].type, u);
    assert.equal(D.questions[days[0].qid].source, 'book');
    assert.equal(D.questions[days[2].qid].source, 'abc');
  }
  for (const u of ['line', 'bar', 'process', 'map']) {
    const days = D.learn.filter((x) => x.unit === u);
    assert.equal(days.length, 1, u);
    assert.equal(D.questions[days[0].qid].type, u);
    assert.equal(D.questions[days[0].then].task, 'T1');
  }
  assert.equal(D.learn.length, 20);
  const ids = D.learn.flatMap((x) => [x.qid, x.then, ...(x.parts || [])]).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, '不重复用题');
});

test('按进度推进：完成一天才前进；模仿日有第二张图和 20/25 分钟', () => {
  const s = C.createState(D, 0);
  assert.equal(C.currentItem(s).qid, 'B2.2.9');
  assert.equal(C.minutesFor(C.resolve(s, D)), 25);
  C.entryFor(s, C.currentItem(s));
  assert.equal(s.cursor, 0);
  finish(s); finish(s);
  const real = C.resolve(s, D);
  assert.equal(real.item.qid, 'A13');
  assert.equal(C.minutesFor(real), 40);
  finish(s);
  const t1 = C.resolve(s, D);
  assert.equal(t1.kind, 'imitate');
  assert.equal(t1.then.id, 'B3.2.2');
  assert.match(t1.then.prompt, /\w/);
  assert.equal(C.minutesFor(t1), 20);
  assert.equal(C.phaseOf(s), 'learn');
});

test('预计完成日期跳过周日', () => {
  const s = C.createState(D, 0);
  const sat = new Date(2026, 0, 3, 20).getTime(); // 周六
  const d = C.estimateFinish(s, 'learn', sat);
  // 20 天：周六算 1，之后每周 6 天，跳过周日
  assert.notEqual(d.getDay(), 0);
  assert.ok((d - sat) / 86400000 >= 22);
});

test('模仿期结束 → 阶段总结 → 真题期（全部计时）+ 全真期；第二张图可整篇再写', () => {
  const s = C.createState(D, 0);
  while (C.currentItem(s)) {
    const it = C.currentItem(s);
    const weak = it.qid && ['discuss', 'report'].includes(D.questions[it.qid].type);
    finish(s, weak ? { task: 1, ideas: 1, develop: 2, language: 1 } : undefined, { errors: ['comma'], steal: it.kind === 'imitate' ? 'It is often argued that …' : '' });
  }
  assert.equal(C.phaseOf(s), 'review');
  const st = C.stats(s, D);
  assert.equal(st.steals, 14);
  assert.equal(JSON.stringify(C.suggestWeak(st).sort()), '["discuss","report"]');
  assert.equal(st.topErrors[0].id, 'comma');
  C.applyReview(s, D, ['discuss', 'line']);
  assert.equal(C.phaseOf(s), 'focus');
  const focus = s.queue.filter((q) => q.phase === 'focus');
  assert.equal(focus.length, 12);
  const qs = focus.filter((q) => q.kind === 'question');
  assert.ok(qs.every((q) => q.full && q.real));
  assert.ok(qs.some((q) => q.qid === 'B3.2.2'), '模仿期只写了开头概述的图，真题期整篇写');
  assert.ok(qs.filter((q) => ['discuss', 'line'].includes(D.questions[q.qid].type)).length >= 5);
  const learnIds = new Set(s.queue.filter((q) => q.phase === 'learn').flatMap((q) => [q.qid, ...(q.parts || [])]));
  assert.ok(qs.every((q) => !learnIds.has(q.qid)), '不重复出题');
  assert.equal(s.queue.filter((q) => q.phase === 'mock' && q.kind === 'mockBook').length, 3);
});

test('提示词带英文题目、6–6.5 目标；模仿日注明是仿写；旧版记录换成新题单但保留设置', () => {
  const s = C.createState(D, 0);
  const entry = { draft: 'Tax is necessary for public services.', topErrors: ['逗号连句'] };
  const p = C.buildPrompt(C.resolve(s, D), entry, D);
  assert.match(p, /6–6\.5/);
  assert.match(p, /keep all the money/);
  assert.match(p, /6 词/);
  assert.match(p, /仿写/);
  assert.match(p, /逗号连句/);
  const back = C.importJSON(C.exportJSON(s), D);
  assert.equal(back.queue.length, s.queue.length);
  assert.throws(() => C.importJSON('{"foo":1}', D));
  const old = C.normalize({ v: 1, queue: [{ id: 'E01' }], cursor: 3, entries: {}, settings: { pdfOffset: 12, theme: 'dark' }, prompts: { x: 'y' } }, D);
  assert.equal(old.v, 2);
  assert.equal(old.cursor, 0);
  assert.equal(old.queue[0].phase, 'learn');
  assert.equal(old.settings.pdfOffset, 12);
  assert.equal(old.prompts, undefined);
});
