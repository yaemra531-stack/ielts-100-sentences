import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
for (const f of ['six-data.js', 'six-drills.js', 'six-core.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
const D = ctx.SIX_DATA, C = ctx.SixCore, DR = ctx.SIX_DRILLS;

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

test('练习：题库对应真实题目，答案格式能被核对', () => {
  for (const [qid, pack] of Object.entries(DR.packs)) {
    assert.ok(D.questions[qid], qid);
    const ids = new Set();
    for (const x of pack.items) {
      assert.ok(!ids.has(x.id), `重复 id ${x.id}`); ids.add(x.id);
      if (x.type === 'chunk') assert.ok(C.checkAnswer(x, C.alts(x.en)[0]).ok, x.id);
      else if (x.type === 'cloze') { const c = C.clozeParts(x.text); assert.ok(c.blanks.length, x.id); assert.ok(C.checkAnswer(x, c.blanks.map((b) => b[0])).ok, x.id); }
      else if (x.type === 'order') { assert.ok(x.steps.length >= 3 && x.q, x.id); assert.ok(C.checkAnswer(x, [...x.steps]).ok); assert.ok(!C.checkAnswer(x, [...x.steps].reverse()).ok); }
      else if (x.type === 'match') { assert.ok(x.pairs.length >= 3 && x.q, x.id); assert.equal(new Set(x.pairs.map((p) => p[1])).size, x.pairs.length, `${x.id} 右栏重复`); }
      else { assert.equal(x.type, 'choice', x.id); assert.ok(x.opts[x.a] && x.why, x.id); assert.ok(C.checkAnswer(x, x.a).ok); assert.ok(!C.checkAnswer(x, (x.a + 1) % x.opts.length).ok); }
    }
  }
});

test('练习：宽松核对、自录词块、出题顺序与错题', () => {
  const chunk = { id: 'k', type: 'chunk', en: 'travel to and from work / commute' };
  assert.ok(C.checkAnswer(chunk, '  Commute. ').ok);
  assert.ok(C.checkAnswer({ id: 'k2', type: 'chunk', en: 'low-income families' }, 'low income families').ok);
  assert.ok(!C.checkAnswer(chunk, '').ok);
  const cz = { id: 'z', type: 'cloze', text: 'If nobody {paid} tax, people {could} not afford it.' };
  assert.deepEqual([...C.checkAnswer(cz, ['paid', 'can']).per], [true, false]);
  assert.deepEqual([...C.parseChunks('1. 可支配收入 = disposable income\nfunction properly ＝ 正常运转\n没有等号的行\nfoo = bar').map((x) => x.en)], ['disposable income', 'function properly']);

  const s = C.createState(D);
  assert.equal(JSON.stringify(s.drill), '{}');
  const it = C.currentItem(s);
  C.entryFor(s, it).chunks = '税收收入 = tax revenue\n税收收入 = tax revenue\n经济增长 = economic growth';
  const mine = C.drillItems(s, D, DR, 'mine');
  assert.equal(mine.length, 2, '重复词块只算一次');
  const pack = C.drillItems(s, D, DR, 'B2.2.9');
  assert.equal(C.drillItems(s, D, DR, 'all').length, pack.length + 2);

  C.recordDrill(s, pack[0].id, true); C.recordDrill(s, pack[0].id, true);
  C.recordDrill(s, pack[1].id, false);
  assert.deepEqual([...C.drillItems(s, D, DR, 'wrong').map((x) => x.id)], [pack[1].id]);
  const round = C.buildRound(pack, s, 10, () => 0.5);
  assert.equal(round.length, 10);
  assert.equal(round[0].id, pack[1].id, '错题排最前');
  assert.ok(!round.some((x) => x.id === pack[0].id), '已掌握的排在没做过的后面');
  const st = C.drillStats(s, pack);
  assert.equal(st.mastered, 1); assert.equal(st.wrong, 1); assert.equal(st.seen, 2);
  C.recordDrill(s, pack[1].id, true);
  assert.equal(C.drillItems(s, D, DR, 'wrong').length, 0, '答对后移出错题');
  assert.equal(JSON.stringify(C.normalize({ ...s, drill: null }, D).drill), '{}');
});

test('练习：简单模式把词块合成配对、填空变点词；进阶模式要拼写', () => {
  const s = C.createState(D);
  const pool = C.drillItems(s, D, DR, 'B2.2.9');
  const chunks = pool.filter((x) => x.type === 'chunk');
  const cloze = pool.find((x) => x.type === 'cloze');
  const round = [...chunks.slice(0, 7), cloze, pool.find((x) => x.type === 'order'), pool.find((x) => x.type === 'match')];
  const easy = C.makeCards(round, pool, 'easy', () => 0.3);
  const kinds = easy.map((c) => c.kind);
  assert.equal(kinds.filter((k) => k === 'match').length, 3, '7 个词块 → 2 张配对 + 1 张题库配对');
  assert.ok(easy.filter((c) => c.kind === 'match' && c.items[0].type === 'chunk').every((c) => c.rows.length >= 3 && c.rows.length <= 5));
  assert.equal(easy.flatMap((c) => c.items).length, 10, '每道题都在卡片里');
  const bank = easy.find((c) => c.kind === 'bank');
  for (const b of C.clozeParts(cloze.text).blanks) assert.ok(bank.bank.includes(b[0]), '词库包含正确答案');
  assert.ok(bank.bank.length > C.clozeParts(cloze.text).blanks.length, '词库有干扰项');
  const pick = C.cardFor(chunks[0], pool, 'easy', () => 0.3);
  assert.equal(pick.kind, 'pick'); assert.equal(pick.opts.length, 4); assert.equal(pick.opts[pick.a], C.alts(chunks[0].en)[0]);
  assert.equal(new Set(pick.opts).size, 4);
  assert.deepEqual([...C.makeCards(chunks.slice(0, 2), pool, 'easy').map((c) => c.kind)], ['pick', 'pick'], '不到 3 个词块不配对');
  const hard = C.makeCards(round, pool, 'hard');
  assert.equal(hard.filter((c) => c.kind === 'type').length, 8);
  assert.ok(hard.some((c) => c.kind === 'order') && hard.some((c) => c.kind === 'match'));
});

test('练习：固定分组，题型均匀；下一组先做没做完的', () => {
  const s = C.createState(D);
  const pool = C.drillItems(s, D, DR, 'B2.2.9');
  const groups = C.drillGroups(pool);
  assert.equal(groups.length, Math.ceil(pool.length / 10));
  assert.equal(groups.flat().length, pool.length);
  const sizes = groups.map((g) => g.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, '每组题数差不多');
  for (const g of groups) assert.ok(new Set(g.map((x) => x.type)).size >= 3, '每组至少 3 种题型');
  assert.deepEqual(C.drillGroups(pool).map((g) => g.map((x) => x.id).join()), groups.map((g) => g.map((x) => x.id).join()), '分组固定');
  assert.equal(C.nextGroup(s, groups), 0);
  groups[0].forEach((x, i) => C.recordDrill(s, x.id, i > 0));
  assert.equal(C.groupStatus(s, groups[0]).state, 'done');
  assert.equal(C.nextGroup(s, groups), 1);
  C.recordDrill(s, groups[2][0].id, true);
  assert.equal(C.groupStatus(s, groups[2]).state, 'doing');
  groups.slice(1).flat().forEach((x) => C.recordDrill(s, x.id, true));
  assert.equal(C.nextGroup(s, groups), 0, '都做过后回到有错的组');
  C.recordDrill(s, groups[0][0].id, true);
  assert.equal(C.groupStatus(s, groups[0]).state, 'perfect');
  assert.equal(C.nextGroup(s, groups), null);
});
