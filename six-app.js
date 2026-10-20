/* 每日一题 · 界面 */
(() => {
  'use strict';
  const D = window.SIX_DATA, C = window.SixCore;
  const $ = (id) => document.getElementById(id);
  const view = $('view');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PHASE = { learn: '模仿期', focus: '真题期', mock: '全真期', free: '自由练', review: '阶段总结' };
  const UNIT = (u) => (u === 'stage' ? '阶段全真' : D.types[u] ? D.types[u].label + '单元' : '');
  const RATE = [[1, '差很多', 'lo'], [2, '接近', 'mid'], [3, '差不多', 'hi']];

  let state = load();
  let ui = { justDone: null, weakPick: null, lookupQ: '' };
  let ticker = null, saveTimer = null;

  function load() {
    try { return C.normalize(JSON.parse(localStorage.getItem(C.STORAGE_KEY) || 'null'), D) || C.createState(D); }
    catch { return C.createState(D); }
  }
  function save() {
    try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('浏览器不允许保存，记得在设置里导出备份。'); }
  }
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.append(t); setTimeout(() => t.remove(), 2200);
  }

  const pg = (p) => `p.${p}<span class="muted">（PDF ${C.pdf(state, p)}）</span>`;
  const typeLabel = (t) => (D.types[t] ? D.types[t].label : t);
  const errLabel = (id) => (D.errors.find((e) => e.id === id) || { label: id }).label;
  const pointOf = (q, n) => { const key = q.task === 'T1' ? 'T' + n : String(n); const p = D.points[key]; return p ? { key, no: n, task: p[0], page: p[1], hint: p[2] } : null; };
  const fmtDate = (d) => d ? `${d.getMonth() + 1} 月 ${d.getDate()} 日` : '—';
  const mmss = (sec) => { const a = Math.abs(Math.round(sec)); return `${sec < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`; };

  /* ---------- 路由 ---------- */
  function route() {
    const [tab, arg] = decodeURIComponent((location.hash || '#today').slice(1)).split('/');
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    stopTicker();
    if (tab === 'drill') renderDrill(arg);
    else if (tab === 'log') renderLog();
    else if (tab === 'lookup') renderLookup();
    else renderToday();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- 今日 ---------- */
  function intro(phase, item) {
    const base = phase === 'review' ? 'learn' : phase;
    const prog = C.phaseProgress(state, base);
    const st = C.stats(state, D);
    const idx = item ? state.queue.filter((q) => q.phase === phase).indexOf(item) + 1 : prog.total;
    const notes = {
      learn: item ? unitNote(item) : '',
      focus: `不看书、计时写，六成时间练你的弱项：${(state.review?.weakTypes || []).map(typeLabel).join('、')}。`,
      mock: '60 分钟全真：Task 1 20 分钟 + Task 2 40 分钟。',
      free: '题单做完了，继续每天一题。',
      review: '模仿期结束。花 15 分钟回顾句型卡、看清强项和弱项，再进入真题期。'
    };
    const list = state.queue.filter((q) => q.phase === base);
    const segs = list.map((q, i) => `<i class="${state.entries[q.id]?.status === 'done' ? 'done' : q === item ? 'now' : ''}${i && q.unit && q.unit !== list[i - 1].unit ? ' gap' : ''}" title="${esc(UNIT(q.unit))}"></i>`).join('');
    const est = item ? C.estimateFinish(state, phase) : null;
    return `
      <section class="intro">
        <div><p class="eyebrow">One question a day</p>
          <h1>${PHASE[phase]}${item ? ` · 第 ${idx} / ${prog.total} ${phase === 'learn' ? '天' : '题'}` : ''}</h1>
          <p class="intro-note">${notes[phase]}</p></div>
        <div class="stats">
          <div><span class="stat-num">${st.done}</span><span class="stat-label">已完成</span></div>
          <div><span class="stat-num">${est ? fmtDate(est) : '—'}</span><span class="stat-label">按每周 6 ${base === 'learn' ? '天' : '题'}，本阶段完成</span></div>
          <div><span class="stat-num">${st.steals}</span><span class="stat-label">攒下的句型</span></div>
        </div>
      </section>
      <div class="track" aria-hidden="true">${segs}</div>`;
  }

  function unitNote(item) {
    const list = state.queue.filter((q) => q.phase === 'learn' && q.unit === item.unit);
    const day = list.indexOf(item) + 1;
    const what = item.kind === 'mock' ? '大小作文连写 60 分钟，检验这一阶段' : item.kind === 'question' ? '真题日：40 分钟计时，不看书，写完交给 AI 批改' : item.then ? '模仿一张图，再用第二张图写开头和概述' : item.less ? '再模仿一篇，这次尽量少看范文' : '跟着书上的思路和范文，模仿着写';
    return `<b>${UNIT(item.unit)}</b>${list.length > 1 ? ` · 第 ${day} / ${list.length} 天` : ''} · ${what}`;
  }

  function renderToday() {
    const phase = C.phaseOf(state);
    if (ui.justDone) return renderDone();
    if (phase === 'review') return renderReview();
    const item = C.currentItem(state);
    if (!item) return renderFree();
    const r = C.resolve(state, D, item);
    if (item.kind === 'rewrite' && !item.of && r.source) { item.of = r.source.id; save(); }
    const e = C.entryFor(state, item);
    const sunday = new Date().getDay() === 0 && e.step === 1 && !e.draft;
    const imit = item.kind === 'imitate';
    const steps = imit ? ['见题', '学思路', '仿写', '对照'] : ['见题', '写', '对答案', '记录'];
    view.innerHTML = intro(phase, item) +
      (sunday ? '<p class="notice">今天周日，按计划休息。想练也可以，不会打乱进度。</p>' : '') +
      `<section class="card" aria-label="今日一题">
        <ol class="steps">${steps.map((s, i) => `<li class="${e.step === i + 1 ? 'on' : e.step > i + 1 ? 'done' : ''}"><b>${e.step > i + 1 ? '✓' : i + 1}</b><span>${s}</span></li>`).join('')}</ol>
        <div id="step"></div>
      </section>`;
    const host = $('step');
    if (r.kind === 'rewrite' && !r.source) return stepNoRewrite(host, item);
    (imit ? [stepSee, stepPlan, stepImitate, stepCompare] : [stepSee, stepWrite, stepCheck, stepLog])[e.step - 1](host, r, e);
  }

  function goStep(e, n) { e.step = n; save(); renderToday(); }

  function promptBlock(q) {
    if (!q) return '';
    const text = q.prompt
      ? `<p class="prompt" lang="en">${esc(q.prompt)}</p>`
      : `<p class="prompt muted" style="font-family:inherit;font-size:16px">${esc(q.title)} · 打开书 ${pg(q.q)}，只看题目这一段。</p>`;
    return text +
      (q.task === 'T1' ? `<div class="book-ref">📖 <div>图在书上 ${pg(q.q)}。只看图和题目。</div></div>` : '');
  }

  function stepNoRewrite(host, item) {
    host.innerHTML = `<p>这一阶段还没有可以重写的题（要先完成至少一道题）。</p><div class="actions"><span></span><button class="primary-button" id="skip">跳过，进入下一题</button></div>`;
    $('skip').onclick = () => { C.complete(state, item); save(); renderToday(); };
  }

  /* ① 见题 */
  function stepSee(host, r, e) {
    const item = r.item;
    let head = '', body = '';
    if (r.kind === 'imitate') {
      const q = r.question;
      head = `<div class="meta"><span><span class="tag">${q.task}</span> ${esc(q.section)} · ${esc(q.title)}</span><span>题目在书 ${pg(q.q)}</span></div>`;
      body = promptBlock(q) +
        `<span class="label">先猜一下：这是什么题型？<span>猜错没关系，下一步看书上的解析</span></span>
        <div class="chips" id="judge">${Object.entries(D.types).filter(([, t]) => t.task === q.task).map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${e.judgedType === k}">${t.label}</button>`).join('')}</div>`;
      host.innerHTML = head + body + `<div class="actions"><span class="hint">这一步 1–2 分钟就够。</span><button class="primary-button" id="go">下一步：学思路 →</button></div>`;
      host.querySelectorAll('#judge .chip').forEach((b) => b.onclick = () => { e.judgedType = b.dataset.v; save(); host.querySelectorAll('#judge .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); });
      $('go').onclick = () => goStep(e, 2);
      return;
    }
    if (r.kind === 'question') {
      const q = r.question;
      head = `<div class="meta"><span><span class="tag">${q.task}</span> ${esc(q.section)}${item.real ? ' · <span class="tag amber">真题 · 不看书</span>' : ''}${item.full ? ` · <span class="tag amber">整篇 ${q.task === 'T1' ? 20 : 40}′</span>` : ''}</span><span>题目在书 ${pg(q.q)}</span></div>`;
      body = promptBlock(q) +
        `<div class="book-ref">⚠️ <div>解析、翻译和范文就在题目后面几页。<b>写完之前别往后翻。</b></div></div>
        <span class="label">你判断这是什么题型？<span>先自己判断，对答案时揭晓</span></span>
        <div class="chips" id="judge">${Object.entries(D.types).filter(([, t]) => t.task === q.task).map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${e.judgedType === k}">${t.label}</button>`).join('')}</div>` +
        (q.task === 'T2' ? `<label class="label" for="stance">一句话：你的立场 + 题目确定的是 A 还是 C<span>写不出来也没关系，写个大概</span></label><input type="text" id="stance" value="${esc(e.stance || '')}" placeholder="例：部分同意。题目确定 A＝……，要往后想它带来的结果。">` : '');
    } else if (r.kind === 'rewrite') {
      const q = r.question;
      head = `<div class="meta"><span><span class="tag amber">重写</span> ${esc(q.section)} · ${typeLabel(q.type)}</span><span>题目在书 ${pg(q.q)}</span></div>`;
      body = `<p class="hint">这是上一轮里自评最低的一题：<b>${esc(q.title)}</b>。不看上次写的，重新写一遍，写完再对比。</p>` + promptBlock(q);
    } else if (r.kind === 'mock') {
      head = `<div class="meta"><span><span class="tag red">全真 60′</span> Task 1 + Task 2</span><span></span></div>`;
      body = r.questions.map((q, i) => `<span class="label">${i ? 'Task 2 · 建议 40 分钟' : 'Task 1 · 建议 20 分钟'} <span>${esc(q.section)} · 题目在书 ${pg(q.q)}</span></span>` + promptBlock(q)).join('');
    } else if (r.kind === 'mockBook') {
      head = `<div class="meta"><span><span class="tag red">全真 60′</span> ${esc(r.mock.title)}</span><span></span></div>`;
      body = `<div class="book-ref">📖 <div>题目在书上 ${pg(r.mock.page)}，Task 1 和 Task 2 各一道。<b>只看题目，别看后面的范文。</b></div></div>`;
    }
    const canLight = r.kind === 'question' || r.kind === 'rewrite';
    const mins = e.light ? 15 : C.minutesFor(r);
    host.innerHTML = head + body + `
      <div class="actions">
        ${canLight ? `<label class="toggle"><input type="checkbox" id="light" ${e.light ? 'checked' : ''}>累了？15 分钟版（只写开头 + 一个主体段）</label>` : '<span></span>'}
        <button class="primary-button" id="go">开始写 · ${mins} 分钟 →</button>
      </div><p class="hint" id="need" hidden>先选一个题型再开始。</p>`;
    host.querySelectorAll('#judge .chip').forEach((b) => b.onclick = () => { e.judgedType = b.dataset.v; save(); host.querySelectorAll('#judge .chip').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('need').hidden = true; });
    if ($('stance')) $('stance').oninput = (ev) => { e.stance = ev.target.value; saveSoon(); };
    if ($('light')) $('light').onchange = (ev) => { e.light = ev.target.checked; save(); renderToday(); };
    $('go').onclick = () => {
      if (r.kind === 'question' && !e.judgedType) { $('need').hidden = false; return; }
      e.timer = { total: mins * 60, used: e.timer?.used || 0, running: true };
      goStep(e, 2);
    };
  }

  /* 模仿 ② 学思路 */
  const PLAN = {
    T2: [['stance', '立场 / 回答', '例：部分同意。题目确定 A＝不交税，要往后想它带来的结果。'], ['s1', '主体段 1 的中心句', '可以照抄或改写书上的「可以选择的观点」'], ['s2', '主体段 2 的中心句', '']],
    T1: [['overview', '概述要写的 2 个主要特征', '例：总量上升；公路一直最多。'], ['groups', '主体段怎么分组', '例：上升的一组 / 下降的一组'], ['tense', '时态', '例：过去时；有预测部分用 is expected to']]
  };
  function planBox(q, e) {
    const rows = PLAN[q.task].filter(([k]) => e.plan && e.plan[k]);
    return rows.length ? `<div class="pane plan">${rows.map(([k, l]) => `<div><span class="muted">${l}：</span>${esc(e.plan[k])}</div>`).join('')}</div>` : '';
  }
  function pointsBlock(q) {
    const pts = q.points.map((n) => pointOf(q, n)).filter(Boolean);
    return pts.length ? `<ul class="points">${pts.map((p) => `<li><b>${p.task === 'T1' ? 'T1 ' : ''}要点 ${p.no}</b> ${esc(p.hint)} <span class="pg">${pg(p.page)}</span></li>`).join('')}</ul>` : '';
  }
  function stepPlan(host, r, e) {
    const q = r.question;
    e.plan = e.plan || {};
    const ok = e.judgedType === q.type;
    const verdict = e.judgedType ? `<div class="verdict ${ok ? '' : 'miss'}"><span class="ic">${ok ? '✓' : '!'}</span><div>你猜：<b>${typeLabel(e.judgedType)}</b> · 书上：<b>${typeLabel(q.type)}</b>${ok ? '。猜对了。' : '。读解析时留意：是哪个字眼决定了题型。'}</div></div>` : `<div class="verdict"><span class="ic">i</span><div>这是 <b>${typeLabel(q.type)}</b>。</div></div>`;
    const reads = q.task === 'T2'
      ? [['「题目解析」：题型、题目确定的 A / C、要回答什么', q.q], ['「可以选择的观点」和「学生的观点点评」：哪些观点能用，哪些会跑题', q.q]]
      : [['「思路提示」：时态、描述对象、怎么分段、概述写什么', q.q], ['范文的第一句和概述段：看它怎么改写题目、挑哪 2 个特征', q.a]];
    host.innerHTML = verdict + `
      <h3 class="sub">翻书读思路 <span class="muted" style="font-weight:400">约 10 分钟 · 这次可以看，看懂了再写</span></h3>
      <ol class="keylist">${reads.map(([w, p]) => `<li><span>${w}</span><span class="pg">${pg(p)}</span></li>`).join('')}</ol>
      <h3 class="sub">今天的知识点</h3>${pointsBlock(q)}
      <h3 class="sub">把思路写成骨架 <span class="muted" style="font-weight:400">照抄书上的也行，仿写时会显示在作文框上面</span></h3>
      ${PLAN[q.task].map(([k, l, ph]) => `<label class="label" for="plan-${k}">${l}</label><input type="text" id="plan-${k}" value="${esc(e.plan[k] || '')}" placeholder="${esc(ph)}">`).join('')}
      <div class="actions"><button class="secondary-button" id="back">← 回去看题</button><button class="primary-button" id="go">开始仿写 · ${C.minutesFor(r)} 分钟 →</button></div>`;
    PLAN[q.task].forEach(([k]) => { $('plan-' + k).oninput = (ev) => { e.plan[k] = ev.target.value; saveSoon(); }; });
    $('back').onclick = () => goStep(e, 1);
    $('go').onclick = () => { save(); e.timer = { total: C.minutesFor(r) * 60, used: e.timer?.used || 0, running: true }; goStep(e, 3); };
  }

  /* 模仿 ③ 仿写 */
  function stepImitate(host, r, e) {
    const q = r.question, t2 = r.then;
    e.timer = e.timer || { total: C.minutesFor(r) * 60, used: 0, running: true };
    const how = r.item.less
      ? `今天<b>尽量少看范文</b>：按你的骨架先写，卡住超过 2 分钟，再看一眼书上 ${pg(q.a)} 范文对应的那一段。`
      : `把书翻到 ${pg(q.a)} 的<b>${esc(q.aLabel)}</b>放在旁边，一段一段跟着写：<b>${q.task === 'T1' ? '结构和顺序照搬，句子换成你自己的说法' : '结构照搬，观点和句子换成你自己的'}</b>。`;
    host.innerHTML = `
      <div class="book-ref">📖 <div>${how}</div></div>
      <details class="peek"><summary>再看一眼题目</summary><p class="prompt" lang="en" style="font-size:16px">${esc(q.prompt)}</p></details>
      ${planBox(q, e)}
      <div class="writebar">
        <div class="timer"><span class="clock" id="clock">0:00</span><button class="secondary-button" id="pause"></button></div>
        <span class="wc" id="wc"></span>
      </div>
      <textarea id="draft" class="essay" lang="en" spellcheck="false" placeholder="照着范文的结构写你自己的版本。">${esc(e.draft || '')}</textarea>
      ${t2 ? `<h3 class="sub">第二张图：只写开头段 + 概述 <span class="muted" style="font-weight:400">${esc(t2.title)} · 图在书 ${pg(t2.q)} · 不看它的范文</span></h3>
      <p class="prompt" lang="en" style="font-size:15px">${esc(t2.prompt)}</p>
      <span class="label">开头 + 概述<span class="wc" id="draft2-wc"></span></span>
      <textarea id="draft2" class="essay short" lang="en" spellcheck="false" placeholder="用刚才学到的写法：改写题目一句 + 概述两个主要特征。">${esc(e.draft2 || '')}</textarea>` : ''}
      <div class="actions"><button class="secondary-button" id="back">← 回去改骨架</button><button class="primary-button" id="done">写完了，去对照 →</button></div>`;
    const target = q.task === 'T1' ? '目标 150+ 词' : '目标 250+ 词';
    const upd = () => {
      const left = e.timer.total - e.timer.used;
      $('clock').textContent = mmss(left); $('clock').classList.toggle('over', left < 0);
      $('pause').textContent = e.timer.running ? '暂停' : '继续';
      $('wc').textContent = `${C.wordCount(e.draft)} 词 · ${target}`;
      if ($('draft2-wc')) $('draft2-wc').textContent = `${C.wordCount(e.draft2)} 词 · 约 50–70`;
    };
    upd();
    $('pause').onclick = () => { e.timer.running = !e.timer.running; save(); upd(); };
    host.querySelectorAll('textarea').forEach((x) => x.oninput = () => { e[x.id] = x.value; upd(); saveSoon(); });
    startTicker(() => { if (e.timer.running) { e.timer.used += 1; e.writeSeconds = e.timer.used; upd(); if (e.timer.used % 5 === 0) save(); } });
    $('back').onclick = () => { e.timer.running = false; stopTicker(); goStep(e, 2); };
    $('done').onclick = () => {
      if (!C.wordCount(e.draft)) { toast('先写一点再对照。'); return; }
      e.timer.running = false; e.writeSeconds = e.timer.used; stopTicker(); goStep(e, 4);
    };
    setTimeout(() => $('draft')?.focus(), 30);
  }

  /* 模仿 ④ 对照 */
  function stepCompare(host, r, e) {
    const q = r.question, t2 = r.then;
    const pts = q.points.map((n) => pointOf(q, n)).filter(Boolean);
    const rows = [
      [`<b>${esc(q.aLabel)}</b>：逐段对比——每段的作用一样吗？中心句有没有写出来？`, q.a],
      [q.task === 'T2' ? '「翻译范例」：挑 2 句你刚才写不顺的意思，遮住英文中译英' : '「翻译范例」：挑 2 句数据句，遮住英文中译英', q.t || q.q + 1],
      ['「考官评语」：只看一句，知道范文好在哪', q.c || q.a + 1]
    ];
    if (t2) rows.push([`第二张图的范文：只对比开头段和概述`, t2.a]);
    host.innerHTML = `
      <h3 class="sub">翻书对照 <span class="muted" style="font-weight:400">约 8 分钟</span></h3>
      <ol class="keylist">${rows.map(([w, p]) => `<li><span>${w}</span><span class="pg">${pg(p)}</span></li>`).join('')}</ol>
      <label class="label" for="steal">从范文里偷一个句型<span>以后能套用的结构，挖空具体内容</span></label>
      <textarea id="steal" class="note" lang="en" placeholder="例：Another benefit of … is that it can …">${esc(e.steal || '')}</textarea>
      <label class="label" for="chunks">今天收的词块<span>一行一个：中文 = English，会进「练习」里的「我的词块」</span></label>
      <textarea id="chunks" class="note" placeholder="可支配收入 = disposable income">${esc(e.chunks || '')}</textarea>
      <span class="label">今天真正弄懂的知识点<span>最多 2 条</span></span>
      <div class="chips" id="learn">${pts.map((p) => `<button class="chip" data-v="${p.key}" aria-pressed="${e.learned.includes(p.key)}" title="${esc(p.hint)}">${p.task === 'T1' ? 'T1 ' : ''}要点 ${p.no}<small>p.${p.page}</small></button>`).join('')}</div>
      <h3 class="sub">6 分门槛自查 <span class="muted" style="font-weight:400">在你的作文里找到了就点亮 · 原书 p.197–198</span></h3>
      <div class="chips" id="gate">${D.errors.filter((x) => x.gate).map((x) => `<button class="chip gate" data-v="${x.id}" aria-pressed="${e.errors.includes(x.id)}">${x.label}</button>`).join('')}</div>
      <details class="peek"><summary>想让 AI 看看你仿写得对不对（可选）</summary>
        <div class="settings-actions"><button class="secondary-button" id="copy">复制 AI 批改提示词</button></div>
        <label class="label" for="ai">把 AI 的批改贴在这里</label>
        <textarea id="ai" class="note" placeholder="可留空">${esc(e.aiFeedback || '')}</textarea>
      </details>
      <div class="actions"><button class="secondary-button" id="back">← 回去改作文</button><button class="primary-button" id="finish">完成今天 ✓</button></div>`;
    $('steal').oninput = (ev) => { e.steal = ev.target.value; saveSoon(); };
    $('chunks').oninput = (ev) => { e.chunks = ev.target.value; saveSoon(); };
    host.querySelectorAll('#learn .chip').forEach((b) => b.onclick = () => toggleIn(e.learned, b.dataset.v, b, 2));
    host.querySelectorAll('#gate .chip').forEach((b) => b.onclick = () => toggleIn(e.errors, b.dataset.v, b));
    const topIds = C.stats(state, D).topErrors.map((x) => errLabel(x.id));
    $('copy').onclick = () => copy(C.buildPrompt(r, { ...e, topErrors: topIds }, D));
    $('ai').oninput = (ev) => { e.aiFeedback = ev.target.value; saveSoon(); };
    $('back').onclick = () => { if (e.timer) e.timer.running = false; goStep(e, 3); };
    $('finish').onclick = () => { save(); C.complete(state, r.item); save(); ui.justDone = r.item.id; renderToday(); };
  }

  /* ② 写 */
  function stepWrite(host, r, e) {
    const isMock = r.kind === 'mock' || r.kind === 'mockBook';
    const q = r.question;
    const target = e.light ? '目标 120+ 词（开头 + 一段）' : q && q.task === 'T1' ? '目标 150+ 词' : '目标 250+ 词';
    e.timer = e.timer || { total: C.minutesFor(r) * 60, used: 0, running: true };
    const area = (id, val, label, cls) => `${label ? `<span class="label">${label}<span class="wc" id="${id}-wc"></span></span>` : ''}<textarea id="${id}" class="essay ${cls || ''}" lang="en" spellcheck="false" placeholder="直接写，不查书、不查词。">${esc(val)}</textarea>`;
    host.innerHTML = `
      <div class="writebar">
        <div class="timer"><span class="clock" id="clock">0:00</span><button class="secondary-button" id="pause"></button></div>
        <span class="wc" id="wc"></span>
      </div>
      ${!isMock && q && q.prompt ? `<details class="peek"><summary>再看一眼题目</summary><p class="prompt" lang="en" style="font-size:16px">${esc(q.prompt)}</p></details>` : ''}
      ${isMock ? area('draft1', e.draft1 || '', 'Task 1', 'short') + area('draft', e.draft || '', 'Task 2') : area('draft', e.draft || '')}
      <div class="actions"><span class="hint">自动保存。时间到了可以继续写，超时会标红。</span><button class="primary-button" id="done">写完了，对答案 →</button></div>`;
    const upd = () => {
      const left = e.timer.total - e.timer.used;
      $('clock').textContent = mmss(left); $('clock').classList.toggle('over', left < 0);
      $('pause').textContent = e.timer.running ? '暂停' : '继续';
      if (isMock) { $('draft1-wc').textContent = `${C.wordCount(e.draft1)} 词 · 目标 150+`; $('draft-wc').textContent = `${C.wordCount(e.draft)} 词 · 目标 250+`; $('wc').textContent = ''; }
      else $('wc').textContent = `${C.wordCount(e.draft)} 词 · ${target}`;
    };
    upd();
    $('pause').onclick = () => { e.timer.running = !e.timer.running; save(); upd(); };
    host.querySelectorAll('textarea').forEach((t) => t.oninput = () => { e[t.id] = t.value; upd(); saveSoon(); });
    startTicker(() => { if (e.timer.running) { e.timer.used += 1; e.writeSeconds = e.timer.used; upd(); if (e.timer.used % 5 === 0) save(); } });
    $('done').onclick = () => {
      if (!C.wordCount(e.draft) && !C.wordCount(e.draft1)) { toast('先写一点再对答案。'); return; }
      e.timer.running = false; e.writeSeconds = e.timer.used; stopTicker(); goStep(e, 3);
    };
    setTimeout(() => host.querySelector('textarea')?.focus(), 30);
  }

  function answerKey(r) {
    const rows = [];
    const add = (what, page) => rows.push(`<li><span>${what}</span><span class="pg">${page ? pg(page) : ''}</span></li>`);
    const forQ = (q) => {
      if (q.source === 'abc') {
        add('「解析」：题型、确定的 A / C、合适与错误的观点', q.q);
        add('作文本身没有书上范文，用下面的 AI 提示词批改');
      } else if (q.task === 'T2') {
        add('「题目解析」：对照你判断的题型和 A / C', q.q);
        add('「可以选择的观点」和「学生的观点点评」：你的观点有没有跑题、空泛、拿例子当观点？', q.q);
        add('「翻译范例」：挑 3 句你刚才写不出来的意思，中译英，遮住答案', q.t || q.q + 1);
        add(`<b>${esc(q.aLabel)}</b> + 批注：只和这一篇比`, q.a);
        add('「考官评语和评分」：只看 TR、CC 各一句', q.c || q.a + 2);
      } else {
        add('「思路提示」：时态、描述对象、分段、总结', q.q);
        add('「翻译范例」：重点看开头段和概述段', q.t || q.q + 1);
        add(`<b>${esc(q.aLabel)}</b>`, q.a);
        add('「考官评语」：只看 TA 一句', q.c || q.a + 1);
      }
    };
    if (r.kind === 'mockBook') { add(`书上的范文就在题目后面`, r.mock.page); add('再用 AI 提示词各批一次（T1、T2 分开贴）'); }
    else (r.questions || [r.question]).filter(Boolean).forEach(forQ);
    return `<ol class="keylist">${rows.join('')}</ol>`;
  }

  /* ③ 对答案 */
  function stepCheck(host, r, e) {
    const q = r.question;
    const task = q ? q.task : 'T2';
    let verdict = '';
    if (r.kind === 'question') {
      const ok = e.judgedType === q.type;
      verdict = `<div class="verdict ${ok ? '' : 'miss'}"><span class="ic">${ok ? '✓' : '!'}</span><div>你判断：<b>${typeLabel(e.judgedType)}</b> · 书上：<b>${typeLabel(q.type)}</b>${ok ? '。判断对了。' : `。先看 ${pg(q.q)} 的「题目解析」，找出是哪个字眼决定了题型。`}</div></div>`;
    }
    const compare = r.kind === 'rewrite' && r.previous ? `<h3 class="sub">和上次对比</h3><div class="two"><div class="pane"><h4>上次</h4>${esc(r.previous.draft)}</div><div class="pane"><h4>这次</h4>${esc(e.draft)}</div></div>` : '';
    host.innerHTML = verdict + compare + `
      <h3 class="sub">翻书对答案</h3>${answerKey(r)}
      <h3 class="sub">和 6–6.5 分范文比，你差多少？</h3>
      <div class="rating">${D.dims[task].map(([k, l]) => `<span>${l}</span><div class="seg" data-k="${k}">${RATE.map(([v, t, c]) => `<button class="${c}" data-v="${v}" aria-pressed="${e.ratings[k] === v}">${t}</button>`).join('')}</div>`).join('')}</div>
      <h3 class="sub">6 分门槛自查 <span class="muted" style="font-weight:400">在作文里找到了就点亮 · 原书 p.197–198</span></h3>
      <div class="chips" id="gate">${D.errors.filter((x) => x.gate).map((x) => `<button class="chip gate" data-v="${x.id}" aria-pressed="${e.errors.includes(x.id)}">${x.label}</button>`).join('')}</div>
      <h3 class="sub">AI 批改${r.item.real || r.kind === 'mock' || r.kind === 'mockBook' ? ' <span class="tag amber">建议做</span>' : '（可选）'}</h3>
      <div class="settings-actions"><button class="secondary-button" id="copy">复制 AI 批改提示词</button></div>
      <details class="peek"><summary>预览提示词</summary><div class="pane" id="prompt-preview"></div></details>
      <label class="label" for="ai">把 AI 的批改贴在这里<span>方便以后在记录里回看</span></label>
      <textarea id="ai" class="note" placeholder="可留空">${esc(e.aiFeedback || '')}</textarea>
      <div class="actions"><button class="secondary-button" id="back">← 回去改作文</button><button class="primary-button" id="next">下一步：记录 →</button></div>
      <p class="hint" id="need" hidden>先完成上面 4 项自评。</p>`;
    host.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.onclick = () => {
      e.ratings[seg.dataset.k] = Number(b.dataset.v); save();
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    }));
    host.querySelectorAll('#gate .chip').forEach((b) => b.onclick = () => toggleIn(e.errors, b.dataset.v, b));
    const topIds = C.stats(state, D).topErrors.map((x) => errLabel(x.id));
    const prompt = () => {
      const parts = r.kind === 'mock' || r.kind === 'mockBook' ? '（全真：Task 1 和 Task 2 请分开贴给 AI）\n\n' : '';
      return parts + C.buildPrompt(r, { ...e, topErrors: topIds }, D);
    };
    $('prompt-preview').textContent = prompt();
    $('copy').onclick = () => copy(prompt());
    $('ai').oninput = (ev) => { e.aiFeedback = ev.target.value; saveSoon(); };
    $('back').onclick = () => { e.timer.running = false; goStep(e, 2); };
    $('next').onclick = () => {
      const need = D.dims[task].some(([k]) => !e.ratings[k]);
      if (need) { $('need').hidden = false; return; }
      goStep(e, 4);
    };
  }

  function toggleIn(arr, v, btn, max) {
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
    else { if (max && arr.length >= max) { toast(`最多 ${max} 条，挑最重要的。`); return; } arr.push(v); }
    btn.setAttribute('aria-pressed', i < 0); save();
  }

  /* ④ 记录 */
  function stepLog(host, r, e) {
    const qs = (r.questions || [r.question]).filter(Boolean);
    const task = qs.some((q) => q.task === 'T1') ? (qs.length > 1 ? 'both' : 'T1') : 'T2';
    const pts = qs.flatMap((q) => q.points.map((n) => pointOf(q, n))).filter(Boolean);
    const errs = D.errors.filter((x) => !x.task || task !== 'T2');
    host.innerHTML = `
      <span class="label">今天卡在哪？<span>可多选</span></span>
      <div class="chips" id="stuck">${D.stuck.map((s) => `<button class="chip" data-v="${s}" aria-pressed="${e.stuck.includes(s)}">${s}</button>`).join('')}</div>
      <span class="label">今天学到的规则<span>最多 2 条 · 和这道题有关的要点</span></span>
      <div class="chips" id="learn">${pts.map((p) => `<button class="chip" data-v="${p.key}" aria-pressed="${e.learned.includes(p.key)}" title="${esc(p.hint)}">${p.task === 'T1' ? 'T1 ' : ''}要点 ${p.no}<small>p.${p.page}</small></button>`).join('') || '<span class="muted">（这类题没有指定要点，去「速查」找）</span>'}</div>
      <div id="learn-hints" class="hint"></div>
      <input type="text" id="learn-note" value="${esc(e.learnNote || '')}" placeholder="用自己的话写一句：下次遇到这种题，我要……" style="margin-top:10px">
      <span class="label">错误标签<span>下次交稿前优先查这些</span></span>
      <div class="chips" id="errs">${errs.map((x) => `<button class="chip ${x.gate ? 'gate' : ''}" data-v="${x.id}" aria-pressed="${e.errors.includes(x.id)}">${x.label}<small>p.${x.page}</small></button>`).join('')}</div>
      <div class="actions"><button class="secondary-button" id="back">← 上一步</button><button class="primary-button" id="finish">完成今天这题 ✓</button></div>`;
    const hints = () => { $('learn-hints').innerHTML = e.learned.map((k) => { const p = D.points[k]; return p ? `· ${p[0] === 'T1' ? 'T1 ' : ''}要点 ${k.replace('T', '')}（${pg(p[1])}）：${esc(p[2])}` : ''; }).join('<br>'); };
    hints();
    host.querySelectorAll('#stuck .chip').forEach((b) => b.onclick = () => toggleIn(e.stuck, b.dataset.v, b));
    host.querySelectorAll('#learn .chip').forEach((b) => b.onclick = () => { toggleIn(e.learned, b.dataset.v, b, 2); hints(); });
    host.querySelectorAll('#errs .chip').forEach((b) => b.onclick = () => toggleIn(e.errors, b.dataset.v, b));
    $('learn-note').oninput = (ev) => { e.learnNote = ev.target.value; saveSoon(); };
    $('back').onclick = () => goStep(e, 3);
    $('finish').onclick = () => { C.complete(state, r.item); save(); ui.justDone = r.item.id; renderToday(); };
  }

  function nextLabel() {
    const n = C.currentItem(state);
    if (!n) return C.phaseOf(state) === 'review' ? '阶段总结（15 分钟）：回顾句型卡，选出弱项' : '题单做完了';
    if (n.kind === 'rewrite') return '重写这一轮自评最低的一题';
    if (n.kind === 'mock' || n.kind === 'mockBook') return '60 分钟全真';
    const q = D.questions[n.qid];
    if (n.kind === 'imitate') return `${typeLabel(q.type)} · ${n.then ? '模仿一张图 + 第二张图写开头和概述' : n.less ? '再模仿一篇（少看范文）' : '跟着范文模仿'}`;
    return `${typeLabel(q.type)} · 真题（${q.task === 'T1' ? 20 : 40} 分钟，不看书）`;
  }

  function renderDone() {
    const it = state.queue.find((q) => q.id === ui.justDone);
    const e = state.entries[ui.justDone] || {};
    const words = C.wordCount(e.draft) + C.wordCount(e.draft1);
    const phase = C.phaseOf(state);
    view.innerHTML = intro(phase === 'review' ? 'review' : (C.currentItem(state)?.phase || it.phase), C.currentItem(state)) + `
      <section class="card done-card">
        <div class="done-mark">✓</div>
        <h2>今天这题完成了</h2>
        <p>写了 ${Math.round((e.writeSeconds || 0) / 60)} 分钟 · ${words + C.wordCount(e.draft2)} 词${e.steal ? ' · 攒下 1 个句型' : ''} · 记下 ${e.learned?.length || 0} 个知识点、${e.errors?.length || 0} 个错误标签</p>
        ${unitEnd(it)}
        ${drillLink(it, e)}
        <div class="next"><span class="muted">下一次：</span>${esc(nextLabel())}</div>
        <div class="actions" style="justify-content:center"><a class="secondary-button" href="#log">看记录</a><button class="primary-button" id="more">${phase === 'review' ? '去做阶段总结 →' : '再做一题 →'}</button></div>
        <p class="hint">太累就到此为止。明天打开，直接从下一题开始，不用补。</p>
      </section>`;
    $('more').onclick = () => { ui.justDone = null; renderToday(); };
    if ($('to-drill')) $('to-drill').onclick = () => { ui.justDone = null; };
  }

  function drillLink(it, e) {
    const n = (it && DR.packs[it.qid] ? DR.packs[it.qid].items.length : 0);
    const m = C.parseChunks(e.chunks).length;
    if (!n && !m) return '';
    return `<p style="margin:16px 0 0"><a class="primary-button" id="to-drill" href="#drill/${n ? esc(it.qid) : 'mine'}">做今天的练习（${n || m} 题）→</a></p>`;
  }

  function unitEnd(it) {
    const n = C.currentItem(state);
    if (!it || it.phase !== 'learn' || !it.unit || (n && n.unit === it.unit)) return '';
    return it.unit === 'stage' ? '' : `<p class="notice" style="margin:12px 0 0">🎉 ${UNIT(it.unit)}完成。</p>`;
  }

  function stealsBlock() {
    const list = state.queue.map((q) => ({ q, e: state.entries[q.id] })).filter(({ e }) => e && e.steal && e.steal.trim());
    if (!list.length) return '<p class="muted">还没有句型。模仿日的「对照」一步会让你从范文里偷一个。</p>';
    return `<ol class="steals">${list.map(({ q, e }) => { const qq = D.questions[q.qid]; return `<li><span lang="en">${esc(e.steal)}</span><span class="muted">${qq ? esc(typeLabel(qq.type) + ' · ' + qq.title) : ''}</span></li>`; }).join('')}</ol>`;
  }

  /* ---------- 统计 / 阶段总结 ---------- */
  function statsBlock(st) {
    const types = st.types.slice().sort((a, b) => (a.avg ?? 9) - (b.avg ?? 9));
    const maxErr = Math.max(1, ...st.topErrors.map((x) => x.n));
    const stuck = Object.entries(st.stuckCount).sort((a, b) => b[1] - a[1]);
    return `
      <div class="grid3">
        <div class="kpi"><b>${st.done}</b><span>完成的题</span></div>
        <div class="kpi"><b>${st.judgeRate == null ? '—' : Math.round(st.judgeRate * 100) + '%'}</b><span>题型判断正确率（${st.judged} 题）</span></div>
        <div class="kpi"><b>${st.avgWriteMin == null ? '—' : Math.round(st.avgWriteMin) + ' 分'}</b><span>平均写作时间</span></div>
      </div>
      <h3 class="sub">各题型自评 <span class="muted" style="font-weight:400">和 6–6.5 分范文比，满分 3</span></h3>
      <div class="bars">${types.map((t) => `<div class="bar"><span>${typeLabel(t.type)} <span class="muted">×${t.n}</span></span><span class="b"><i style="width:${((t.avg || 0) / 3) * 100}%"></i></span><span class="n">${t.avg == null ? '—' : t.avg.toFixed(1)}</span></div>`).join('') || '<p class="muted">还没有数据。</p>'}</div>
      <h3 class="sub">错误前 5 名</h3>
      <div class="bars">${st.topErrors.map((x) => { const d = D.errors.find((y) => y.id === x.id) || {}; return `<div class="bar err"><span>${esc(d.label || x.id)} <span class="muted">p.${d.page}</span></span><span class="b"><i style="width:${(x.n / maxErr) * 100}%"></i></span><span class="n">${x.n} 次</span></div>`; }).join('') || '<p class="muted">还没有错误标签。</p>'}</div>
      ${stuck.length ? `<h3 class="sub">最常卡在</h3><div class="chips">${stuck.map(([k, n]) => `<span class="tag">${esc(k)} ×${n}</span>`).join('')}</div>` : ''}`;
  }

  function renderReview() {
    const st = C.stats(state, D);
    if (!ui.weakPick) ui.weakPick = C.suggestWeak(st);
    view.innerHTML = intro('review', null) + `
      <section class="card">
        <h2 class="sec">阶段总结：模仿期结束</h2>
        <h3 class="sub">你攒下的句型 <span class="muted" style="font-weight:400">读一遍，真题期直接用</span></h3>
        ${stealsBlock()}
        <h3 class="sub">强项和弱项</h3>
        <p class="hint">自评来自 5 个大作文真题日（模仿日不打分，小作文按你自己的感觉选）。系统先帮你选了自评最低的两种题型，可以改。</p>
        ${statsBlock(st)}
        <h3 class="sub">真题期重点练（选 2 个）</h3>
        <div class="chips" id="weak">${Object.entries(D.types).map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${ui.weakPick.includes(k)}">${t.task} ${t.label}</button>`).join('')}</div>
        <p class="hint">真题期每周 6 次，全部计时、不看书：4 次练这两种题型，1 次换别的题型，1 次重写。之后进入 3 套全真。交稿前只查你的「错误前 5 名」。</p>
        <div class="actions"><span></span><button class="primary-button" id="gen">生成真题期题单 →</button></div>
      </section>`;
    view.querySelectorAll('#weak .chip').forEach((b) => b.onclick = () => toggleIn(ui.weakPick, b.dataset.v, b, 2));
    $('gen').onclick = () => {
      if (!ui.weakPick.length) { toast('至少选 1 种题型。'); return; }
      C.applyReview(state, D, ui.weakPick); save(); ui.weakPick = null; toast('已生成真题期题单'); renderToday();
    };
  }

  function renderFree() {
    view.innerHTML = intro('free', null) + `
      <section class="card done-card"><div class="done-mark">★</div><h2>题单全部完成</h2>
      <p>继续保持每天一题。下面会从书里还没写过的题里再补 6 道。</p>
      <div class="actions" style="justify-content:center"><button class="primary-button" id="add">再来 6 题 →</button></div></section>`;
    $('add').onclick = () => {
      const used = new Set(state.queue.flatMap((q) => [q.qid, ...(q.parts || [])]).filter(Boolean));
      const pool = Object.keys(D.questions).filter((id) => !used.has(id));
      if (!pool.length) { toast('书里的题都写过了，可以从头再写一轮。'); return; }
      const weak = state.review?.weakTypes || [];
      pool.sort((a, b) => (weak.includes(D.questions[b].type) ? 1 : 0) - (weak.includes(D.questions[a].type) ? 1 : 0));
      pool.slice(0, 5).forEach((qid) => state.queue.push({ kind: 'question', qid, id: 'X' + (state.queue.length + 1), phase: 'free' }));
      state.queue.push({ kind: 'rewrite', id: 'X' + (state.queue.length + 1), phase: 'free' });
      save(); renderToday();
    };
  }

  /* ---------- 记录 ---------- */
  function renderLog() {
    const st = C.stats(state, D);
    const done = state.queue.filter((q) => state.entries[q.id]?.status === 'done').reverse();
    const item = (it) => {
      const e = state.entries[it.id];
      const r = C.resolve(state, D, it);
      const title = r.kind === 'mockBook' ? r.mock.title : r.kind === 'mock' ? '全真 60′：' + r.questions.map((q) => q.title).join(' + ') : r.question ? (r.kind === 'rewrite' ? '重写：' : r.kind === 'imitate' ? '模仿：' : '') + r.question.title : '重写';
      const sc = C.ratingScore(e);
      const dots = sc == null ? '' : '●'.repeat(Math.round(sc)) + '○'.repeat(3 - Math.round(sc));
      const d = new Date(e.finishedAt);
      return `<div class="log-item">
        <div class="log-head"><b>${esc(title)}</b><span class="muted" style="font-size:12px">${d.getMonth() + 1}/${d.getDate()} · ${Math.round((e.writeSeconds || 0) / 60)} 分 · ${C.wordCount(e.draft) + C.wordCount(e.draft1)} 词 <span class="dots" title="自评">${dots}</span></span></div>
        <div class="log-meta">${r.question && r.kind !== 'mock' ? `<span class="tag">${typeLabel(r.question.type)}</span>` : ''}${e.judgedType && r.question ? `<span class="tag ${e.judgedType === r.question.type ? 'green' : 'red'}">判断${e.judgedType === r.question.type ? '对' : '错'}</span>` : ''}${e.light ? '<span class="tag amber">15 分钟版</span>' : ''}${(e.errors || []).map((x) => `<span class="tag red">${esc(errLabel(x))}</span>`).join('')}${(e.learned || []).map((k) => `<span class="tag green">要点 ${esc(k.replace('T', 'T1-'))}</span>`).join('')}</div>
        ${e.learnNote ? `<p class="hint">✎ ${esc(e.learnNote)}</p>` : ''}${e.steal ? `<p class="hint" lang="en">★ ${esc(e.steal)}</p>` : ''}
        <details><summary>看作文${e.aiFeedback ? '和 AI 批改' : ''}</summary>${e.draft1 ? `<div class="pane">${esc(e.draft1)}</div>` : ''}<div class="pane">${esc(e.draft || '')}</div>${e.draft2 ? `<div class="pane">${esc(e.draft2)}</div>` : ''}${e.aiFeedback ? `<div class="pane" style="font-family:inherit">${esc(e.aiFeedback)}</div>` : ''}</details>
      </div>`;
    };
    view.innerHTML = `
      <section class="intro"><div><p class="eyebrow">Your record</p><h1>记录</h1><p class="intro-note">模仿期结束时，这一页会告诉你该练什么。</p></div></section>
      <section class="card">${statsBlock(st)}</section>
      <section class="card"><h2 class="sec">我的句型卡</h2>${stealsBlock()}</section>
      <section class="card"><h2 class="sec">写过的题</h2>${done.length ? done.map(item).join('') : '<p class="muted">还没有完成的题。去「今日」写第一题。</p>'}</section>`;
  }

  /* ---------- 练习（词块默写 / 句型填空 / 选择题） ---------- */
  const DR = window.SIX_DRILLS || { packs: {} };
  const KIND = { chunk: '词块默写', cloze: '句型填空', choice: '选择' };

  function drillSources() {
    const packs = Object.entries(DR.packs).map(([id, p]) => ({ id, label: p.title }));
    return [...packs, { id: 'mine', label: '我的词块' }, { id: 'wrong', label: '错题' }, { id: 'all', label: '全部' }]
      .map((x) => ({ ...x, items: C.drillItems(state, D, DR, x.id) }));
  }
  const srcLabel = (id) => (DR.packs[id] ? DR.packs[id].title : { mine: '我的词块', wrong: '错题', all: '全部' }[id] || id);
  const answerText = (x) => x.type === 'chunk' ? C.alts(x.en)[0] : x.type === 'cloze' ? C.clozeParts(x.text).full : x.opts[x.a];

  function renderDrill(arg) {
    const valid = (id) => DR.packs[id] || ['mine', 'wrong', 'all'].includes(id);
    if (arg && valid(arg) && (!ui.drill || ui.drill.source !== arg || ui.drill.over)) return startRound(arg);
    if (ui.drill && !ui.drill.over) return drawQuestion();
    drillHome(ui.drillSrc || Object.keys(DR.packs)[0] || 'mine');
  }

  function drillHome(sel) {
    ui.drill = null; ui.drillSrc = sel;
    const srcs = drillSources();
    const cur = srcs.find((x) => x.id === sel) || srcs[0];
    const st = C.drillStats(state, srcs.find((x) => x.id === 'all').items);
    const mine = srcs.find((x) => x.id === 'mine').items;
    const kinds = Object.keys(KIND).map((k) => [k, cur.items.filter((x) => x.type === k).length]).filter(([, n]) => n);
    view.innerHTML = `
      <section class="intro">
        <div><p class="eyebrow">Drill</p><h1>练习</h1><p class="intro-note">做完一天的题，把读题、ABC、句型和词块练熟。每轮 10 题，约 5 分钟。</p></div>
        <div class="stats">
          <div><span class="stat-num">${st.total}</span><span class="stat-label">题库</span></div>
          <div><span class="stat-num">${st.mastered}</span><span class="stat-label">已掌握（连对 2 次）</span></div>
          <div><span class="stat-num">${st.wrong}</span><span class="stat-label">错题</span></div>
        </div>
      </section>
      <section class="card">
        <span class="label" style="margin-top:0">练哪些</span>
        <div class="chips" id="srcs">${srcs.map((x) => `<button class="chip" data-v="${esc(x.id)}" aria-pressed="${x.id === cur.id}">${esc(x.label)}<small>${x.items.length}</small></button>`).join('')}</div>
        <p class="hint">${kinds.length ? kinds.map(([k, n]) => `${KIND[k]} ${n}`).join(' · ') : cur.id === 'mine' ? '还没有自己的词块：在模仿日「对照」一步，按「中文 = English」一行一个记下来。' : cur.id === 'wrong' ? '没有错题 👍' : '这里还没有题。'}</p>
        ${DR.packs[cur.id]?.note ? `<p class="hint" lang="en">${esc(DR.packs[cur.id].note)}</p>` : ''}
        <div class="actions"><span class="hint" style="margin:0">回车 = 核对 / 下一题。错的题本轮最后再出一次。</span><button class="primary-button" id="go" ${cur.items.length ? '' : 'disabled'}>开始一轮（${Math.min(10, cur.items.length)} 题）→</button></div>
        ${mine.length ? `<details class="peek"><summary>我的词块（${mine.length}）</summary><ul class="hint">${mine.map((x) => `<li>${esc(x.zh)} = <span lang="en">${esc(x.en)}</span>${x.from ? ` <span class="muted">· ${esc(x.from)}</span>` : ''}</li>`).join('')}</ul></details>` : ''}
      </section>`;
    view.querySelectorAll('#srcs .chip').forEach((b) => b.onclick = () => drillHome(b.dataset.v));
    $('go').onclick = () => startRound(cur.id);
  }

  function startRound(source, onlyIds) {
    let items = C.drillItems(state, D, DR, source);
    if (onlyIds) items = items.filter((x) => onlyIds.includes(x.id));
    const round = onlyIds ? C.shuffle(items) : C.buildRound(items, state, 10);
    if (!round.length) return drillHome(source);
    ui.drillSrc = source;
    ui.drill = { source, list: round, i: 0, shown: false, first: {}, retried: {}, prev: {}, over: false };
    if (location.hash !== '#drill/' + source) history.replaceState(null, '', '#drill/' + source);
    drawQuestion();
  }

  function drawQuestion() {
    const R = ui.drill, x = R.list[R.i];
    if (!x) return drillEnd();
    const isRetry = R.list.indexOf(x) !== R.i;
    let body = '';
    if (x.type === 'chunk') body = `<p class="drill-zh">${esc(x.zh)}</p><input type="text" id="ans" lang="en" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="英文">`;
    else if (x.type === 'cloze') {
      const { parts, blanks } = C.clozeParts(x.text);
      body = `<p class="hint" style="font-size:14px">${esc(x.zh)}</p><p class="drill-sent" lang="en">${parts.map((p, i) => esc(p) + (blanks[i] ? `<input type="text" class="blank" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:${Math.max(5, blanks[i][0].length + 3)}ch" aria-label="第 ${i + 1} 空">` : '')).join('')}</p>`;
    } else {
      R.order = R.order && R.order.id === x.id ? R.order : { id: x.id, idx: C.shuffle(x.opts.map((_, i) => i)) };
      body = `<p class="drill-q">${esc(x.q)}</p><div class="opts">${R.order.idx.map((i, k) => `<button class="opt" data-i="${i}"><b>${'ABCD'[k]}</b><span>${esc(x.opts[i])}</span></button>`).join('')}</div>`;
    }
    view.innerHTML = `
      <section class="intro"><div><p class="eyebrow">Drill · ${esc(srcLabel(R.source))}</p><h1>第 ${R.i + 1} / ${R.list.length} 题</h1></div></section>
      <div class="track" aria-hidden="true">${R.list.map((y, k) => `<i class="${k < R.i ? 'done' : k === R.i ? 'now' : ''}"></i>`).join('')}</div>
      <section class="card drill">
        <div class="meta"><span><span class="tag">${KIND[x.type]}</span>${x.tag ? ` <span class="tag">${esc(x.tag)}</span>` : ''}${isRetry ? ' <span class="tag amber">再来一次</span>' : ''}</span><button class="text-button" id="quit">结束这轮</button></div>
        ${body}
        <div id="verdict"></div>
        <div class="actions"><span></span><span class="settings-actions"><button class="secondary-button" id="override" hidden>我写的也对，算对</button><button class="primary-button" id="check">${x.type === 'choice' ? '选一个' : '核对'}</button></span></div>
      </section>`;
    const inputs = [...view.querySelectorAll('#ans, .blank')];
    if (inputs[0]) inputs[0].focus();
    inputs.forEach((el, k) => el.onkeydown = (ev) => {
      if (ev.key !== 'Enter' || ev.isComposing) return;
      ev.preventDefault();
      const nextEmpty = inputs.slice(k + 1).find((y) => !y.value.trim());
      if (el.value.trim() && nextEmpty) return nextEmpty.focus();
      check();
    });
    view.querySelectorAll('.opt').forEach((b) => b.onclick = () => { if (!R.shown) check(Number(b.dataset.i)); });
    if (x.type === 'choice') $('check').disabled = true;
    $('check').onclick = () => (R.shown ? next() : check());
    $('quit').onclick = () => drillEnd(true);
    $('override').onclick = () => {
      if (R.first[x.id] === false && R.i === R.list.indexOf(x)) { state.drill[x.id] = R.prev[x.id]; if (!state.drill[x.id]) delete state.drill[x.id]; C.recordDrill(state, x.id, true); R.first[x.id] = true; }
      if (R.retried[x.id] && R.list.lastIndexOf(x) > R.i) { R.list.splice(R.list.lastIndexOf(x), 1); delete R.retried[x.id]; }
      save(); next();
    };

    function check(pick) {
      if (R.shown) return;
      const given = x.type === 'choice' ? pick : x.type === 'cloze' ? inputs.map((el) => el.value) : inputs[0].value;
      if (x.type !== 'choice' && !(Array.isArray(given) ? given.some((g) => g.trim()) : String(given).trim())) return inputs[0].focus();
      const res = C.checkAnswer(x, given);
      R.shown = true;
      const firstTime = !(x.id in R.first);
      if (firstTime) { R.first[x.id] = res.ok; R.prev[x.id] = state.drill[x.id] ? { ...state.drill[x.id] } : null; C.recordDrill(state, x.id, res.ok); save(); }
      if (!res.ok && !R.retried[x.id]) { R.retried[x.id] = true; R.list.push(x); }
      inputs.forEach((el, k) => { el.disabled = true; if (res.per) el.classList.add(res.per[k] ? 'ok' : 'bad'); else el.classList.add(res.ok ? 'ok' : 'bad'); });
      view.querySelectorAll('.opt').forEach((b) => { b.disabled = true; const i = Number(b.dataset.i); if (i === x.a) b.classList.add('right'); else if (i === pick) b.classList.add('wrong'); });
      let extra = '';
      if (x.type === 'chunk') { const a = C.alts(x.en); extra = `<b lang="en">${esc(a[0])}</b>${a.length > 1 ? `<br><span class="muted">也可以：<span lang="en">${a.slice(1).map(esc).join(' / ')}</span></span>` : ''}`; }
      else if (x.type === 'cloze') extra = `<span lang="en">${esc(C.clozeParts(x.text).full)}</span>`;
      else extra = esc(x.why || '');
      $('verdict').innerHTML = `<div class="verdict ${res.ok ? '' : 'miss'}" style="margin-top:18px"><span class="ic">${res.ok ? '✓' : '×'}</span><div>${res.ok ? '对了' : x.type === 'choice' ? `正确答案：${esc(x.opts[x.a])}` : '正确答案'}${extra ? '<br>' + extra : ''}${!res.ok && R.retried[x.id] && R.list.lastIndexOf(x) > R.i ? '<br><span class="muted">这题本轮最后再出一次。</span>' : ''}</div></div>`;
      $('override').hidden = res.ok || x.type === 'choice';
      $('check').disabled = false;
      $('check').textContent = R.i + 1 < R.list.length ? '下一题 →' : '看结果';
      $('check').focus();
    }
    function next() { R.i += 1; R.shown = false; drawQuestion(); }
  }

  document.addEventListener('keydown', (ev) => {
    const R = ui.drill;
    if (!R || R.over || R.shown || !location.hash.startsWith('#drill') || ev.target.matches('input,textarea')) return;
    const k = 'abcd'.indexOf(ev.key.toLowerCase()), n = '1234'.indexOf(ev.key);
    const b = view.querySelectorAll('.opt')[k >= 0 ? k : n];
    if (b) { ev.preventDefault(); b.click(); }
  });

  function drillEnd(quit) {
    const R = ui.drill;
    R.over = true;
    const ids = Object.keys(R.first);
    const wrong = R.list.filter((x, k) => R.list.indexOf(x) === k && R.first[x.id] === false);
    const okN = ids.length - wrong.length;
    view.innerHTML = `
      <section class="intro"><div><p class="eyebrow">Drill · ${esc(srcLabel(R.source))}</p><h1>${quit ? '这轮先到这里' : '这一轮做完了'}</h1></div></section>
      <section class="card done-card">
        <div class="done-mark"${wrong.length ? ' style="font-size:16px"' : ''}>${wrong.length ? okN + '/' + ids.length : '✓'}</div>
        <h2>${ids.length ? `${okN} / ${ids.length} 一次答对` : '还没做题'}</h2>
        ${wrong.length ? `<p>这些已经进了「错题」，下次优先出：</p><ol class="steals" style="text-align:left">${wrong.map((x) => `<li><span>${esc(x.type === 'chunk' ? x.zh : x.type === 'cloze' ? x.zh : x.q)}</span><span class="muted" lang="en">${esc(answerText(x))}</span></li>`).join('')}</ol>` : ids.length ? '<p>全对。连对两次的题算掌握，之后会少出。</p>' : ''}
        <div class="actions" style="justify-content:center">${wrong.length ? `<button class="secondary-button" id="redo">只练这 ${wrong.length} 题</button>` : ''}<button class="secondary-button" id="home">换一组</button><button class="primary-button" id="again">再来一轮 →</button></div>
      </section>`;
    if ($('redo')) $('redo').onclick = () => startRound(R.source === 'wrong' ? 'all' : R.source, wrong.map((x) => x.id));
    $('home').onclick = () => { history.replaceState(null, '', '#drill'); drillHome(R.source); };
    $('again').onclick = () => startRound(R.source);
  }

  /* ---------- 速查 ---------- */
  function renderLookup() {
    const skip = ['第 4 章书信 p.309–342、附录 20：学术类不考', '所有 7+、9 分范文：只看不背', '要点 1–10（考试规则）：已经会了', '附录 10 机考 p.391：报机考再看'];
    view.innerHTML = `
      <section class="intro"><div><p class="eyebrow">Look it up</p><h1>卡住了查哪页</h1><p class="intro-note">遇到问题才查，不用提前读。</p></div></section>
      <section class="card">
        <input type="text" id="q" class="search" placeholder="搜：观点、开头、语法、要点 43……" value="${esc(ui.lookupQ)}">
        <table class="look"><thead><tr><th>卡在哪</th><th>查什么</th><th>书页</th></tr></thead><tbody id="look-rows"></tbody></table>
        <h3 class="sub">要点速览 <span class="muted" style="font-weight:400">提示是概括，以原书为准</span></h3>
        <table class="look"><tbody id="point-rows"></tbody></table>
        <h3 class="sub">不用碰的部分</h3>
        <ul class="hint">${skip.map((s) => `<li>${s}</li>`).join('')}</ul>
      </section>`;
    const draw = () => {
      const k = ui.lookupQ.trim().toLowerCase();
      const hit = (s) => !k || s.toLowerCase().includes(k);
      $('look-rows').innerHTML = D.lookup.filter((r) => hit(r[0] + r[1])).map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="pg">${pg(r[2])}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">没有匹配</td></tr>';
      $('point-rows').innerHTML = Object.entries(D.points).filter(([n, p]) => hit(`要点 ${n.replace('T', '')} ${p[0]} ${p[2]}`)).map(([n, p]) => `<tr><td style="white-space:nowrap">${p[0]} 要点 ${n.replace('T', '')}</td><td>${esc(p[2])}</td><td class="pg">${pg(p[1])}</td></tr>`).join('');
    };
    draw();
    $('q').oninput = (ev) => { ui.lookupQ = ev.target.value; draw(); };
  }

  /* ---------- 工具 ---------- */
  function startTicker(fn) { stopTicker(); ticker = setInterval(fn, 1000); }
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('已复制，粘贴到 ChatGPT 等 AI 里'); }
    catch {
      const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select();
      try { document.execCommand('copy'); toast('已复制'); } catch { toast('复制失败，请手动选中预览里的文字'); }
      t.remove();
    }
  }

  /* ---------- 主题 / 设置 ---------- */
  function applyTheme() {
    let choice = state.settings.theme;
    if (!choice) { try { choice = localStorage.getItem('ielts100.theme.v1'); } catch {} }
    const dark = (['dark', 'light'].includes(choice) ? choice : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('theme-toggle').innerHTML = dark ? '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' : '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    $('theme-toggle').setAttribute('aria-label', dark ? '切换日间模式' : '切换夜间模式');
  }
  $('theme-toggle').onclick = () => { state.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };

  const dlg = $('settings');
  const msg = (t, err) => { const m = $('settings-message'); m.hidden = false; m.textContent = t; m.classList.toggle('error', !!err); };
  $('settings-open').onclick = () => { $('pdf-offset').value = state.settings.pdfOffset; $('settings-message').hidden = true; dlg.showModal(); };
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', route);
  $('pdf-offset').oninput = (ev) => { const v = parseInt(ev.target.value, 10); if (Number.isFinite(v)) { state.settings.pdfOffset = v; save(); } };
  $('export').onclick = () => {
    const blob = new Blob([C.exportJSON(state)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ielts6-记录-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    msg('已导出。');
  };
  $('import').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { state = C.importJSON(await f.text(), D); save(); applyTheme(); dirty = true; msg('已导入。'); }
    catch (err) { msg(err.message || '导入失败', true); }
    ev.target.value = '';
  };
  let dirty = false;
  dlg.addEventListener('close', () => { if (dirty) { dirty = false; route(); } });
  $('reset').onclick = () => {
    if (!confirm('清空「每日一题」的全部记录？（100句的进度不受影响）')) return;
    const theme = state.settings.theme; state = C.createState(D); state.settings.theme = theme; save(); ui = { justDone: null, weakPick: null, lookupQ: '' }; dirty = true; msg('已清空。');
  };

  applyTheme();
  route();
})();
