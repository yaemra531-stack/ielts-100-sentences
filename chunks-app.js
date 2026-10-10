import {tokens,grade,normalize} from './core.js?v=20261010-1';
import {validateChunks,flattenChunks,freshChunks,restoreChunks,submitChunk,retryChunk,nextChunk,startChunkRound,chunkStats} from './chunks-core.js?v=20261010-1';
import {GROUP_KEY, selectedGroup, groupBank, renderGroupPicker, groupPickerKey, initChunkGroups, switchChunkGroup, rememberChunkGroup} from './groups.js?v=20261010-1';
import {createNarration} from './narration.js?v=20261003-6';

const BANK_KEY='ielts100.chunks.bank.v1',STATE_KEY='ielts100.chunks.progress.v1',THEME_KEY='ielts100.theme.v1';
const $=id=>document.getElementById(id);
let bank,state,flat,byId,logLimit=20,storageOkay=true;
const AUDIO_PREF='ielts100.chunks.narration.v1';
let autoAudio=true,activeAudio=null;
try{autoAudio=localStorage.getItem(AUDIO_PREF)!=='off';}catch{}
const chunkAudio=createNarration(renderAudio,{packKey:'chunks',format:'ielts100-chunk-audio'});
const sentenceAudio=createNarration(renderAudio);
function stopAudio(){activeAudio=null;chunkAudio.stop();sentenceAudio.stop();}
function playAudio(kind,text){
  const channel=kind==='chunk'?chunkAudio:sentenceAudio;
  if(activeAudio?.kind===kind&&activeAudio.text===text&&channel.state.playing){stopAudio();return;}
  stopAudio();activeAudio={kind,text};channel.play(text);
}
function renderAudio(){
  $('chunk-auto-audio').checked=autoAudio;
  document.querySelectorAll('[data-chunk-audio]').forEach(button=>{
    const playing=activeAudio?.kind==='chunk'&&activeAudio.text===button.dataset.chunkAudio&&chunkAudio.state.playing;
    button.textContent=`${button.dataset.chunkKey} ${playing?'■':'▶'}`;button.setAttribute('aria-pressed',String(Boolean(playing)));
    button.setAttribute('aria-label',`${playing?'停止':'朗读'}词伙：${button.dataset.chunkAudio}`);
  });
  const c=byId?.get(state?.active?.id),visible=state?.mode==='drill'&&Boolean(state.active?.result);
  const playing=visible&&activeAudio?.kind==='chunk'&&activeAudio.text===c?.english&&chunkAudio.state.playing;
  $('chunk-replay').textContent=playing?'■ 停止朗读':'▶ 重听词伙';
  const target=activeAudio?.kind==='chunk'?chunkAudio:sentenceAudio;
  $('chunk-audio-note').textContent=visible?(activeAudio?target.state.message:chunkAudio.describe(c.english)):'';
  $('browse-audio-note').textContent=activeAudio?target.state.message:'按需听词伙或原句。';
  for(const [id,text] of [['browse-sentence-play',bank?.sentences[state?.browseIndex]?.english],['drill-sentence-play',visible?c?.sentence.english:null]]){
    $(id).textContent=activeAudio?.kind==='sentence'&&activeAudio.text===text&&sentenceAudio.state.playing?'■ 停止原句':'▶ 朗读原句';
  }
  if(bank){const count=flat.filter(c=>chunkAudio.has(c.english)).length;const first=flat.find(c=>chunkAudio.has(c.english));$('chunk-audio-bank').textContent=first?`${chunkAudio.describe(first.english)} · ${count} / ${flat.length} 项词伙有录音`:'未导入词伙录音，使用浏览器提供的英文语音。';$('chunk-sentence-audio-bank').textContent=sentenceAudio.summary({sentences:bank.sentences.map(s=>({answers:[s.english]}))});}
}
function chunkPlayButton(text,number){const b=document.createElement('button');b.type='button';b.className='chunk-play';b.dataset.chunkAudio=text;b.dataset.chunkKey=String(number);b.title=`按 ${number} 朗读 / 停止`;b.setAttribute('aria-keyshortcuts',String(number));b.onclick=()=>playAudio('chunk',text);return b;}
$('chunk-replay').onclick=()=>{const c=byId?.get(state?.active?.id);if(state?.mode==='drill'&&state.active?.result)playAudio('chunk',c.english);};
$('browse-sentence-play').onclick=()=>{if(state?.mode==='browse')playAudio('sentence',bank.sentences[state.browseIndex].english);};
$('drill-sentence-play').onclick=()=>{const c=byId?.get(state?.active?.id);if(state?.mode==='drill'&&state.active?.result)playAudio('sentence',c.sentence.english);};
$('chunk-auto-audio').onchange=()=>{autoAudio=$('chunk-auto-audio').checked;try{localStorage.setItem(AUDIO_PREF,autoAudio?'on':'off');}catch{}if(!autoAudio)stopAudio();};
$('chunk-audio-import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>30*1024*1024)throw new Error('词伙语音包请小于 30 MB。');const count=await chunkAudio.importPack(JSON.parse(await file.text()));stopAudio();renderAudio();settingsMessage(`已保存 ${count} 种词伙录音。整句语音包与学习记录未改变。`);}catch(error){settingsMessage(`${error instanceof SyntaxError?'词伙语音包 JSON 格式不正确。':error.message} 原录音与学习记录未改变。`,true);}};
window.speechSynthesis?.addEventListener('voiceschanged',renderAudio);
void Promise.all([chunkAudio.load(),sentenceAudio.load()]);
function notice(message){$('chunk-notice').textContent=message;$('chunk-notice').hidden=false;}
function storageWarning(){storageOkay=false;$('chunk-save-status').textContent='词伙记录暂时无法保存';notice('浏览器暂时无法保存词伙记录。离开前请导出词伙备份。');}
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{storageWarning();return null;}}
function save(replace=false){if(!state)return;try{const existing=JSON.parse(localStorage.getItem(STATE_KEY)||'null');if(!replace&&existing?.epoch&&existing.epoch!==state.epoch){notice('另一词伙页面已重置记录或恢复备份。请刷新本页后继续，避免覆盖。');return;}if(!replace&&existing?.log){const merged=restoreChunks(bank,{...state,log:[...existing.log,...state.log]});state.log=merged.log.sort((a,b)=>(a.timestamp||'').localeCompare(b.timestamp||''));}rememberChunkGroup(state);localStorage.setItem(STATE_KEY,JSON.stringify(state));}catch{storageWarning();}}
function setBank(value){bank=value;flat=flattenChunks(bank);byId=new Map(flat.map(c=>[c.id,c]));$('sentence-jump').replaceChildren(...bank.sentences.map((s,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`第 ${String(s.number).padStart(2,'0')} 句`;return option;}));}

let theme=null;
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
try{const choice=localStorage.getItem(THEME_KEY);if(['dark','light'].includes(choice))theme=choice;}catch{}
function applyTheme(){const dark=(theme||(systemTheme.matches?'dark':'light'))==='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#181e1b':'#f4f3ee');$('theme-toggle').textContent=dark?'☀':'☾';$('theme-toggle').setAttribute('aria-pressed',String(dark));$('theme-toggle').setAttribute('aria-label',dark?'切换日间模式':'切换夜间模式');}
$('theme-toggle').onclick=()=>{theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem(THEME_KEY,theme);}catch{}applyTheme();};
systemTheme.addEventListener('change',()=>{if(!theme)applyTheme();});applyTheme();

function highlighted(el,text,focus=[]){
  const ranges=[];
  for(const word of new Set(focus.filter(Boolean))){let start=0;while((start=text.indexOf(word,start))!==-1){const end=start+word.length,before=text[start-1]||'',after=text[end]||'';if(!(/[\p{L}\p{N}]/u.test(word[0])&&/[\p{L}\p{N}]/u.test(before))&&!(/[\p{L}\p{N}]/u.test(word.at(-1))&&/[\p{L}\p{N}]/u.test(after)))ranges.push([start,end]);start=end;}}
  ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const r of ranges){const last=merged.at(-1);if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push([...r]);}
  el.replaceChildren();let pos=0;
  for(const [start,end] of merged){el.append(document.createTextNode(text.slice(pos,start)));const mark=document.createElement('mark');mark.className='grammar-mark';mark.textContent=text.slice(start,end);el.append(mark);pos=end;}
  el.append(document.createTextNode(text.slice(pos)));
}
function notes(el,list){el.replaceChildren();if(!list.length)return;const ul=document.createElement('ul');ul.className='grammar-notes';for(const n of list){const li=document.createElement('li');li.textContent=n.text;ul.append(li);}el.append(ul);}
function difference(el,text,marks,css){el.replaceChildren();let pos=0;tokens(text).forEach((t,i)=>{el.append(document.createTextNode(text.slice(pos,t.start)));if(marks[i]){const span=document.createElement('span');span.className=css;span.textContent=t.text;el.append(span);}else el.append(document.createTextNode(t.text));pos=t.end;});el.append(document.createTextNode(text.slice(pos)));}
function para(parent,text,css=''){const p=document.createElement('p');p.textContent=text;if(css)p.className=css;parent.append(p);return p;}
function renderBrowse(){
  const s=bank.sentences[state.browseIndex];$('sentence-jump').value=state.browseIndex;
  $('browse-number').textContent=`${String(s.number).padStart(2,'0')} / ${bank.sentences.length}`;$('browse-chinese').textContent=s.chinese;
  $('chunk-cards').replaceChildren();
  for(const [i,c] of s.chunks.entries()){const card=document.createElement('section');card.className='chunk-item';const head=document.createElement('div');head.className='chunk-item-heading';const line=document.createElement('div');line.className='chunk-english-line';const english=para(line,'','chunk-english');highlighted(english,c.english,c.notes.flatMap(n=>n.focus).filter(f=>c.english.includes(f)));line.append(chunkPlayButton(c.english,i+1));head.append(line);para(head,c.meaning,'chunk-chinese');card.append(head);if(c.source==='supplement')para(card,'补充词伙','chunk-source-label');if(c.meaningEdited)para(card,'释义校对','chunk-source-label');const n=document.createElement('div');notes(n,c.notes);card.append(n);$('chunk-cards').append(card);}
  highlighted($('browse-source'),s.english,[...s.notes,...s.chunks.flatMap(c=>c.notes)].flatMap(n=>n.focus));notes($('browse-source-notes'),s.notes);
  const group=selectedGroup(bank,state);
  $('browse-previous').disabled=state.browseIndex===group.start;$('browse-next').disabled=state.browseIndex===group.end-1;
  renderAudio();
}
function renderDrill(){
  const c=byId.get(state.active?.id),result=state.active?.result;
  $('chunk-practice').hidden=!c;$('chunk-complete').hidden=Boolean(c);
  if(!c)return;
  $('drill-number').textContent=`第 ${String(c.sentence.number).padStart(2,'0')} 句 · 词伙 ${c.index+1} / ${c.sentence.chunks.length}`;
  $('drill-position').textContent=`${state.position+1} / ${state.queue.length}`;$('chunk-meaning').textContent=c.meaning;
  $('chunk-context').textContent=`中文语境：${c.sentence.chinese}`;$('chunk-form').hidden=Boolean(result);$('chunk-feedback').hidden=!result;
  if(!result){$('chunk-answer').value=state.active.draft;for(const id of ['chunk-own','chunk-reference','drill-notes','drill-source','drill-source-notes'])$(id).replaceChildren();return;}
  $('chunk-feedback').classList.toggle('unmatched',!result.correct);
  $('chunk-result-title').textContent=result.correct?'✓ 词伙写对了。':'再核对一下这个词伙。';
  $('chunk-result-mode').textContent=result.correct?(result.repair?'即时订正已记录；下一轮再凭记忆写。':'独立答对已记录。'):'先看差异，再隐藏答案重写；对错分别留在记录里。';
  $('chunk-own-block').hidden=result.correct;difference($('chunk-own'),result.answer,result.inputMarks,'word-error');difference($('chunk-reference'),c.english,result.targetMarks,'word-needed');
  notes($('drill-notes'),c.notes);highlighted($('drill-source'),c.sentence.english,[...c.notes,...c.sentence.notes].flatMap(n=>n.focus));notes($('drill-source-notes'),c.sentence.notes);
  $('chunk-diff-legend').textContent=result.correct?'大小写与标点不计错':'红色：多写 / 写错 · 绿色：漏写 / 应替换';$('chunk-retry').hidden=result.correct;$('chunk-next').hidden=!result.correct;
}
function renderLog(){
  $('chunk-log-count').textContent=`· ${state.log.length} 次核对`;
  const filter=$('chunk-log-filter').value;
  const current=state.mode==='drill'&&!state.active?.result?state.active?.id:null;
  const currentEnglish=current?normalize(byId.get(current).english):null;
  const entries=state.log.filter(e=>(!currentEnglish||normalize(e.english)!==currentEnglish)&&(filter==='all'||(filter==='correct'?e.correct:!e.correct)));
  $('chunk-log-list').replaceChildren();
  if(current&&state.log.some(e=>e.chunkId===current))para($('chunk-log-list'),'当前词伙的旧答案暂时隐藏，核对后再显示。','journal-note');
  if(!entries.length)para($('chunk-log-list'),'这里会按时间保存每次作答。','journal-note');
  entries.slice(0,logLimit).forEach(e=>{
    const c=byId.get(e.chunkId),item=document.createElement('article');item.className='journal-item';
    para(item,`第 ${String(e.number).padStart(2,'0')} 句 · 词伙 ${c.index+1} · ${e.timestamp?new Date(e.timestamp).toLocaleString('zh-CN',{hour12:false}):'时间未记录'}`,'chunk-journal-meta');
    para(item,`${e.correct?'答对':'未匹配'} · ${e.repair?'即时订正':'独立作答'}`,`chunk-journal-outcome ${e.correct?'matched':'unmatched'}`);
    para(item,e.meaning,'journal-chinese');para(item,'我的词伙','answer-label');const own=para(item,'');const diff=grade(e.answer,[c.english]);difference(own,e.answer,diff.inputMarks,'word-error');
    para(item,'原词伙','answer-label');const ref=para(item,'');difference(ref,c.english,diff.targetMarks,'word-needed');$('chunk-log-list').append(item);
  });$('chunk-log-more').hidden=entries.length<=logLimit;
}
function render(){if(!state)return;renderGroups();const scope=groupBank(bank,state), scopeChunks=flattenChunks(scope), ids=new Set(scopeChunks.map(c=>c.id));const stats=chunkStats({log:state.log.filter(e=>ids.has(e.chunkId))});const attempts=stats.correct+stats.wrong;$('chunk-total').textContent=`${scope.sentences.length} 句 · ${scopeChunks.length} 项词伙`;$('chunk-practised').textContent=`已练 ${stats.practised} 项`;if($('chunk-attempts'))$('chunk-attempts').textContent=attempts;$('chunk-correct').textContent=stats.correct;if($('chunk-wrong'))$('chunk-wrong').textContent=stats.wrong;$('chunk-bank-label').textContent=bank.title;$('chunk-settings-bank').textContent=`${bank.title} · ${bank.sentences.length} 句 / ${flat.length} 项词伙`;
  const browse=state.mode==='browse';$('browse-panel').hidden=!browse;$('drill-panel').hidden=browse;$('browse-mode').setAttribute('aria-pressed',String(browse));$('drill-mode').setAttribute('aria-pressed',String(!browse));
  if(browse)renderBrowse();else renderDrill();renderLog();renderAudio();
}
function setupGroups(source,useShared=true){
  initChunkGroups(bank,state,source);switchChunkGroup(bank,state,useShared?(read(GROUP_KEY)??state.group):state.group);
  try{localStorage.setItem(GROUP_KEY,String(state.group));}catch{storageWarning();}
}
function renderGroups(){
  const group=selectedGroup(bank,state);
  renderGroupPicker($('group-select'),bank,state);
  $('group-summary').textContent=`先练本组词伙，再写这 ${group.sentences.length} 句`;
  $('sentence-jump').replaceChildren(...group.sentences.map((s,i)=>{const option=document.createElement('option');option.value=group.start+i;option.textContent=`第 ${String(s.number).padStart(2,'0')} 句`;return option;}));
  $('next-group').hidden=state.group>=Math.ceil(bank.sentences.length/10);
}
function changeGroup(value,broadcast=true){
  if(!state)return;stopAudio();switchChunkGroup(bank,state,value);save();
  if(broadcast)try{localStorage.setItem(GROUP_KEY,String(state.group));}catch{storageWarning();}
  if(storageOkay)$('chunk-notice').hidden=true;render();
}
$('group-select').onchange=e=>changeGroup(Number(e.target.value));
$('group-select').onkeydown=e=>groupPickerKey(e,bank,state,changeGroup);
$('next-group').onclick=()=>{changeGroup(state.group+1);focusDrill();};
function focusDrill(){if(state?.mode!=='drill'||$('chunk-settings').open)return;const el=state.active?.result?(state.active.result.correct?$('chunk-next'):$('chunk-retry')):state.active?$('chunk-answer'):$('round-all');el.focus({preventScroll:true});}
function changeMode(mode){if(!state)return;stopAudio();state.mode=mode;save();render();if(mode==='drill')focusDrill();}
$('browse-mode').onclick=()=>changeMode('browse');$('drill-mode').onclick=()=>changeMode('drill');
function browseStep(delta){if(!state)return;stopAudio();const group=selectedGroup(bank,state);state.browseIndex=Math.max(group.start,Math.min(group.end-1,state.browseIndex+delta));save();renderBrowse();}
$('browse-previous').onclick=()=>browseStep(-1);$('browse-next').onclick=()=>browseStep(1);$('sentence-jump').onchange=e=>{stopAudio();state.browseIndex=Number(e.target.value);save();renderBrowse();};
$('chunk-answer').oninput=e=>{if(state?.active){state.active.draft=e.target.value;save();}};
$('chunk-form').onsubmit=e=>{e.preventDefault();if(!state?.active||state.active.result)return;const answer=$('chunk-answer').value;if(!normalize(answer)){notice('先写出英文词伙，再核对。');$('chunk-answer').focus();return;}submitChunk(bank,state,answer);save();render();focusDrill();if(autoAudio)playAudio('chunk',byId.get(state.active.id).english);};
$('chunk-retry').onclick=()=>{if(retryChunk(state)){stopAudio();save();render();focusDrill();}};
$('chunk-next').onclick=()=>{if(nextChunk(state)){stopAudio();save();render();focusDrill();}};
function round(errors){stopAudio();startChunkRound(groupBank(bank,state),state,errors);save();render();focusDrill();}
$('round-all').onclick=()=>round(false);$('round-errors').onclick=()=>round(true);
$('chunk-log-filter').onchange=()=>{logLimit=20;renderLog();};$('chunk-log-more').onclick=()=>{logLimit+=20;renderLog();};
document.addEventListener('keydown',e=>{
  if(!state||e.isComposing||e.repeat||e.ctrlKey||e.metaKey||e.altKey||$('chunk-settings').open)return;
  if(state.mode==='browse'&&!e.shiftKey&&!e.target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])')){
    if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();browseStep(e.key==='ArrowLeft'?-1:1);}
    else if(/^[1-8]$/.test(e.key)){const c=bank.sentences[state.browseIndex].chunks[Number(e.key)-1];if(c){e.preventDefault();playAudio('chunk',c.english);}}
    else if(e.key==='0'||(e.key===' '&&!e.target.closest('button,a,summary'))){e.preventDefault();$('browse-sentence-play').click();}
    else if(e.key==='Escape'){e.preventDefault();stopAudio();}
  }
  if(state.mode==='drill'&&e.key==='Enter'&&state.active&&(!e.target.matches('button,a,select,summary')||e.target===$('chunk-retry')||e.target===$('chunk-next'))){e.preventDefault();if(state.active.result)(state.active.result.correct?$('chunk-next'):$('chunk-retry')).click();else $('chunk-form').requestSubmit();}
});
document.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='r'&&!e.repeat&&!e.isComposing&&!$('chunk-settings').open&&state?.mode==='drill'&&state.active?.result){e.preventDefault();$('chunk-replay').click();}});
function settingsMessage(message,error=false){$('chunk-settings-message').textContent=message;$('chunk-settings-message').classList.toggle('error',error);$('chunk-settings-message').hidden=false;}
$('chunk-settings-open').onclick=()=>{stopAudio();$('chunk-settings-message').hidden=true;$('chunk-settings').showModal();};$('chunk-settings-close').onclick=()=>$('chunk-settings').close();$('chunk-settings').addEventListener('close',focusDrill);
function exportBackup(){if(!state)return;const backup={format:'ielts100-chunks-backup',version:1,exportedAt:new Date().toISOString(),bank,progress:state};const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`词伙备份-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('chunk-export').onclick=exportBackup;$('settings-export').onclick=exportBackup;
$('chunk-import').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{if(file.size>20*1024*1024)throw new Error('请选择小于 20 MB 的 JSON。');const raw=JSON.parse(await file.text());const backup=raw.format==='ielts100-chunks-backup';if(backup&&raw.version!==1)throw new Error('词伙备份版本不支持。');const nextBank=validateChunks(backup?raw.bank:raw);const source=backup?raw.progress:state;const nextState=restoreChunks(nextBank,source);if(!confirm(backup?'恢复此词伙备份？只替换词伙页的数据。':'导入此词伙题库？相同词伙的记录会保留，只影响词伙页。'))return;
    stopAudio();setBank(nextBank);state=nextState;setupGroups(source,!backup);rememberChunkGroup(state);try{localStorage.setItem(BANK_KEY,JSON.stringify(bank));localStorage.setItem(STATE_KEY,JSON.stringify(state));}catch{storageWarning();}render();settingsMessage(`已导入 ${bank.sentences.length} 句、${flat.length} 项词伙。整句页面的数据未改变。`);
  }catch(error){settingsMessage(`${error instanceof SyntaxError?'JSON 格式不正确。':error.message} 当前词伙题库与记录未改变。`,true);}
};
$('chunk-reset').onclick=()=>{if(!confirm('清空全部分组的词伙作答记录和位置？整句学习进度与语音包不受影响。'))return;stopAudio();state=freshChunks(bank);setupGroups(null);save(true);render();settingsMessage('词伙记录已重置。');};
let syncTimer;
window.addEventListener('storage',e=>{
  if(e.key===GROUP_KEY && state){const latest=read(GROUP_KEY);if(latest!==state.group)changeGroup(latest,false);return;}
  if(e.key===AUDIO_PREF){autoAudio=e.newValue!=='off';if(!autoAudio)stopAudio();renderAudio();return;}
  if(e.key===THEME_KEY){theme=['dark','light'].includes(e.newValue)?e.newValue:null;applyTheme();return;}
  if(e.key!==STATE_KEY&&e.key!==BANK_KEY)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>{try{stopAudio();const next=read(BANK_KEY);if(next)setBank(validateChunks(next));const saved=read(STATE_KEY);state=restoreChunks(bank,saved);setupGroups(saved);render();notice('已同步另一词伙页面的最新记录。');}catch{notice('另一页面的词伙题库无法读取，请先导出本页备份。');}},50);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});
window.addEventListener('pagehide',stopAudio);
async function init(){
  try{const saved=read(BANK_KEY);if(saved)setBank(validateChunks(saved));else{const res=await fetch('./chunks-example.json');if(!res.ok)throw new Error('示例词伙题库读取失败。');setBank(validateChunks(await res.json()));}const savedState=read(STATE_KEY);state=restoreChunks(bank,savedState);setupGroups(savedState);render();save();focusDrill();}
  catch(error){notice(`词伙页暂时无法加载：${error.message} 请在网站地址中打开，或通过设置导入词伙题库。`);}
}
void init();
