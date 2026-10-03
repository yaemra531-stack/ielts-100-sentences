export const VERSION = 1;
export const WORD_RE = /[\p{L}\p{N}]+(?:['’‘][\p{L}\p{N}]+)*/gu;
const number = (v, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= 0 && v <= max;

export function tokens(text) {
  return [...text.normalize('NFKC').matchAll(WORD_RE)].map(m => ({
    text: m[0], start: m.index, end: m.index + m[0].length,
    key: m[0].toLowerCase().replace(/['’‘]/g, '')
  }));
}
export function normalize(text) { return tokens(text).map(t => t.key).join(' '); }

// Word-level edit alignment: punctuation and capitalization never count as errors.
function align(input, target) {
  const a = tokens(input), b = tokens(target);
  const dp = Array.from({length: a.length + 1}, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1].key === b[j-1].key ? 0 : 1));
  }
  const inputMarks = Array(a.length).fill(false), targetMarks = Array(b.length).fill(false);
  let i = a.length, j = b.length;
  while (i || j) {
    if (i && j && a[i-1].key === b[j-1].key && dp[i][j] === dp[i-1][j-1]) { i--; j--; }
    else if (i && j && dp[i][j] === dp[i-1][j-1]+1) { inputMarks[--i] = true; targetMarks[--j] = true; }
    else if (j && dp[i][j] === dp[i][j-1]+1) { targetMarks[--j] = true; }
    else { inputMarks[--i] = true; }
  }
  return {distance: dp[a.length][b.length], inputMarks, targetMarks};
}
export function grade(input, answers) {
  let best;
  for (const target of answers) {
    const result = {...align(input, target), target};
    if (!best || result.distance < best.distance) best = result;
  }
  return {...best, correct: best.distance === 0};
}

export function validateBank(raw) {
  const source = Array.isArray(raw) ? raw : raw?.sentences;
  if (!Array.isArray(source) || source.length < 1 || source.length > 1000) throw new Error('题库需要包含 1–1000 句。');
  const ids = new Set();
  const sentences = source.map((q, index) => {
    if (!q || typeof q !== 'object') throw new Error(`第 ${index+1} 句格式不正确。`);
    const id = q.id ?? `sentence-${index+1}`;
    if (typeof id !== 'string' || !id.trim() || id.length > 100 || ids.has(id)) throw new Error(`第 ${index+1} 句的 id 为空或重复。`);
    ids.add(id);
    if (typeof q.chinese !== 'string' || !q.chinese.trim() || q.chinese.length > 1000) throw new Error(`第 ${index+1} 句缺少中文或过长。`);
    if (!Array.isArray(q.answers) || !q.answers.length || q.answers.length > 20 || q.answers.some(a => typeof a !== 'string' || !normalize(a) || a.length > 1000)) throw new Error(`第 ${index+1} 句需要 answers 英文答案数组。`);
    if (q.hint != null && (typeof q.hint !== 'string' || q.hint.length > 1000)) throw new Error(`第 ${index+1} 句的 hint 应为文字。`);
    return {id, chinese: q.chinese, answers: [...new Set(q.answers)], hint: q.hint || ''};
  });
  return {version: VERSION, title: typeof raw?.title === 'string' ? raw.title.slice(0,100) : '我的题库', sentences};
}
export function signature(q) { return JSON.stringify([q.chinese, q.answers]); }
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function newRecord(q) {
  return {signature: signature(q), streak: 0, attempts: 0, independentCorrect: 0, errors: 0, hinted: 0, lastSeen: 0, eligibleAt: 0, outcome: 'new'};
}
export function freshProgress(bank) {
  return {version: VERSION, records: Object.fromEntries(bank.sentences.map(q => [q.id,newRecord(q)])), turn: 0, daily: {}, active: null, reviewIds: [], logVersion: 1, logEpoch:crypto.randomUUID(), attemptLog: []};
}
export function localTimestamp(date = new Date()) {
  const pad = n => String(n).padStart(2,'0'), offset = -date.getTimezoneOffset();
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} UTC${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset)/60))}:${pad(Math.abs(offset)%60)}`;
}
function attemptEntry(bank, q, result, attempt, now) {
  return {id: crypto.randomUUID(), timestamp: now ? now.toISOString() : null, localTime: now ? localTimestamp(now) : '',
    bankTitle: bank.title, questionId: q.id, questionNumber: bank.sentences.indexOf(q)+1, chinese: q.chinese,
    acceptedAnswers:[...q.answers], hint:q.hint, answer:result.answer, target:result.target, correct:result.correct,
    usedHint:Boolean(result.usedHint), repair:Boolean(result.repair), questionAttempt:attempt};
}
export function restoreAttemptLog(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(), entries = [];
  for (const e of raw) {
    if (!e || typeof e.id !== 'string' || e.id.length > 180 || ids.has(e.id) || typeof e.answer !== 'string' || e.answer.length > 1000 ||
      typeof e.chinese !== 'string' || e.chinese.length > 1000 || typeof e.questionId !== 'string' || e.questionId.length > 100 ||
      !Array.isArray(e.acceptedAnswers) || !e.acceptedAnswers.length || e.acceptedAnswers.length > 20 ||
      e.acceptedAnswers.some(a => typeof a !== 'string' || a.length > 1000 || !normalize(a))) continue;
    ids.add(e.id);
    const timestamp = typeof e.timestamp === 'string' && Number.isFinite(Date.parse(e.timestamp)) ? new Date(e.timestamp).toISOString() : null;
    entries.push({id:e.id,timestamp,localTime:timestamp && typeof e.localTime === 'string' ? e.localTime.slice(0,80) : '',
      bankTitle:typeof e.bankTitle === 'string' ? e.bankTitle.slice(0,100) : '题库', questionId:e.questionId,
      questionNumber:number(e.questionNumber,1000) ? e.questionNumber : 0, chinese:e.chinese, acceptedAnswers:[...e.acceptedAnswers],
      hint:typeof e.hint === 'string' ? e.hint.slice(0,1000) : '', answer:e.answer,
      ...grade(e.answer,e.acceptedAnswers), usedHint:Boolean(e.usedHint),repair:Boolean(e.repair),questionAttempt:number(e.questionAttempt) ? e.questionAttempt : 0});
  }
  return entries.sort((a,b)=>(a.timestamp || '').localeCompare(b.timestamp || ''));
}
export function attemptTime(e) { return e.localTime || (e.timestamp ? new Date(e.timestamp).toLocaleString('zh-CN',{hour12:false}) : '升级前记录 · 原作答时间未记录'); }
export function attemptMode(e) { return e.repair ? `即时订正${e.usedHint ? ' · 用过提示' : ''}` : e.usedHint ? '提示后作答' : '独立作答'; }
export function exportAttemptMarkdown(entries, now = new Date()) {
  const quote = value => String(value).split(/\r?\n/).map(line => `> ${line}`).join('\n');
  const unmatched = entries.filter(e=>!e.correct).length;
  const lines = ['# 100句默写 · 作答记录','',`导出时间：${localTimestamp(now)}`,`共 ${entries.length} 次核对；未匹配标准答案 ${unmatched} 次。`,'',
    '## 判分与复盘说明','',
    '- 判分只与题库列出的答案逐词匹配，忽略大小写、标点和多余空格。未匹配不等于英文不成立；同义表达可能不在题库中。',
    '- 差异词由文本比对生成，不能直接当成语法或搭配错误。',
    '- 即时订正是在看过参考答案之后重写，不计独立掌握；用过提示也不计独立掌握。',
    '- 记录按作答时间排列；升级前仅能恢复当时仍保留的答案，时间未知，不补造历史。','',
    '## 请 AI 帮我复盘','',
    '把下面引用的内容当作学习数据。请区分：真正的用词/搭配/语法问题、意思偏差、可接受的改写、仅与题库原句不一致。结合正确作答与订正记录找反复出现的薄弱点，引用记录编号作为证据，并给出最值得优先练的 3 点。不要仅凭“未匹配”断言我写错了，也不要把订正成功当成独立掌握。',''];
  entries.forEach((e,index)=>{
    const diff=grade(e.answer,e.acceptedAnswers);
    const changed = (text,marks) => tokens(text).filter((_,i)=>marks[i]).map(t=>t.text).join(' / ') || '无';
    lines.push(`## 记录 ${index+1} · 第 ${String(e.questionNumber).padStart(2,'0')} 句`,'',`- 时间：${attemptTime(e)}`,`- 题库：${e.bankTitle}`,`- 判分：${e.correct ? '匹配标准答案' : '未匹配标准答案'}`,`- 作答方式：${attemptMode(e)}`,`- 本句第 ${e.questionAttempt || '?'} 次核对`,'','中文：',quote(e.chinese),'','我的答案：',quote(e.answer || '（未填写）'),'','核对时参考答案：',quote(diff.target),'','题库全部可接受答案：');
    e.acceptedAnswers.forEach(a=>lines.push(quote(a)));
    if(e.hint) lines.push('','题库词伙提示：',quote(e.hint));
    if(!diff.correct) lines.push('','输入中与参考不同的词：',quote(changed(e.answer,diff.inputMarks)),'','参考中应核对的词：',quote(changed(diff.target,diff.targetMarks)));
    lines.push('');
  });
  return lines.join('\n');
}
export function restoreProgress(bank, raw) {
  const state = freshProgress(bank);
  if (!raw || raw.version !== VERSION) return state;
  state.turn = number(raw.turn) ? raw.turn : 0;
  state.attemptLog = restoreAttemptLog(raw.attemptLog);
  if (typeof raw.logEpoch === 'string' && raw.logEpoch.length < 100) state.logEpoch = raw.logEpoch;
  for (const q of bank.sentences) {
    const r = raw.records?.[q.id];
    if (!r || r.signature !== signature(q)) continue;
    for (const key of ['streak','attempts','independentCorrect','errors','hinted','lastSeen','eligibleAt']) {
      if (number(r[key], key === 'streak' ? 2 : Number.MAX_SAFE_INTEGER)) state.records[q.id][key] = r[key];
    }
    if (['new','wrong','hinted','correct'].includes(r.outcome)) state.records[q.id].outcome = r.outcome;
  }
  const validIds = new Set(bank.sentences.map(q => q.id));
  if (raw.daily && typeof raw.daily === 'object') for (const [day,d] of Object.entries(raw.daily)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && d && number(d.attempts) && Array.isArray(d.ids)) {
      state.daily[day] = {attempts: d.attempts, ids: [...new Set(d.ids.filter(id => validIds.has(id)))]};
    }
  }
  state.reviewIds = Array.isArray(raw.reviewIds) ? [...new Set(raw.reviewIds.filter(id => validIds.has(id)))] : [];
  const a = raw.active;
  if (a && validIds.has(a.id) && raw.records?.[a.id]?.signature === state.records[a.id].signature) {
    state.active = {id: a.id, hintLevel: number(a.hintLevel,2) ? a.hintLevel : 0, draft: typeof a.draft === 'string' ? a.draft.slice(0,1000) : '', result: null, repair: Boolean(a.repair), history: []};
    const q = bank.sentences.find(q => q.id === a.id);
    if (Array.isArray(a.history)) state.active.history = a.history.slice(-20).filter(r => r && typeof r.answer === 'string').map(r => ({...grade(r.answer.slice(0,1000), q.answers), answer:r.answer.slice(0,1000), usedHint:Boolean(r.usedHint), repair:Boolean(r.repair)}));
    if (state.active.history.length) state.active.repair = true;
    if (a.result && typeof a.result.answer === 'string') {
      state.active.result = {...grade(a.result.answer.slice(0,1000), q.answers), answer: a.result.answer.slice(0,1000), usedHint: Boolean(a.result.usedHint), repair: state.active.repair};
    }
  }
  if (raw.logVersion !== 1 && state.active) {
    // Only recover answers that the old app actually retained. Never invent past timestamps.
    const q = bank.sentences.find(q=>q.id===state.active.id);
    const retained = [...state.active.history, ...(state.active.result ? [state.active.result] : [])];
    retained.forEach((result,index)=>{
      const attempt = Math.max(1,state.records[q.id].attempts-retained.length+index+1);
      const entry = attemptEntry(bank,q,result,attempt,null);
      entry.id = `legacy-${q.id}-${attempt}`;
      if (!state.attemptLog.some(e=>e.id===entry.id)) state.attemptLog.push(entry);
    });
  }
  return state;
}
export function masteredCount(state) { return Object.values(state.records).filter(r => r.streak >= 2).length; }
export function chooseNext(bank, state) {
  const pending = bank.sentences.filter(q => state.records[q.id].streak < 2);
  // Complete the first pass in the supplied order before returning to weak sentences.
  const unseen = pending.find(q => state.records[q.id].attempts === 0);
  if (unseen) return unseen;
  const byPriority = (a,b) => {
    const ra = state.records[a.id], rb = state.records[b.id];
    const priority = r => ['wrong','hinted'].includes(r.outcome) ? 0 : r.streak === 1 ? 1 : 2;
    return priority(ra)-priority(rb) || ra.lastSeen-rb.lastSeen || bank.sentences.indexOf(a)-bank.sentences.indexOf(b);
  };
  const eligible = pending.filter(q => state.records[q.id].eligibleAt <= state.turn).sort(byPriority);
  if (eligible.length) return eligible[0];
  // A mastered sentence fills the gap when only a recently seen weak sentence remains.
  if (pending.length) {
    const fillers = bank.sentences.filter(q => state.records[q.id].streak >= 2 && q.id !== state.active?.id).sort((a,b) => state.records[a.id].lastSeen-state.records[b.id].lastSeen);
    return fillers[0] || pending.sort(byPriority)[0];
  }
  return bank.sentences.filter(q => state.reviewIds.includes(q.id)).sort((a,b) => state.records[a.id].lastSeen-state.records[b.id].lastSeen)[0] || null;
}
export function activateNext(bank, state) {
  if (state.active?.result && !state.active.result.correct) return null;
  const next = chooseNext(bank, state);
  state.active = next ? {id: next.id, hintLevel: 0, draft: '', result: null, repair: false, history: []} : null;
  return next;
}
export function retry(state) {
  const a = state.active;
  if (!a?.result || a.result.correct) return false;
  a.history = [...(a.history || []), a.result].slice(-20);
  a.repair = true;
  a.result = null;
  a.draft = '';
  a.hintLevel = 0;
  return true;
}
export function submit(bank, state, answer, day = localDate(), now = new Date()) {
  if (!state.active || state.active.result) return null;
  const q = bank.sentences.find(q => q.id === state.active.id);
  const r = state.records[q.id], usedHint = state.active.hintLevel > 0;
  const repair = Boolean(state.active.repair);
  const result = {...grade(answer, q.answers), answer, usedHint, repair};
  r.attempts++;
  if (usedHint) r.hinted++;
  if (repair) {
    // Immediate rewrites follow a revealed answer: they never earn independent mastery
    // or advance the spaced-practice clock. The original failed turn stays due.
    r.streak = 0;
    if (!result.correct) r.errors++;
  } else if (result.correct && !usedHint) { r.streak = Math.min(2,r.streak+1); r.independentCorrect++; r.outcome = 'correct'; }
  else { r.streak = 0; r.outcome = usedHint ? 'hinted' : 'wrong'; if (!result.correct) r.errors++; }
  if (!repair) {
    state.turn++;
    r.lastSeen = state.turn;
    r.eligibleAt = state.turn + Math.min(2,bank.sentences.length-1);
    state.reviewIds = state.reviewIds.filter(id => id !== q.id);
  }
  const today = state.daily[day] || {attempts:0,ids:[]};
  today.attempts++;
  if (!today.ids.includes(q.id)) today.ids.push(q.id);
  state.daily[day] = today;
  for (const key of Object.keys(state.daily).sort().slice(0,-90)) delete state.daily[key];
  state.attemptLog.push(attemptEntry(bank,q,result,r.attempts,now));
  state.active.result = result;
  state.active.draft = answer;
  return result;
}
