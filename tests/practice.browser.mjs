import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765/',url=new URL('practice.html',base).href;
const outDir=new URL('../.qa/',import.meta.url);await mkdir(outDir,{recursive:true});
const out=fileURLToPath(outDir).replace(/\/$/,'');
const b = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const errors = [];
const fail = (m) => { throw new Error(m); };
const ctx = await b.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
p.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && errors.push(`${r.status()} ${r.url()}`));
await p.addInitScript(() => { const D = Date; Date.now = () => new D(2026, 4, 11, 21).getTime(); });
await p.goto(url);
await p.evaluate(() => { localStorage.setItem('ielts100.theme.v1', 'light'); });
await p.reload();
const shot = (n) => p.screenshot({ path: `${out}/practice-${n}.png`, fullPage: true });
const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('ielts6.v1')));
const text = () => p.textContent('main');
const essay = `It is often argued that people should keep all the money they earn instead of paying tax to the state. While I understand this view, I believe that taxation is necessary for a society to function well.

Taxes allow governments to provide public services that individuals cannot afford alone. For example, roads, hospitals and schools are built with public money, and everyone benefits from them. If nobody paid tax, these services would collapse, the quality of life would decline.`;

// ===== 模仿日：见题 → 学思路 → 仿写 → 对照 =====
if (!(await text()).includes('keep all the money')) fail('一打开就应看到英文题目');
if (!(await text()).includes('观点类单元')) fail('应显示单元');
await p.click('#judge .chip[data-v="advdis"]');
await shot('01-see');
await p.click('#go');
if (!(await text()).includes('书上：观点类')) fail('学思路应揭晓题型');
if (!(await p.isVisible('.points li'))) fail('应显示今天的知识点');
await p.fill('#plan-stance', '部分同意：税收必要，但税率要合理。');
await p.fill('#plan-s1', 'Tax pays for public services such as roads and schools.');
await p.fill('#plan-s2', 'Tax can regulate behaviour, e.g. tobacco tax.');
await shot('02-plan');
await p.click('#go');
if (!(await p.textContent('.pane.plan')).includes('regulate behaviour')) fail('仿写时应显示骨架');
await p.fill('#draft', essay);
await p.waitForTimeout(2300);
await shot('03-imitate');
await p.click('#done');
await p.fill('#steal', 'Another benefit of … is that it can …');
await p.click('#learn .chip >> nth=0');
await p.click('#gate .chip[data-v="comma"]');
await shot('04-compare');
await p.click('#finish');
await shot('05-done');
let s = await st();
if (s.cursor !== 1 || s.entries.L01.status !== 'done' || s.entries.L01.steal !== 'Another benefit of … is that it can …' || !s.entries.L01.plan.s2) fail('模仿日状态未保存');
if (await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('ielts100.') && k !== 'ielts100.theme.v1'))) fail('碰了 ielts100.*');

// ===== 真题日（第 3 天）：见题 → 写 → 对答案 → 记录 =====
await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('ielts6.v1')); s.entries.L02 = { itemId: 'L02', status: 'done', step: 4, draft: 'x', errors: [], stuck: [], learned: [], ratings: {}, finishedAt: Date.now() }; s.cursor = 2; localStorage.setItem('ielts6.v1', JSON.stringify(s)); });
await p.reload();
if (!(await text()).includes('真题日')) fail('第 3 天应是真题日');
await p.click('#go');
if (!(await p.isVisible('#need'))) fail('真题日未选题型应提示');
await p.click('#judge .chip[data-v="opinion"]');
await p.click('#go');
await p.fill('#draft', essay);
await p.click('#done');
for (const [k, v] of [['task', 2], ['ideas', 2], ['develop', 1], ['language', 1]]) await p.click(`.seg[data-k="${k}"] button[data-v="${v}"]`);
await shot('06-real-check');
await p.click('#next');
await p.click('#finish');
s = await st();
if (s.cursor !== 3 || s.entries.L03.ratings.develop !== 1) fail('真题日未保存自评');

// ===== 小作文单元：模仿一张图 + 第二张图写开头和概述 =====
await p.click('#more');
if (!(await text()).includes('动态图单元')) fail('第 4 天应是动态图单元');
await p.click('#go');
await p.fill('#plan-overview', '总量上升；公路一直最多。');
await p.click('#go');
if (!(await p.isVisible('#draft2'))) fail('应有第二张图的开头 + 概述');
await p.fill('#draft', 'The line graph illustrates the amount of goods transported in the UK between 1974 and 2002.');
await p.fill('#draft2', 'The graph shows energy consumption in the USA. Overall, petrol and oil remain the largest source.');
await shot('07-t1-imitate');
await p.click('#done');
await p.click('#finish');
s = await st();
if (!s.entries.L04.draft2) fail('第二张图未保存');

// ===== 模拟走完模仿期 → 阶段总结 → 真题期 =====
await p.evaluate(() => {
  const D = window.SIX_DATA, C = window.SixCore;
  const s = JSON.parse(localStorage.getItem('ielts6.v1'));
  const rate = { opinion: 2.5, advdis: 2, discuss: 1.25, report: 1.5, mixed: 2 };
  let t = new Date(2026, 4, 15, 21).getTime();
  while (s.cursor < s.queue.length) {
    const it = s.queue[s.cursor];
    const q = it.qid ? D.questions[it.qid] : null;
    const e = C.entryFor(s, it, t);
    const v = q ? rate[q.type] || 2 : 2;
    Object.assign(e, { status: 'done', step: 4, finishedAt: t, draft: 'Sample essay text.', writeSeconds: 1500, errors: s.cursor % 2 ? ['comma'] : ['verb', 'comma'], stuck: [], learned: [], judgedType: q ? q.type : undefined,
      ratings: it.kind === 'imitate' ? {} : { task: Math.round(v), ideas: Math.floor(v), develop: Math.min(3, Math.ceil(v)), language: Math.round(v) },
      steal: it.kind === 'imitate' ? ['It is often argued that …', 'This is because …', 'A case in point is …'][s.cursor % 3] : '' });
    s.cursor += 1; t += 86400000 * (new Date(t).getDay() === 6 ? 2 : 1);
  }
  localStorage.setItem('ielts6.v1', JSON.stringify(s));
});
await p.reload();
if (!(await text()).includes('阶段总结')) fail('模仿期结束应进入阶段总结');
if ((await p.locator('.steals li').count()) < 10) fail('应列出攒下的句型');
await shot('08-review');
await p.click('#gen');
await p.waitForTimeout(200);
s = await st();
if (!s.review || s.queue.filter((q) => q.phase === 'focus').length !== 12) fail('未生成真题期');
if (!(await text()).includes('真题期')) fail('应进入真题期');
await shot('09-focus-today');
await p.goto(url + '#log'); await p.waitForTimeout(150);
await shot('10-log');
await p.goto(url + '#lookup'); await p.fill('#q', '观点'); await p.waitForTimeout(100);
await shot('11-lookup');
await p.close();

// 手机 · 夜间
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'dark' });
const mp = await m.newPage();
mp.on('pageerror', (e) => errors.push(e.message));
await mp.goto(url);
await mp.screenshot({ path: `${out}/practice-12-mobile-dark.png`, fullPage: false });
await mp.click('#go');
await mp.screenshot({ path: `${out}/practice-13-mobile-plan.png`, fullPage: true });
await mp.close();
await b.close();
if (errors.length) { console.error('页面错误：', errors); process.exit(1); }
console.log('practice flow ok'); process.exit(0);
