/* 每日一题 · 界面 */
(() => {
  'use strict';
  const D = window.SIX_DATA, C = window.SixCore;
  const $ = (id) => document.getElementById(id);
  const view = $('view');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PHASE = { explore: '混乱期', focus: '针对期', mock: '全真期', free: '自由练', review: '复盘' };
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
    const tab = (location.hash || '#today').slice(1);
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    stopTicker();
    if (tab === 'log') renderLog();
    else if (tab === 'lookup') renderLookup();
    else renderToday();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- 今日 ---------- */
  function intro(phase, item) {
    const prog = C.phaseProgress(state, phase === 'review' ? 'explore' : phase);
    const st = C.stats(state, D);
    const idx = item ? state.queue.filter((q) => q.phase === phase).indexOf(item) + 1 : prog.total;
    const notes = {
      explore: '所有题型都打一遍，用记录找出自己的强项和弱项。',
      focus: `六成时间练你的弱项：${(state.review?.weakTypes || []).map(typeLabel).join('、')}。`,
      mock: '60 分钟全真：Task 1 20 分钟 + Task 2 40 分钟。',
      free: '题单做完了，继续每天一题。',
      review: '两周混乱期结束。花 15 分钟看清楚自己，再决定接下来练什么。'
    };
    const segs = state.queue.filter((q) => q.phase === (phase === 'review' ? 'explore' : phase))
      .map((q) => `<i class="${state.entries[q.id]?.status === 'done' ? 'done' : q === item ? 'now' : ''}"></i>`).join('');
    const est = item ? C.estimateFinish(state, phase) : null;
    return `
      <section class="intro">
        <div><p class="eyebrow">One question a day</p>
          <h1>${PHASE[phase]}${item ? ` · 第 ${idx} / ${prog.total} 题` : ''}</h1>
          <p class="intro-note">${notes[phase]}</p></div>
        <div class="stats">
          <div><span class="stat-num">${st.done}</span><span class="stat-label">已完成</span></div>
          <div><span class="stat-num">${est ? fmtDate(est) : '—'}</span><span class="stat-label">按每周 6 题，本阶段完成</span></div>
          <div><span class="stat-num">${st.judgeRate == null ? '—' : Math.round(st.judgeRate * 100) + '<small>%</small>'}</span><span class="stat-label">题型判断正确率</span></div>
        </div>
      </section>
      <div class="track" aria-hidden="true">${segs}</div>`;
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
    const steps = ['见题', '写', '对答案', '记录'];
    view.innerHTML = intro(phase, item) +
      (sunday ? '<p class="notice">今天周日，按计划休息。想练也可以，不会打乱进度。</p>' : '') +
      `<section class="card" aria-label="今日一题">
        <ol class="steps">${steps.map((s, i) => `<li class="${e.step === i + 1 ? 'on' : e.step > i + 1 ? 'done' : ''}"><b>${e.step > i + 1 ? '✓' : i + 1}</b><span>${s}</span></li>`).join('')}</ol>
        <div id="step"></div>
      </section>`;
    const host = $('step');
    if (r.kind === 'rewrite' && !r.source) return stepNoRewrite(host, item);
    [stepSee, stepWrite, stepCheck, stepLog][e.step - 1](host, r, e);
  }

  function goStep(e, n) { e.step = n; save(); renderToday(); }

  function promptBlock(q) {
    if (!q) return '';
    const text = q.prompt
      ? `<p class="prompt" lang="en">${esc(q.prompt)}</p>`
      : `<p class="prompt muted" style="font-family:inherit;font-size:16px">${esc(q.title)} · 打开书 ${pg(q.q)}，只看题目这一段。</p><p class="hint">想直接在这里显示英文题目：设置 → 导入题目原文包。</p>`;
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
    if (r.kind === 'question') {
      const q = r.question;
      head = `<div class="meta"><span><span class="tag">${q.task}</span> ${esc(q.section)}${item.full ? ' · <span class="tag amber">整篇 40′</span>' : ''}</span><span>题目在书 ${pg(q.q)}</span></div>`;
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
      <h3 class="sub">AI 批改（可选）</h3>
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
    if (!n) return C.phaseOf(state) === 'review' ? '复盘（15 分钟）：看清楚强项和弱项' : '题单做完了';
    if (n.kind === 'rewrite') return '重写这一轮自评最低的一题';
    if (n.kind === 'mock' || n.kind === 'mockBook') return '60 分钟全真';
    const q = D.questions[n.qid];
    return `${q.task} · 一道新题（先别看题目）`;
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
        <p>写了 ${Math.round((e.writeSeconds || 0) / 60)} 分钟 · ${words} 词 · 记下 ${e.learned?.length || 0} 条规则、${e.errors?.length || 0} 个错误标签</p>
        <div class="next"><span class="muted">下一次：</span>${esc(nextLabel())}</div>
        <div class="actions" style="justify-content:center"><a class="secondary-button" href="#log">看记录</a><button class="primary-button" id="more">${phase === 'review' ? '去复盘 →' : '再做一题 →'}</button></div>
        <p class="hint">太累就到此为止。明天打开，直接从下一题开始，不用补。</p>
      </section>`;
    $('more').onclick = () => { ui.justDone = null; renderToday(); };
  }

  /* ---------- 统计 / 复盘 ---------- */
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
        <h2 class="sec">复盘：你的强项和弱项</h2>
        <p class="hint">数据来自你过去两周的自评和错误标签。系统先帮你选了自评最低的两种题型，可以改。</p>
        ${statsBlock(st)}
        <h3 class="sub">接下来两周重点练（选 2 个）</h3>
        <div class="chips" id="weak">${Object.entries(D.types).map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${ui.weakPick.includes(k)}">${t.task} ${t.label}</button>`).join('')}</div>
        <p class="hint">针对期每周 6 次：4 次练这两种题型，1 次换别的题型，1 次重写。之后进入 3 套全真。交稿前只查你的「错误前 5 名」。</p>
        <div class="actions"><span></span><button class="primary-button" id="gen">生成针对期题单 →</button></div>
      </section>`;
    view.querySelectorAll('#weak .chip').forEach((b) => b.onclick = () => toggleIn(ui.weakPick, b.dataset.v, b, 2));
    $('gen').onclick = () => {
      if (!ui.weakPick.length) { toast('至少选 1 种题型。'); return; }
      C.applyReview(state, D, ui.weakPick); save(); ui.weakPick = null; toast('已生成针对期题单'); renderToday();
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
      const title = r.kind === 'mockBook' ? r.mock.title : r.kind === 'mock' ? '全真 60′：' + r.questions.map((q) => q.title).join(' + ') : r.question ? (r.kind === 'rewrite' ? '重写：' : '') + r.question.title : '重写';
      const sc = C.ratingScore(e);
      const dots = sc == null ? '' : '●'.repeat(Math.round(sc)) + '○'.repeat(3 - Math.round(sc));
      const d = new Date(e.finishedAt);
      return `<div class="log-item">
        <div class="log-head"><b>${esc(title)}</b><span class="muted" style="font-size:12px">${d.getMonth() + 1}/${d.getDate()} · ${Math.round((e.writeSeconds || 0) / 60)} 分 · ${C.wordCount(e.draft) + C.wordCount(e.draft1)} 词 <span class="dots" title="自评">${dots}</span></span></div>
        <div class="log-meta">${r.question && r.kind !== 'mock' ? `<span class="tag">${typeLabel(r.question.type)}</span>` : ''}${e.judgedType && r.question ? `<span class="tag ${e.judgedType === r.question.type ? 'green' : 'red'}">判断${e.judgedType === r.question.type ? '对' : '错'}</span>` : ''}${e.light ? '<span class="tag amber">15 分钟版</span>' : ''}${(e.errors || []).map((x) => `<span class="tag red">${esc(errLabel(x))}</span>`).join('')}${(e.learned || []).map((k) => `<span class="tag green">要点 ${esc(k.replace('T', 'T1-'))}</span>`).join('')}</div>
        ${e.learnNote ? `<p class="hint">✎ ${esc(e.learnNote)}</p>` : ''}
        <details><summary>看作文${e.aiFeedback ? '和 AI 批改' : ''}</summary>${e.draft1 ? `<div class="pane">${esc(e.draft1)}</div>` : ''}<div class="pane">${esc(e.draft || '')}</div>${e.aiFeedback ? `<div class="pane" style="font-family:inherit">${esc(e.aiFeedback)}</div>` : ''}</details>
      </div>`;
    };
    view.innerHTML = `
      <section class="intro"><div><p class="eyebrow">Your record</p><h1>记录</h1><p class="intro-note">两周后，这一页会告诉你该练什么。</p></div></section>
      <section class="card">${statsBlock(st)}</section>
      <section class="card"><h2 class="sec">写过的题</h2>${done.length ? done.map(item).join('') : '<p class="muted">还没有完成的题。去「今日」写第一题。</p>'}</section>`;
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
  $('import-prompts').onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { const n = C.importPrompts(state, await f.text(), D); save(); dirty = true; msg(`已导入 ${n} 道题目原文，只保存在这台设备。`); }
    catch (err) { msg(err.message || '导入失败', true); }
    ev.target.value = '';
  };
  $('reset').onclick = () => {
    if (!confirm('清空「每日一题」的全部记录？（100句的进度不受影响）')) return;
    const theme = state.settings.theme, prompts = state.prompts; state = C.createState(D); state.settings.theme = theme; state.prompts = prompts || {}; save(); ui = { justDone: null, weakPick: null, lookupQ: '' }; dirty = true; msg('已清空。');
  };

  applyTheme();
  route();
})();
