const audioKey = text => text.normalize('NFKC').trim().replace(/\s+/g,' ');
const DB_NAME = 'ielts100.audio.v1';

function openAudioDatabase() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME,1);
    request.onupgradeneeded = () => request.result.createObjectStore('packs');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('浏览器无法保存语音包。'));
    request.onblocked = () => reject(new Error('请关闭其他练习标签后重试导入。'));
  });
}
async function storedPack(value,key='current') {
  const db = await openAudioDatabase();
  try {
    return await new Promise((resolve,reject) => {
      const transaction = db.transaction('packs',value ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('packs');
      const request = value ? store.put(value,key) : store.get(key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = transaction.onerror = () => reject(new Error('语音包保存失败，原语音包仍保留。'));
    });
  } finally { db.close(); }
}

function decodePack(raw,format='ielts100-audio') {
  if (raw?.format !== format || raw.version !== 1 || !Array.isArray(raw.entries) || !raw.entries.length || raw.entries.length > 1000) throw new Error('请选择正确的语音包 JSON。');
  if (typeof raw.voice !== 'string' || !raw.voice.trim() || raw.voice.length > 120) throw new Error('语音包缺少音色名称。');
  const keys = new Set();
  const entries = raw.entries.map((entry,index) => {
    if (typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 1000 || entry.mime !== 'audio/mpeg' || typeof entry.base64 !== 'string' || entry.base64.length > 2000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(entry.base64)) throw new Error(`语音包第 ${index+1} 条格式不正确。`);
    const key = audioKey(entry.text);
    if (keys.has(key)) throw new Error('语音包有重复句子。');
    keys.add(key);
    const bytes = Uint8Array.from(atob(entry.base64),character=>character.charCodeAt(0));
    if (bytes.length < 100 || !(bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51 || bytes[0] === 255 && (bytes[1] & 224) === 224)) throw new Error(`语音包第 ${index+1} 条不是 MP3。`);
    return {text:entry.text,blob:new Blob([bytes],{type:'audio/mpeg'})};
  });
  return {voice:raw.voice,entries};
}

// Prefer a recognisable British female voice when a local recording is absent.
function browserVoice() {
  const voices = window.speechSynthesis?.getVoices().filter(v=>/^en(?:[-_]|$)/i.test(v.lang)) || [];
  const british = voices.filter(v=>/^en[-_]GB$/i.test(v.lang));
  return british.find(v=>/sonia|libby|serena|kate|martha|flo|hazel|amy/i.test(v.name)) || british[0] || voices[0] || null;
}

export function createNarration(onChange = () => {},{packKey='current',format='ielts100-audio'}={}) {
  let clips = new Map(), voiceName = '', player = null, objectUrl = null, generation = 0, utterance = null;
  let state = {playing:false,message:''};
  const update = (playing,message='') => { state={playing,message}; onChange(state); };
  function stop() {
    generation++;
    if (player) { player.onended = player.onerror = null; player.pause(); player.removeAttribute('src'); player.load(); player = null; }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (utterance) { utterance.onend = utterance.onerror = null; window.speechSynthesis?.cancel(); utterance = null; }
    update(false);
  }
  function describe(text) {
    if (clips.has(audioKey(text))) return `${voiceName} · 本机音频`;
    const voice = browserVoice();
    if (voice) return `${voice.name} · ${voice.lang} · 浏览器语音`;
    return window.speechSynthesis ? '浏览器英文语音 · 可导入 Sonia 语音包' : '导入语音包后可朗读';
  }
  function play(text) {
    stop();
    const current = generation, clip = clips.get(audioKey(text));
    if (clip) {
      objectUrl = URL.createObjectURL(clip); player = new Audio(objectUrl);
      player.onended = () => { if (current === generation) stop(); };
      player.onerror = () => {
        if (current !== generation) return;
        stop(); update(false,'音频未能播放，请点「重听」再试。');
      };
      update(true,`${voiceName} · 本机音频`);
      // Start inside the user gesture; do not wait for playback before the next action.
      player.play().catch(() => {
        if (current !== generation) return;
        stop(); update(false,'浏览器未允许自动朗读，请点「重听」。');
      });
      return;
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { update(false,'当前浏览器没有英文语音，请导入语音包。'); return; }
    try {
      const voice = browserVoice();
      utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang || 'en-GB'; utterance.voice = voice; utterance.rate = .95;
      utterance.onend = () => { if (current === generation) { utterance=null; update(false); } };
      utterance.onerror = () => { if (current === generation) { utterance=null; update(false,'浏览器语音不可用，可导入 Sonia 语音包后重听。'); } };
      update(true,describe(text));
      window.speechSynthesis.speak(utterance);
    } catch { utterance=null; update(false,'朗读暂时不可用，可导入语音包后重听。'); }
  }
  function applyPack(pack) {
    clips = new Map(pack.entries.filter(e=>typeof e.text==='string' && e.blob instanceof Blob).map(e=>[audioKey(e.text),e.blob]));
    voiceName = pack.voice;
  }
  return {
    stop,play,describe,
    has: text => clips.has(audioKey(text)),
    get state() { return state; },
    summary(bank) {
      const count = bank ? bank.sentences.filter(q=>clips.has(audioKey(q.answers[0]))).length : 0;
      return clips.size ? `${voiceName} · 当前题库 ${count} / ${bank?.sentences.length || 0} 句有本机音频` : '未导入语音包，使用浏览器提供的英文语音。';
    },
    async load() {
      try { const pack = await storedPack(undefined,packKey); if (pack?.entries) applyPack(pack); } catch {}
      onChange(state);
    },
    async importPack(raw) {
      const pack = decodePack(raw,format);
      await storedPack(pack,packKey);
      stop(); applyPack(pack); onChange(state);
      return clips.size;
    }
  };
}
