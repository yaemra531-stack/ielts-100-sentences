import {VERSION, tokens, grade, validateBank, signature, localDate, freshProgress, restoreProgress, masteredCount, activateNext, submit, retry, restoreAttemptLog, attemptTime, attemptMode, exportAttemptMarkdown} from './core.js?v=20261003-5';
import {createFeedback} from './feedback.js?v=20261003-5';
import {createNarration} from './narration.js?v=20261003-5';

const STATE_KEY = 'ielts100.progress.v1';
const BANK_KEY = 'ielts100.bank.v1';
const $ = id => document.getElementById(id);
const THEME_KEY = 'ielts100.theme.v1';
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let themeChoice = null;
try { const saved = localStorage.getItem(THEME_KEY); if (['light','dark'].includes(saved)) themeChoice = saved; } catch {}
function applyTheme() {
  const dark = (themeChoice || (systemTheme.matches ? 'dark' : 'light')) === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-toggle').textContent = dark ? '☀' : '☾';
  $('theme-toggle').setAttribute('aria-pressed',String(dark));
  $('theme-toggle').setAttribute('aria-label',dark ? '切换日间模式' : '切换夜间模式');
  $('theme-toggle').title = dark ? '切换日间模式' : '切换夜间模式';
}
$('theme-toggle').addEventListener('click',() => {
  themeChoice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY,themeChoice); } catch {}
  applyTheme();
});
systemTheme.addEventListener('change',() => { if (!themeChoice) applyTheme(); });
applyTheme();
const FEEDBACK_KEY = 'ielts100.feedback.v1';
const feedback = createFeedback();
let feedbackEnabled = true;
try { feedbackEnabled = localStorage.getItem(FEEDBACK_KEY) !== 'off'; } catch {}
function applyFeedbackPreference() {
  feedback.setEnabled(feedbackEnabled);
  $('feedback-toggle').checked = feedbackEnabled;
  document.querySelectorAll('[data-feedback-sound]').forEach(button => { button.disabled = !feedbackEnabled; });
  if (!feedbackEnabled) $('feedback').classList.remove('feedback-pop');
}
applyFeedbackPreference();
$('feedback-toggle').addEventListener('change',() => {
  feedbackEnabled = $('feedback-toggle').checked;
  try { localStorage.setItem(FEEDBACK_KEY,feedbackEnabled ? 'on' : 'off'); } catch {}
  applyFeedbackPreference();
});
document.querySelectorAll('[data-feedback-sound]').forEach(button => {
  button.addEventListener('click',() => { void feedback.play(button.dataset.feedbackSound); });
});
let bank, progress, customBank = false, storageOkay = true;
const NARRATION_KEY = 'ielts100.narration.v1';
let autoNarration = true;
try { autoNarration = localStorage.getItem(NARRATION_KEY) !== 'off'; } catch {}
const narration = createNarration(renderNarration);
function renderNarration() {
  $('narration-toggle').checked = autoNarration;
  $('narration-bank').textContent = narration.summary(bank);
  $('replay-button').textContent = narration.state.playing ? '■ 停止朗读' : '▶ 重听';
  $('replay-button').title = 'Alt R 朗读 / 停止';
  const target = progress?.active?.result?.target;
  $('narration-note').textContent = narration.state.message || (target ? narration.describe(target) : '');
}
function replay() {
  if (!progress?.active?.result) return;
  if (narration.state.playing) narration.stop();
  else narration.play(progress.active.result.target);
}
$('replay-button').addEventListener('click',replay);
$('narration-toggle').addEventListener('change',() => {
  autoNarration = $('narration-toggle').checked;
  try { localStorage.setItem(NARRATION_KEY,autoNarration ? 'on' : 'off'); } catch {}
  if (!autoNarration) narration.stop();
});
$('audio-import').addEventListener('change',async event => {
  const file=event.target.files[0];event.target.value='';if (!file) return;
  try {
    if (file.size > 30*1024*1024) throw new Error('语音包请小于 30 MB。');
    const count=await narration.importPack(JSON.parse(await file.text()));
    settingsMessage(`已保存 ${count} 条本机音频。${narration.summary(bank)}。`);
  } catch (error) { settingsMessage(`${error instanceof SyntaxError ? '语音包 JSON 格式不正确。' : error.message} 题库与学习进度未改变。`,true); }
});
window.speechSynthesis?.addEventListener('voiceschanged',renderNarration);
renderNarration();
void narration.load();
const notice = (message) => { $('notice').textContent = message; $('notice').hidden = false; };
function storageWarning() {
  storageOkay = false;
  $('save-status').textContent = '进度暂时无法保存';
  notice('这个浏览器暂时不允许本地存储。当前可以练习，离开前请导出进度备份。');
}
function read(key) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; }
  catch { storageWarning(); return null; }
}
function save(replaceLogs = false) {
  if (!progress) return;
  try {
    if (!replaceLogs) {
      const existing = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      if (existing?.logEpoch && existing.logEpoch !== progress.logEpoch) {
        notice('另一个页面已更换题库或重置进度。请先导出本页记录，再刷新继续，避免覆盖新进度。');
        return;
      }
      mergeSavedLogs(existing?.attemptLog);
    }
    localStorage.setItem(STATE_KEY, JSON.stringify(progress));
  }
  catch { storageWarning(); }
}
function mergeSavedLogs(raw) {
  if (!Array.isArray(raw) || !progress) return;
  const ids = new Set(progress.attemptLog.map(e=>e.id));
  const missing = raw.filter(e=>e && !ids.has(e.id));
  if (missing.length) progress.attemptLog.push(...restoreAttemptLog(missing));
  progress.attemptLog.sort((a,b)=>(a.timestamp || '').localeCompare(b.timestamp || ''));
}
function focusAction() {
  if ($('settings').open || !progress) return;
  const element = !progress.active ? $('review-button') : progress.active.result ? (progress.active.result.correct ? $('next-button') : $('retry-button')) : $('answer');
  element.focus({preventScroll:true});
}
function renderStats() {
  const today = progress.daily[localDate()] || {attempts:0,ids:[]};
  $('today-count').textContent = today.ids.length;
  $('today-attempts').textContent = `${today.attempts} 次核对`;
  const mastered = masteredCount(progress), total = bank.sentences.length;
  $('mastered-count').replaceChildren(document.createTextNode(mastered));
  const denominator = document.createElement('span');
  denominator.className = 'stat-total'; denominator.textContent = ` / ${total}`;
  $('mastered-count').append(denominator);
  $('progress-fill').style.width = `${mastered / total * 100}%`;
  document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', Math.round(mastered / total * 100));
  if (storageOkay) $('save-status').textContent = '进度保存在本机';
  $('settings-bank').textContent = `${bank.title} · ${total} 句${customBank ? ' · 本机导入' : ' · 内置示例'}`;
}
function renderSentence(element, text, marks = [], className = '') {
  element.replaceChildren();
  // Indices and displayed text both use the same compatibility-normalized string.
  const display = text.normalize('NFKC');
  let cursor = 0;
  tokens(display).forEach((token,index) => {
    element.append(document.createTextNode(display.slice(cursor,token.start)));
    const span = document.createElement('span');
    span.textContent = display.slice(token.start,token.end);
    if (marks[index]) span.className = className;
    element.append(span); cursor = token.end;
  });
  element.append(document.createTextNode(display.slice(cursor)));
}
function renderResult(q) {
  const result = progress.active.result, record = progress.records[q.id];
  $('feedback').className = `feedback ${result.usedHint || result.repair ? 'hinted' : result.correct ? 'correct' : 'wrong'}`;
  $('result-icon').textContent = result.correct && !result.usedHint && !result.repair ? '✓' : result.usedHint ? '↗' : '↺';
  $('next-button').hidden = !result.correct;
  $('retry-button').hidden = result.correct;
  if (result.repair) {
    $('result-title').textContent = result.correct ? '这次写对了，继续下一句。' : '再看一下，重写本句。';
    $('result-detail').textContent = result.correct ? '刚看过答案，这次只算订正；隔开几句后会再独立考一次。' : '看清差异后重写，写对才能进入下一句。';
  } else if (result.usedHint) {
    $('result-title').textContent = result.correct ? '写对了，再独立试一次。' : '先记住，再凭记忆写。';
    $('result-detail').textContent = '这次用过提示，暂不计入掌握；隔开几句后会再出现。';
  } else if (result.correct) {
    $('result-title').textContent = record.streak >= 2 ? '这句，掌握了。' : '写对了。';
    $('result-detail').textContent = record.streak >= 2 ? '已连续两次独立答对。继续下一句。' : '独立答对 1 / 2。隔开几句后，再确认一次。';
  } else {
    $('result-title').textContent = result.answer.trim() ? '暂未匹配标准答案。' : '先看答案，再试一次。';
    $('result-detail').textContent = '先看清差异，再重写本句；写对后进入下一句。';
  }
  $('your-answer-block').hidden = result.correct || !result.answer.trim();
  renderSentence($('your-answer'), result.answer, result.inputMarks, 'word-error');
  renderSentence($('reference-answer'), result.target, result.correct ? [] : result.targetMarks, 'word-needed');
  $('reference-label').textContent = result.correct ? '标准英文' : '参考答案 · 最接近的可接受答案';
  $('diff-legend').replaceChildren();
  if (!result.correct) {
    const red = document.createElement('span'); red.className = 'legend-red'; red.textContent = '红色：与参考不同';
    const green = document.createElement('span'); green.className = 'legend-green'; green.textContent = '绿色：参考中的差异';
    $('diff-legend').append(red,document.createElement('br'),green);
  } else $('diff-legend').textContent = '大小写与标点不影响判分。';
  renderNarration();
}
function renderHistory(active) {
  const history = active.history || [];
  $('attempt-history').hidden = !active.result || !history.length;
  $('attempt-history').open = false;
  $('history-summary').textContent = `先前作答 · ${history.length} 次`;
  $('history-list').replaceChildren();
  history.forEach((result,index) => {
    const item = document.createElement('div'); item.className = 'history-item';
    const heading = document.createElement('p'); heading.className = 'answer-label'; heading.textContent = `作答记录 ${index+1}`;
    const answer = document.createElement('p'); renderSentence(answer,result.answer || '（未填写）',result.inputMarks,'word-error');
    const referenceLabel = document.createElement('p'); referenceLabel.className = 'answer-label'; referenceLabel.textContent = '参考答案';
    const reference = document.createElement('p'); renderSentence(reference,result.target,result.targetMarks,'word-needed');
    item.append(heading,answer,referenceLabel,reference); $('history-list').append(item);
  });
}
let logVisibleLimit = 20;
function renderJournal() {
  const entries = progress.attemptLog;
  $('journal-count').textContent = `${entries.length} 次核对 · ${entries.filter(e=>!e.correct).length} 次未匹配`;
  $('log-export').disabled = !entries.length;
  $('journal-list').replaceChildren();
  const filtered = entries.map((entry,index)=>({entry,index})).filter(({entry})=>$('log-filter').value !== 'unmatched' || !entry.correct);
  $('journal-empty').hidden = filtered.length > 0;
  $('journal-empty').textContent = entries.length ? '当前没有未匹配的记录。' : '每次核对都会自动记录，换到下一句后也会保留。';
  filtered.slice(0,logVisibleLimit).forEach(({entry:e,index})=>{
    const item = document.createElement('article'); item.className = 'journal-item';
    const meta = document.createElement('div'); meta.className = 'journal-meta';
    const label = document.createElement('span');label.textContent = `记录 ${index+1} · 第 ${String(e.questionNumber).padStart(2,'0')} 句`;
    const time = document.createElement('span');time.textContent = attemptTime(e);meta.append(label,time);
    const mode = document.createElement('p');mode.className = `journal-outcome ${e.correct ? 'matched' : 'unmatched'}`;mode.textContent = `${e.correct ? '匹配标准答案' : '未匹配标准答案'} · ${attemptMode(e)}`;
    const chinese = document.createElement('p');chinese.className = 'journal-chinese';chinese.textContent = e.chinese;
    item.append(meta,mode,chinese);
    const hideAnswer = progress.active && !progress.active.result && progress.active.id === e.questionId;
    if (hideAnswer) {
      const hiddenNote = document.createElement('p');hiddenNote.className = 'journal-note';hiddenNote.textContent = '本句正在默写，核对后可查看先前答案。';item.append(hiddenNote);
    } else {
      const diff = gradeForEntry(e);
      const ownLabel = document.createElement('span');ownLabel.className = 'answer-label';ownLabel.textContent = '你的答案';
      const own = document.createElement('p');renderSentence(own,e.answer || '（未填写）',diff.inputMarks,'word-error');
      const referenceLabel = document.createElement('span');referenceLabel.className = 'answer-label';referenceLabel.textContent = '核对时的参考答案';
      const reference = document.createElement('p');renderSentence(reference,diff.target,diff.targetMarks,'word-needed');
      item.append(ownLabel,own,referenceLabel,reference);
    }
    $('journal-list').append(item);
  });
  $('log-more').hidden = filtered.length <= logVisibleLimit;
  $('journal-visible').textContent = filtered.length ? `按时间从早到晚 · 显示 ${Math.min(logVisibleLimit,filtered.length)} / ${filtered.length} 条` : '';
}
function gradeForEntry(e) { return grade(e.answer,e.acceptedAnswers); }
function render(focus = true) {
  renderStats();
  const active = progress.active;
  $('practice').hidden = !active;
  $('complete').hidden = Boolean(active);
  $('practice').setAttribute('aria-busy','false');
  if (!active) {
    $('complete-text').textContent = `${bank.sentences.length} 句已掌握。每一句，都连续两次独立答对。`;
  } else {
    const index = bank.sentences.findIndex(q => q.id === active.id), q = bank.sentences[index], record = progress.records[q.id];
    $('bank-label').textContent = bank.title;
    $('question-number').textContent = `${String(index+1).padStart(2,'0')} / ${String(bank.sentences.length).padStart(2,'0')}`;
    $('chinese').textContent = q.chinese;
    $('question-status').textContent = active.repair ? '订正 · 凭记忆重写本句，写对后继续。' : record.streak >= 2 ? '已掌握 · 用这一句巩固一下。' : record.streak === 1 ? '独立答对 1 / 2 · 再写对一次就掌握。' : record.errors || record.hinted ? '回炉 · 再凭记忆写一次。' : '先读中文，再凭记忆写出英文。';
    const result = Boolean(active.result);
    $('answer-form').hidden = result;
    $('feedback').hidden = !result;
    $('answer').disabled = false;
    $('answer').value = active.draft;
    $('submit-button').disabled = false;
    $('hint-button').disabled = active.hintLevel >= 2;
    $('hint-button').replaceChildren(document.createTextNode(active.hintLevel ? '再看完整答案 ' : '给我一点提示 '));
    const shortcut = document.createElement('kbd'); shortcut.textContent = 'Alt H'; $('hint-button').append(shortcut);
    $('hint-box').hidden = !active.hintLevel;
    $('hint-text').textContent = active.hintLevel >= 2 ? q.answers[0] : q.hint || `${tokens(q.answers[0]).slice(0,3).map(t=>t.text).join(' ')} …`;
    if (result) renderResult(q);
    renderHistory(active);
  }
  renderJournal();
  $('narration-bank').textContent = narration.summary(bank);
  if (focus) focusAction();
}
function showHint() {
  if (!progress?.active || progress.active.result || progress.active.hintLevel >= 2) return;
  progress.active.hintLevel++;
  save(); render();
}
function checkAnswer(event) {
  event?.preventDefault();
  if (!progress?.active || progress.active.result) return;
  const answer = $('answer').value;
  const result = submit(bank, progress, answer);
  // Start audio in this user gesture, without waiting for it before rendering / moving on.
  void feedback.play(!answer.trim() ? 'empty' : result.correct ? 'correct' : 'unmatched');
  save(); render();
  if (feedbackEnabled && result.correct) $('feedback').classList.add('feedback-pop');
  if (autoNarration) narration.play(result.target);
  (progress.active.result.correct ? $('next-button') : $('retry-button')).scrollIntoView({block:'nearest'});
}
function next() {
  if (!progress?.active?.result?.correct) return;
  narration.stop();
  activateNext(bank,progress); save(); render();
}

$('answer-form').addEventListener('submit',checkAnswer);
$('answer').addEventListener('input',() => {
  if (!progress?.active || progress.active.result) return;
  progress.active.draft = $('answer').value; save();
});
$('answer').addEventListener('keydown',event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!event.repeat) checkAnswer(); }
});
document.addEventListener('keydown',event => {
  if (event.key === 'Enter' && event.repeat) event.preventDefault();
  if (event.altKey && event.code === 'KeyH' && !$('settings').open) { event.preventDefault(); if (!event.repeat) showHint(); }
  if (event.altKey && event.code === 'KeyR' && !$('settings').open) { event.preventDefault(); if (!event.repeat) replay(); }
});
$('hint-button').addEventListener('click',showHint);
$('next-button').addEventListener('click',next);
$('retry-button').addEventListener('click',() => {
  if (!retry(progress)) return;
  narration.stop();
  save(); render();
  $('answer').scrollIntoView({block:'nearest'});
});
$('review-button').addEventListener('click',() => {
  if (!bank || !progress) return;
  progress.reviewIds = bank.sentences.map(q=>q.id); activateNext(bank,progress); save(); render();
});
$('settings-open').addEventListener('click',() => {narration.stop();$('settings').showModal();});
$('settings-close').addEventListener('click',() => $('settings').close());
$('settings').addEventListener('close',focusAction);
function settingsMessage(message, error = false) {
  $('settings-message').textContent = message; $('settings-message').hidden = false; $('settings-message').classList.toggle('error',error);
}
$('reset-button').addEventListener('click',() => {
  if (!bank) return;
  if (!confirm(`确定重置「${bank.title}」的学习进度？题库会保留，掌握数、今日记录和全部作答记录会清空。建议先导出备份。`)) return;
  narration.stop();
  progress = freshProgress(bank); activateNext(bank,progress); save(true); render(false);
  settingsMessage('进度已重置，可以重新开始。');
});
$('export-button').addEventListener('click',() => {
  if (!bank || !progress) return;
  const backup = {format:'ielts100-backup',version:VERSION,exportedAt:new Date().toISOString(),bank,progress};
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `100句-进度备份-${localDate()}.json`; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  settingsMessage('备份已下载。可用「导入题库 / 备份」恢复到另一台设备。');
});
$('import-file').addEventListener('change',async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('文件过大，请使用 20 MB 以内的 JSON。');
    const raw = JSON.parse(await file.text()), backup = raw?.format === 'ielts100-backup';
    if (backup && (raw.version !== VERSION || !raw.progress || raw.progress.version !== VERSION)) throw new Error('备份版本或进度格式不正确。');
    const incoming = validateBank(backup ? raw.bank : raw);
    const source = backup ? raw.progress : progress;
    const preserved = incoming.sentences.filter(q => source?.records?.[q.id]?.signature === signature(q)).length;
    if (!confirm(backup ? `恢复「${incoming.title}」的题库与进度？这会替换本机当前记录。` : `导入「${incoming.title}」的 ${incoming.sentences.length} 句？完全相同的 ${preserved} 句可保留进度，其余从头开始。`)) return;
    narration.stop();
    const incomingProgress = restoreProgress(incoming,source);
    if (!incomingProgress.active) activateNext(incoming,incomingProgress);
    try { localStorage.setItem(BANK_KEY,JSON.stringify(incoming)); } catch { storageWarning(); }
    bank = incoming; progress = incomingProgress; customBank = true;
    progress.logEpoch = crypto.randomUUID();
    save(true); if (storageOkay) $('notice').hidden = true;
    render(false); settingsMessage(`已导入 ${bank.sentences.length} 句${backup ? '，进度已恢复' : `，保留 ${preserved} 句的进度`}。`);
  } catch (error) {
    settingsMessage(error instanceof SyntaxError ? 'JSON 格式不正确，当前题库和进度未改变。' : `${error.message} 当前题库和进度未改变。`,true);
  }
});
$('log-filter').addEventListener('change',()=>{logVisibleLimit=20;renderJournal();});
$('log-more').addEventListener('click',()=>{logVisibleLimit+=20;renderJournal();});
$('log-export').addEventListener('click',()=>{
  if (!progress?.attemptLog.length) return;
  const url = URL.createObjectURL(new Blob([exportAttemptMarkdown(progress.attemptLog)],{type:'text/markdown;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`100句-作答记录-${localDate()}.md`;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('storage',event=>{
  if (event.key === NARRATION_KEY) {
    autoNarration = event.newValue !== 'off'; if (!autoNarration) narration.stop(); renderNarration(); return;
  }
  if (event.key === FEEDBACK_KEY) {
    feedbackEnabled = event.newValue !== 'off'; applyFeedbackPreference(); return;
  }
  if (event.key !== STATE_KEY || !event.newValue || !progress) return;
  try {
    const incoming=JSON.parse(event.newValue);
    if (incoming.logEpoch !== progress.logEpoch) {notice('另一个页面已更换题库或重置进度，请刷新本页后继续。');return;}
    mergeSavedLogs(incoming.attemptLog);renderJournal();
  } catch {}
});
document.addEventListener('visibilitychange' ,() => {
  if (document.hidden) { feedback.stop(); narration.stop(); }
  else if (bank && progress) renderStats();
});

async function init() {
  try {
    const storedBank = read(BANK_KEY);
    if (storedBank) { bank = validateBank(storedBank); customBank = true; }
    else {
      const response = await fetch('./sentences.json',{cache:'no-store'});
      if (!response.ok) throw new Error(`题库读取失败（${response.status}）`);
      bank = validateBank(await response.json());
    }
    progress = restoreProgress(bank,read(STATE_KEY));
    if (!progress.active) activateNext(bank,progress);
    save(); render();
  } catch (error) {
    $('practice').hidden = true;
    notice(`${error.message}。请刷新重试，或打开右上角设置导入题库。`);
    $('settings-bank').textContent = '尚未加载题库';
  }
}
init();
