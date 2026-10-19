import {
  openDB,
  getPoints,
  getQuestions,
  getSessions,
  saveSession,
  exportFullPack,
  importFullPack,
  resetDatabase,
  ensureInitialized,
  readChunksBank,
  readTheme
} from './shared/store.js';

import {
  validatePack,
  exportSessionMarkdown
} from './shared/pack.js';

import {
  buildReviewPrompt,
  parseAiResponse
} from './shared/prompt.js';

// Application state
const state = {
  points: [],
  pointsMap: {},
  questions: [],
  sessions: [],
  activeQuestion: null,
  activeMode: '审题 + 主体段',
  currentStep: 1,
  timer: {
    secondsLeft: 300,
    totalSeconds: 300,
    interval: null,
    running: false
  },
  session: {
    draft: '',
    issues: [],
    rewriteTask: '',
    reference: '',
    rewrite: '',
    independent: true,
    minutes: 45
  }
};

// DOM references
const $ = (id) => document.getElementById(id);

// Format seconds into MM:SS
function formatTime(totalSec) {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.max(0, totalSec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Count English words roughly
function countWords(str) {
  if (!str) return 0;
  const matches = str.trim().match(/[a-zA-Z0-9_\u4e00-\u9fa5]+(?:'[a-zA-Z]+)?/g);
  return matches ? matches.length : 0;
}

// Initialize theme from read-only key
function initTheme() {
  const saved = readTheme();
  const theme = saved === 'dark' || saved === 'light' ? saved : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = $('theme-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = theme === 'dark' ? '☼' : '☾';
    toggleBtn.onclick = () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      toggleBtn.textContent = next === 'dark' ? '☼' : '☾';
    };
  }
}

// Timer functions
function stopTimer() {
  if (state.timer.interval) {
    clearInterval(state.timer.interval);
    state.timer.interval = null;
  }
  state.timer.running = false;
  const toggleBtn = $('timer-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = '▶';
}

function startTimer(seconds) {
  stopTimer();
  state.timer.secondsLeft = seconds;
  state.timer.totalSeconds = seconds;
  state.timer.running = true;

  const timerText = $('step-timer-text');
  const toggleBtn = $('timer-toggle-btn');
  if (timerText) timerText.textContent = formatTime(state.timer.secondsLeft);
  if (toggleBtn) toggleBtn.textContent = '⏸';

  state.timer.interval = setInterval(() => {
    if (state.timer.secondsLeft > 0) {
      state.timer.secondsLeft--;
      if (timerText) timerText.textContent = formatTime(state.timer.secondsLeft);
    } else {
      stopTimer();
    }
  }, 1000);
}

function toggleTimer() {
  if (state.timer.running) {
    stopTimer();
  } else {
    if (state.timer.secondsLeft <= 0) {
      state.timer.secondsLeft = state.timer.totalSeconds;
    }
    state.timer.running = true;
    const toggleBtn = $('timer-toggle-btn');
    if (toggleBtn) toggleBtn.textContent = '⏸';
    state.timer.interval = setInterval(() => {
      if (state.timer.secondsLeft > 0) {
        state.timer.secondsLeft--;
        const timerText = $('step-timer-text');
        if (timerText) timerText.textContent = formatTime(state.timer.secondsLeft);
      } else {
        stopTimer();
      }
    }, 1000);
  }
}

// Load data & render home
async function initApp() {
  initTheme();
  await ensureInitialized();

  const [points, questions, sessions] = await Promise.all([
    getPoints(),
    getQuestions(),
    getSessions()
  ]);

  state.points = points;
  state.pointsMap = Object.fromEntries(points.map(p => [p.id, p]));
  state.questions = questions;
  state.sessions = sessions;

  // Select first question by default
  state.activeQuestion = questions[0] || null;

  renderWelcomeView();
  setupEventListeners();
}

function renderWelcomeView() {
  const q = state.activeQuestion;
  if (!q) {
    $('card-prompt-text').textContent = '题库暂无题目，请点击右上角设置导入私有数据包。';
    return;
  }

  // Header info
  $('card-task-badge').textContent = q.task === 'T1' ? 'Task 1' : 'Task 2';
  $('card-type-badge').textContent = q.type || '观点题';
  $('card-qid-badge').textContent = q.id;
  $('card-prompt-text').textContent = q.prompt;

  // Headline topic
  $('headline-topic').textContent = q.type ? `${q.type}专项` : '真题实战';

  // Points list
  const pointIds = q.pointIds || [];
  $('card-points-hint').textContent = `关联要点 ${pointIds.length} 项`;
  $('side-point-count').textContent = `${pointIds.length} 项`;

  const pointsListEl = $('card-points-list');
  pointsListEl.replaceChildren();

  for (const pid of pointIds) {
    const pt = state.pointsMap[pid];
    const item = document.createElement('div');
    item.className = 'point-chip';

    const titleEl = document.createElement('span');
    titleEl.className = 'point-chip-title';
    titleEl.textContent = `${pid} ${pt ? pt.title : ''}`;

    const badgeEl = document.createElement('span');
    const isVerified = pt?.verify?.title && pt?.verify?.page && pt?.verify?.book;
    badgeEl.className = `badge ${isVerified ? 'badge-verified' : 'badge-draft'}`;
    badgeEl.textContent = isVerified ? '已核对' : '草稿 · 待核对原书';

    item.append(titleEl, badgeEl);
    pointsListEl.appendChild(item);
  }

  // Recent sessions list
  const recentListEl = $('recent-sessions-list');
  $('recent-sessions-count').textContent = `${state.sessions.length} 次完成`;
  if (state.sessions.length > 0) {
    recentListEl.replaceChildren();
    state.sessions.slice(0, 5).forEach(s => {
      const qObj = state.questions.find(item => item.id === s.questionId);
      const row = document.createElement('div');
      row.style.fontSize = '12px';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.padding = '6px 0';
      row.style.borderBottom = '1px dashed var(--line)';

      const title = document.createElement('span');
      title.textContent = `${s.date} · ${s.questionId} (${s.issues?.length || 0} 个问题)`;
      title.title = qObj?.prompt || '';

      const tag = document.createElement('span');
      tag.className = `badge ${s.independent ? 'badge-verified' : 'badge-draft'}`;
      tag.textContent = s.independent ? '独立重写' : '订正';

      row.append(title, tag);
      recentListEl.appendChild(row);
    });
  }
}

// Go to specific training step
function setStep(stepNum) {
  state.currentStep = stepNum;

  // Update top progress indicators
  document.querySelectorAll('.step-item').forEach(el => {
    const s = Number(el.dataset.step);
    el.classList.toggle('active', s === stepNum);
    el.classList.toggle('completed', s < stepNum);
  });

  // Hide all step panels
  for (let i = 1; i <= 5; i++) {
    const panel = $(`step-${i}-panel`);
    if (panel) panel.hidden = (i !== stepNum);
  }

  const q = state.activeQuestion;
  const candidatePoints = (q.pointIds || []).map(pid => state.pointsMap[pid]).filter(Boolean);

  if (stepNum === 1) {
    // 审题 5'
    startTimer(300);
    $('step1-prompt-display').textContent = q.prompt;
    const ptBox = $('step1-points-display');
    ptBox.replaceChildren();
    for (const pt of candidatePoints) {
      const chip = document.createElement('div');
      chip.className = 'point-chip';
      const isVerified = pt.verify?.title && pt.verify?.page && pt.verify?.book;
      chip.innerHTML = `<span class="point-chip-title"><strong>${pt.id}</strong> ${pt.title}</span><span class="badge ${isVerified ? 'badge-verified' : 'badge-draft'}">${isVerified ? '已核对' : '草稿 · 待核对'}</span>`;
      ptBox.appendChild(chip);
    }
  } else if (stepNum === 2) {
    // 独立作答 10'
    startTimer(600);
    $('step2-prompt-display').textContent = q.prompt;
    $('draft-input').value = state.session.draft;
    $('draft-word-count').textContent = `${countWords(state.session.draft)} 词`;
    $('draft-input').focus();
  } else if (stepNum === 3) {
    // 批改诊断 15'
    startTimer(900);
    $('step3-prompt-display').textContent = q.prompt;
    $('step3-draft-display').textContent = state.session.draft || '（未输入作答初稿）';
    $('step3-draft-words').textContent = `${countWords(state.session.draft)} 词`;

    renderIssues();
    $('rewrite-task-input').value = state.session.rewriteTask;

    // AI Reference version masked by default (Rule 5)
    const maskBox = $('ref-mask-box');
    const contentBox = $('ref-content-box');
    if (state.session.reference) {
      contentBox.textContent = state.session.reference;
      maskBox.hidden = false;
      contentBox.hidden = true;
    } else {
      maskBox.hidden = true;
      contentBox.hidden = true;
    }
  } else if (stepNum === 4) {
    // 独立重写 15'
    startTimer(900);
    $('step4-task-display').textContent = state.session.rewriteTask || '根据诊断出的问题独立重写主体段或全文。';
    $('rewrite-input').value = state.session.rewrite;
    $('rewrite-word-count').textContent = `${countWords(state.session.rewrite)} 词`;
    $('step4-reference-peek').hidden = true;

    // Update independent badge
    updateIndependentBadge();
    $('rewrite-input').focus();
  } else if (stepNum === 5) {
    // 保存记录
    stopTimer();
    $('summary-qid').textContent = q.id;
    $('summary-independent-badge').textContent = state.session.independent ? '独立重写 ✓' : '订正（曾查看参考）';
    $('summary-independent-badge').className = `badge ${state.session.independent ? 'badge-verified' : 'badge-draft'}`;
    $('summary-minutes').textContent = `${state.session.minutes || 45} 分钟`;
    $('summary-issues-count').textContent = `${state.session.issues.length} 个诊断问题`;
    $('summary-rewrite-words').textContent = `${countWords(state.session.rewrite)} 词`;
  }
}

function updateIndependentBadge() {
  const badge = $('independent-status-badge');
  if (!badge) return;
  if (state.session.independent) {
    badge.className = 'badge badge-verified';
    badge.textContent = '独立重写模式 (未查看初稿与参考)';
  } else {
    badge.className = 'badge badge-draft';
    badge.textContent = '订正模式 (已查看初稿或参考)';
  }
}

function renderIssues() {
  const container = $('issues-list-container');
  container.replaceChildren();

  if (state.session.issues.length === 0) {
    container.innerHTML = '<p style="font-size: 13px; color: var(--ink-tertiary); padding: 18px 0; text-align: center;">尚未解析到诊断问题。请点击下方「复制批改提示词」发给 ChatGPT，再点击「粘贴 ChatGPT 结果」。</p>';
    return;
  }

  state.session.issues.forEach((iss, index) => {
    const card = document.createElement('div');
    card.className = `issue-card ${index === 0 ? 'priority' : ''}`;

    const header = document.createElement('div');
    header.className = 'issue-header';

    const critBadge = document.createElement('span');
    critBadge.className = 'badge badge-danger';
    critBadge.textContent = `${iss.criterion} ${index === 0 ? '· 最影响分数' : ''}`;

    const tagEl = document.createElement('strong');
    tagEl.style.fontSize = '14px';
    tagEl.textContent = iss.tag || '未命名问题';

    header.append(critBadge, tagEl);

    const noteEl = document.createElement('p');
    noteEl.className = 'issue-note';
    noteEl.textContent = iss.note || '';

    card.append(header, noteEl);

    // Linked points
    if (iss.pointIds && iss.pointIds.length > 0) {
      const ptContainer = document.createElement('div');
      ptContainer.style.margin = '8px 0';
      ptContainer.style.display = 'flex';
      ptContainer.style.flexDirection = 'column';
      ptContainer.style.gap = '6px';

      for (const pid of iss.pointIds) {
        const pt = state.pointsMap[pid];
        const isVerified = pt?.verify?.title && pt?.verify?.page && pt?.verify?.book;
        const ptEl = document.createElement('div');
        ptEl.className = 'point-chip';
        ptEl.innerHTML = `<span class="point-chip-title"><strong>${pid}</strong> ${pt ? pt.title : ''}</span><span class="badge ${isVerified ? 'badge-verified' : 'badge-draft'}">${isVerified ? '已核对' : '草稿 · 待核对'}</span>`;
        ptContainer.appendChild(ptEl);
      }
      card.appendChild(ptContainer);
    }

    // Linked chunk
    if (iss.chunk) {
      const chunkBox = document.createElement('div');
      chunkBox.style.marginTop = '8px';
      chunkBox.innerHTML = `<span class="chunk-hint">词伙: <strong>${iss.chunk}</strong></span> <a href="chunks.html" style="font-size: 12px; color: var(--accent); margin-left: 8px; text-decoration: none;">去练这组词伙 →</a>`;
      card.appendChild(chunkBox);
    }

    container.appendChild(card);
  });
}

// Copy prompt to clipboard
async function handleCopyPrompt() {
  const q = state.activeQuestion;
  const candidatePoints = (q.pointIds || []).map(pid => state.pointsMap[pid]).filter(Boolean);
  const promptText = buildReviewPrompt({
    question: q,
    draft: state.session.draft,
    mode: state.activeMode,
    candidatePoints
  });

  const btn = $('copy-prompt-btn');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(promptText);
    } else {
      const ta = document.createElement('textarea');
      ta.value = promptText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const oldText = btn.textContent;
    btn.textContent = '已复制提示词 ✓';
    btn.classList.add('btn-primary');
    setTimeout(() => {
      btn.textContent = oldText;
      btn.classList.remove('btn-primary');
    }, 2000);
  } catch (err) {
    alert('无法自动复制，请手动复制：\n\n' + promptText);
  }
}

// Setup all event listeners
function setupEventListeners() {
  // Mode selection
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.className = 'btn btn-sm btn-secondary mode-btn';
      });
      btn.className = 'btn btn-sm btn-primary mode-btn';
      state.activeMode = btn.dataset.mode;
    });
  });

  // Start training
  $('start-training-btn').addEventListener('click', () => {
    $('welcome-view').hidden = true;
    $('training-view').hidden = false;
    $('train-qid-badge').textContent = state.activeQuestion.id;
    $('train-mode-badge').textContent = state.activeMode;

    // Reset session state
    state.session = {
      draft: '',
      issues: [],
      rewriteTask: '',
      reference: '',
      rewrite: '',
      independent: true,
      minutes: 45
    };

    setStep(1);
  });

  // Switch question
  $('switch-question-btn').addEventListener('click', () => {
    openQuestionModal();
  });
  $('nav-questions-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openQuestionModal();
  });

  // Timer controls
  $('timer-toggle-btn').addEventListener('click', toggleTimer);
  $('skip-step-btn').addEventListener('click', () => {
    if (state.currentStep < 5) {
      setStep(state.currentStep + 1);
    }
  });

  // Step 1 -> 2
  $('step1-next-btn').addEventListener('click', () => {
    setStep(2);
  });

  // Step 2 Draft input
  $('draft-input').addEventListener('input', (e) => {
    state.session.draft = e.target.value;
    $('draft-word-count').textContent = `${countWords(state.session.draft)} 词`;
  });
  $('step2-back-btn').addEventListener('click', () => setStep(1));
  $('step2-next-btn').addEventListener('click', () => setStep(3));

  // Step 3 actions
  $('copy-prompt-btn').addEventListener('click', handleCopyPrompt);

  $('open-paste-modal-btn').addEventListener('click', () => {
    $('chatgpt-raw-input').value = '';
    $('paste-parse-error').hidden = true;
    $('paste-modal').hidden = false;
  });

  $('confirm-paste-parse-btn').addEventListener('click', () => {
    const raw = $('chatgpt-raw-input').value;
    const parsed = parseAiResponse(raw);

    if (parsed.success) {
      state.session.issues = parsed.issues;
      if (parsed.rewriteTask) {
        state.session.rewriteTask = parsed.rewriteTask;
        $('rewrite-task-input').value = parsed.rewriteTask;
      }
      if (parsed.reference) {
        state.session.reference = parsed.reference;
        $('ref-content-box').textContent = parsed.reference;
        $('ref-mask-box').hidden = false;
        $('ref-content-box').hidden = true;
      }
      renderIssues();
      $('paste-modal').hidden = true;
    } else {
      $('paste-parse-error').textContent = parsed.error || '解析失败，请检查格式或手动添加问题。';
      $('paste-parse-error').hidden = false;
    }
  });

  $('rewrite-task-input').addEventListener('input', (e) => {
    state.session.rewriteTask = e.target.value;
  });

  // Reveal reference in Step 3 (Rule 5)
  $('reveal-ref-btn').addEventListener('click', () => {
    const confirmed = confirm('查看参考版本后，本次重写将标记为「订正」，不再计为「独立重写」。确定查看？');
    if (confirmed) {
      state.session.independent = false;
      $('ref-mask-box').hidden = true;
      $('ref-content-box').hidden = false;
      updateIndependentBadge();
    }
  });

  // Manual issue modal
  $('manual-add-issue-btn').addEventListener('click', () => {
    const select = $('issue-points-select');
    select.replaceChildren();
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '（不关联或选填）';
    select.appendChild(optNone);

    for (const p of state.points) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.id} ${p.title}`;
      select.appendChild(opt);
    }

    $('issue-tag-input').value = '';
    $('issue-chunk-input').value = '';
    $('issue-note-input').value = '';
    $('issue-modal').hidden = false;
  });

  $('save-issue-btn').addEventListener('click', () => {
    const crit = $('issue-criterion-select').value;
    const tag = $('issue-tag-input').value.trim() || '未命名问题';
    const pointId = $('issue-points-select').value;
    const chunk = $('issue-chunk-input').value.trim() || null;
    const note = $('issue-note-input').value.trim();

    state.session.issues.push({
      criterion: crit,
      tag,
      pointIds: pointId ? [pointId] : [],
      chunk,
      note
    });

    renderIssues();
    $('issue-modal').hidden = true;
  });

  $('step3-next-btn').addEventListener('click', () => setStep(4));

  // Step 4 actions
  $('step4-back-btn').addEventListener('click', () => setStep(3));
  $('rewrite-input').addEventListener('input', (e) => {
    state.session.rewrite = e.target.value;
    $('rewrite-word-count').textContent = `${countWords(state.session.rewrite)} 词`;
  });

  // Toggle reference peek in Step 4
  $('step4-toggle-ref-btn').addEventListener('click', () => {
    const peekEl = $('step4-reference-peek');
    if (peekEl.hidden) {
      const confirmed = confirm('查看初稿或 AI 参考版本后，本次重写将被标记为「订正」，不再计为「独立重写」。确定查看？');
      if (confirmed) {
        state.session.independent = false;
        $('step4-draft-peek-text').textContent = state.session.draft || '（无初稿）';
        $('step4-ref-peek-text').textContent = state.session.reference || '（无参考版本）';
        peekEl.hidden = false;
        updateIndependentBadge();
      }
    } else {
      peekEl.hidden = true;
    }
  });

  $('step4-next-btn').addEventListener('click', () => setStep(5));

  // Step 5 actions
  $('save-session-btn').addEventListener('click', async () => {
    const sessionRecord = {
      id: `${new Date().toISOString().slice(0, 10)}-${String(state.sessions.length + 1).padStart(2, '0')}`,
      date: new Date().toISOString().slice(0, 10),
      questionId: state.activeQuestion.id,
      mode: state.activeMode,
      minutes: state.session.minutes || 45,
      draft: state.session.draft,
      feedbackRaw: '',
      issues: state.session.issues,
      rewrite: state.session.rewrite,
      independent: state.session.independent
    };

    await saveSession(sessionRecord);
    state.sessions = await getSessions();
    alert('训练记录已成功保存到本机 IndexedDB！');
  });

  $('export-session-md-btn').addEventListener('click', () => {
    const sessionRecord = {
      id: `${new Date().toISOString().slice(0, 10)}-${String(state.sessions.length + 1).padStart(2, '0')}`,
      date: new Date().toISOString().slice(0, 10),
      questionId: state.activeQuestion.id,
      mode: state.activeMode,
      minutes: state.session.minutes || 45,
      draft: state.session.draft,
      feedbackRaw: '',
      issues: state.session.issues,
      rewrite: state.session.rewrite,
      independent: state.session.independent
    };

    const md = exportSessionMarkdown(sessionRecord, state.activeQuestion, state.pointsMap);
    downloadFile(`ielts-training-${sessionRecord.id}.md`, md, 'text/markdown;charset=utf-8');
  });

  $('finish-and-home-btn').addEventListener('click', () => {
    $('training-view').hidden = true;
    $('welcome-view').hidden = false;
    renderWelcomeView();
  });

  // Settings modal
  $('settings-open').addEventListener('click', openSettingsModal);

  $('export-full-pack-btn').addEventListener('click', async () => {
    const pack = await exportFullPack();
    downloadFile('ielts6-pack.json', JSON.stringify(pack, null, 2), 'application/json;charset=utf-8');
  });

  $('import-pack-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msgEl = $('import-status-msg');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importFullPack(json);
      msgEl.textContent = `成功导入！包含 ${res.pointsCount} 个要点、${res.questionsCount} 道题目、${res.sessionsCount} 条记录。`;
      msgEl.style.color = 'var(--green)';
      msgEl.hidden = false;

      // Reload state
      state.points = await getPoints();
      state.pointsMap = Object.fromEntries(state.points.map(p => [p.id, p]));
      state.questions = await getQuestions();
      state.sessions = await getSessions();
      if (state.questions.length > 0) state.activeQuestion = state.questions[0];
      renderWelcomeView();
    } catch (err) {
      msgEl.textContent = '导入失败: ' + err.message;
      msgEl.style.color = 'var(--red)';
      msgEl.hidden = false;
    }
  });

  $('export-selected-md-btn').addEventListener('click', () => {
    const sId = $('export-session-select').value;
    const sess = state.sessions.find(s => s.id === sId);
    if (!sess) return;
    const q = state.questions.find(item => item.id === sess.questionId);
    const md = exportSessionMarkdown(sess, q, state.pointsMap);
    downloadFile(`ielts-session-${sess.id}.md`, md, 'text/markdown;charset=utf-8');
  });

  $('reset-db-btn').addEventListener('click', async () => {
    const confirmed = confirm('确定要清空新系统的所有题目和训练记录吗？此操作无法撤销（旧 100句与词伙数据不受任何影响）。');
    if (confirmed) {
      await resetDatabase();
      await ensureInitialized();
      state.points = await getPoints();
      state.pointsMap = Object.fromEntries(state.points.map(p => [p.id, p]));
      state.questions = await getQuestions();
      state.sessions = await getSessions();
      state.activeQuestion = state.questions[0] || null;
      renderWelcomeView();
      alert('已清空并恢复默认题库！');
      $('settings-modal').hidden = true;
    }
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId && $(modalId)) {
        $(modalId).hidden = true;
      }
    });
  });
}

function openQuestionModal() {
  const container = $('questions-list-container');
  container.replaceChildren();

  const filterTask = $('question-filter-task').value;
  const filterType = $('question-filter-type').value;

  const filtered = state.questions.filter(q => {
    if (filterTask !== 'all' && q.task !== filterTask) return false;
    if (filterType !== 'all' && q.type !== filterType) return false;
    return true;
  });

  filtered.forEach(q => {
    const card = document.createElement('div');
    card.style.border = '1px solid var(--line)';
    card.style.borderRadius = 'var(--radius-sm)';
    card.style.padding = '12px 14px';
    card.style.cursor = 'pointer';
    card.style.background = state.activeQuestion?.id === q.id ? 'var(--accent-soft)' : 'var(--card-bg)';

    const badges = `<span class="badge">${q.task}</span> <span class="badge badge-gray">${q.type}</span> <span style="font-size: 12px; color: var(--ink-tertiary);">${q.id}</span>`;
    const prompt = `<p style="font-size: 13px; margin: 8px 0; line-height: 1.5;">${q.prompt}</p>`;
    const points = `<span style="font-size: 11px; color: var(--ink-tertiary);">关联要点: ${(q.pointIds || []).join(' · ')}</span>`;

    card.innerHTML = `${badges}${prompt}${points}`;
    card.onclick = () => {
      state.activeQuestion = q;
      renderWelcomeView();
      $('question-modal').hidden = true;
    };

    container.appendChild(card);
  });

  $('question-modal').hidden = false;
}

function openSettingsModal() {
  const select = $('export-session-select');
  select.replaceChildren();

  if (state.sessions.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '暂无训练记录';
    select.appendChild(opt);
  } else {
    state.sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.date} · ${s.questionId} (${s.independent ? '独立' : '订正'})`;
      select.appendChild(opt);
    });
  }

  $('import-status-msg').hidden = true;
  $('settings-modal').hidden = false;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Start
initApp().catch(console.error);
