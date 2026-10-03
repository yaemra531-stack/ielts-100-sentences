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
  return {version: VERSION, records: Object.fromEntries(bank.sentences.map(q => [q.id,newRecord(q)])), turn: 0, daily: {}, active: null, reviewIds: []};
}
export function restoreProgress(bank, raw) {
  const state = freshProgress(bank);
  if (!raw || raw.version !== VERSION) return state;
  state.turn = number(raw.turn) ? raw.turn : 0;
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
  return state;
}
export function masteredCount(state) { return Object.values(state.records).filter(r => r.streak >= 2).length; }
export function chooseNext(bank, state) {
  const pending = bank.sentences.filter(q => state.records[q.id].streak < 2);
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
export function submit(bank, state, answer, day = localDate()) {
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
  state.active.result = result;
  state.active.draft = answer;
  return result;
}
