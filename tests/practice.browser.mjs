import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765/',url=new URL('practice.html',base).href;
const outDir=new URL('../.qa/',import.meta.url);await mkdir(outDir,{recursive:true});
const out=fileURLToPath(outDir).replace(/\/$/,'');
const b = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
const errors = [];
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
// 公开仓库不含题目原文：先显示书页指引
if (!(await p.textContent('main')).includes('只看题目这一段')) throw new Error('无原文时应提示打开书');
// 可选：本机原文包（不进仓库）
if (process.env.PROMPTS_FILE) {
  await p.click('#settings-open');
  await p.setInputFiles('#import-prompts', process.env.PROMPTS_FILE);
  await p.waitForFunction(() => !document.getElementById('settings-message').hidden);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  if (!(await p.textContent('main')).includes('keep all the money')) throw new Error('导入原文后应显示题目');
}
// ① 见题
await p.click('#go'); // 未选题型 → 提示
if (!(await p.isVisible('#need'))) throw new Error('未选题型应提示');
await p.click('#judge .chip[data-v="opinion"]');
await p.fill('#stance', '部分同意：税收用于公共服务，但税率应合理。确定 A＝不交税。');
await shot('01-see');
await p.click('#go');
// ② 写
const essay = `It is often argued that people should keep all the money they earn instead of paying tax to the state. While I understand this view, I believe that taxation is necessary for a society to function well.

Taxes allow governments to provide public services that individuals cannot afford alone. For example, roads, hospitals and schools are built with public money, and everyone benefits from them, including those who earn high incomes. If nobody paid tax, these services would collapse, the quality of life would decline.

However, high taxes may reduce people's motivation to work hard. When a large part of their salary are taken away, some workers feel that extra effort is not rewarded.`;
await p.fill('#draft', essay);
await p.waitForTimeout(2300);
await shot('02-write');
await p.click('#done');
// ③ 对答案
for (const [k, v] of [['task', 3], ['ideas', 2], ['develop', 2], ['language', 1]]) await p.click(`.seg[data-k="${k}"] button[data-v="${v}"]`);
await p.click('#gate .chip[data-v="comma"]');
await p.click('#gate .chip[data-v="verb"]');
await shot('03-check');
await p.click('#next');
// ④ 记录
await p.click('#stuck .chip[data-v="段落展开"]');
await p.click('#learn .chip[data-v="32"]');
await p.fill('#learn-note', '题目有 should：支持要说好处，反对要说坏处或别的办法更好。');
await shot('04-log');
await p.click('#finish');
await shot('05-done');
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('ielts6.v1')));
if (st.cursor !== 1 || st.entries.E01.status !== 'done' || !st.entries.E01.errors.includes('comma')) throw new Error('状态未保存');
if (await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('ielts100.') && k !== 'ielts100.theme.v1'))) throw new Error('碰了 ielts100.*');

// 模拟完成整个混乱期 → 复盘
await p.evaluate(() => {
  const D = window.SIX_DATA, C = window.SixCore;
  const s = JSON.parse(localStorage.getItem('ielts6.v1'));
  const rate = { opinion: 2.5, line: 2, advdis: 2.25, discuss: 1.25, report: 1.5, bar: 2.5, mixed: 1.75, process: 2, map: 2 };
  const errs = [['comma', 'thin'], ['data'], ['verb', 'link'], ['comma', 'thin', 'vague'], [], ['comma', 'thin'], ['overview'], ['verb', 'offtopic'], ['noun'], ['comma'], [], ['comma', 'verb', 'thin']];
  let t = new Date(2026, 4, 12, 21).getTime();
  while (s.cursor < s.queue.length) {
    const it = s.queue[s.cursor];
    const q = it.qid ? D.questions[it.qid] : null;
    const v = q ? rate[q.type] : 2;
    const e = C.entryFor(s, it, t);
    Object.assign(e, { status: 'done', step: 4, finishedAt: t, draft: 'Sample essay text for the record.', writeSeconds: 1500 + s.cursor * 37, ratings: { task: Math.round(v), ideas: Math.floor(v), develop: Math.ceil(v) > 3 ? 3 : Math.ceil(v), language: Math.round(v) }, errors: errs[s.cursor] || [], stuck: s.cursor % 3 ? ['段落展开'] : ['想观点'], learned: [] });
    if (q) e.judgedType = s.cursor === 3 || s.cursor === 7 ? 'opinion' : q.type;
    if (it.kind === 'rewrite') it.of = 'E04';
    s.cursor += 1; t += 86400000 * (new Date(t).getDay() === 6 ? 2 : 1);
  }
  localStorage.setItem('ielts6.v1', JSON.stringify(s));
});
await p.reload();
await shot('06-review');
await p.click('#gen');
await p.waitForTimeout(200);
const s2 = await p.evaluate(() => JSON.parse(localStorage.getItem('ielts6.v1')));
if (!s2.review || s2.queue.length <= 12) throw new Error('未生成针对期');
await shot('07-focus-today');
await p.goto(url + '#log'); await p.waitForTimeout(150);
await shot('08-log');
await p.goto(url + '#lookup'); await p.fill('#q', '观点'); await p.waitForTimeout(100);
await shot('09-lookup');
await p.close();

// 手机 · 夜间
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'dark' });
const mp = await m.newPage();
mp.on('pageerror', (e) => errors.push(e.message));
await mp.goto(url);
await mp.screenshot({ path: `${out}/practice-10-mobile-dark.png`, fullPage: false });
await mp.close();
await b.close();
if (errors.length) { console.error('页面错误：', errors); process.exit(1); }
console.log('flow ok'); process.exit(0);
