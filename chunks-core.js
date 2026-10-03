import {grade,normalize} from './core.js?v=20261003-5';

export function validateChunks(raw) {
  if (raw?.format !== 'ielts100-chunks' || raw.version !== 1 || !Array.isArray(raw.sentences) || !raw.sentences.length || raw.sentences.length > 1000) throw new Error('请选择词伙题库 JSON。');
  const ids=new Set(),numbers=new Set(),sentenceIds=new Set();
  const text=(value,label,max=2000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${label}不正确。`);return value;};
  const notes=(rawNotes,sentence)=>{
    if(rawNotes==null)return [];
    if(!Array.isArray(rawNotes)||rawNotes.length>8)throw new Error('易错点格式不正确。');
    return rawNotes.map(n=>({text:text(n.text,'易错点'),focus:Array.isArray(n.focus)?n.focus.map(f=>{text(f,'标记文字');if(!sentence.includes(f))throw new Error('易错点标记不在原句中。');return f;}):[]}));
  };
  const sentences=raw.sentences.map(s=>{
    if(!Number.isInteger(s.number)||s.number<1||s.number>1000||numbers.has(s.number))throw new Error('句子编号为空或重复。');numbers.add(s.number);
    const id=text(s.id,'句子 ID',100),english=text(s.english,'英文原句'),chinese=text(s.chinese,'中文原句');
    if(sentenceIds.has(id))throw new Error('句子 ID 重复。');sentenceIds.add(id);
    if(!Array.isArray(s.chunks)||!s.chunks.length||s.chunks.length>8)throw new Error(`第${s.number}句缺少词伙。`);
    const chunks=s.chunks.map(c=>{
      const cid=text(c.id,'词伙 ID',150);if(ids.has(cid))throw new Error('词伙 ID 重复。');ids.add(cid);
      const phrase=text(c.english,'英文词伙',1000);if(!normalize(phrase)||!english.includes(phrase))throw new Error(`第${s.number}句词伙不在英文原句中。`);
      if(!['hint','supplement'].includes(c.source))throw new Error('词伙须注明原提示或补充。');
      return {id:cid,english:phrase,meaning:text(c.meaning,'中文释义',1000),source:c.source,meaningEdited:Boolean(c.meaningEdited),notes:notes(c.notes,english)};
    });
    return {id,number:s.number,english,chinese,chunks,notes:notes(s.notes,english)};
  }).sort((a,b)=>a.number-b.number);
  return {format:'ielts100-chunks',version:1,title:text(raw.title,'题库标题',100),sentences};
}
export function flattenChunks(bank) {return bank.sentences.flatMap(s=>s.chunks.map((c,index)=>({...c,sentence:s,index})));}
export function chunkSignature(c) {return JSON.stringify([c.english,c.meaning,c.sentence.english]);}
export function freshChunks(bank) {
  const flat=flattenChunks(bank);
  return {version:1,epoch:crypto.randomUUID(),mode:'browse',browseIndex:0,queue:flat.map(c=>c.id),position:0,active:{id:flat[0].id,draft:'',result:null,repair:false},log:[]};
}
export function restoreChunks(bank,raw) {
  const state=freshChunks(bank),flat=flattenChunks(bank),byId=new Map(flat.map(c=>[c.id,c]));
  if(raw?.version!==1)return state;
  state.epoch=typeof raw.epoch==='string'?raw.epoch:state.epoch;
  state.mode=raw.mode==='drill'?'drill':'browse';
  state.browseIndex=Number.isInteger(raw.browseIndex)?Math.max(0,Math.min(bank.sentences.length-1,raw.browseIndex)):0;
  const ids=new Set();
  state.log=(Array.isArray(raw.log)?raw.log:[]).filter(e=>{
    if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.answer!=='string'||!normalize(e.answer)||e.answer.length>1000||typeof e.signature!=='string'||!byId.has(e.chunkId))return false;
    const c=byId.get(e.chunkId);if(e.signature!==chunkSignature(c))return false;
    ids.add(e.id);return true;
  }).map(e=>{const c=byId.get(e.chunkId);return {id:e.id,chunkId:c.id,signature:chunkSignature(c),number:c.sentence.number,english:c.english,meaning:c.meaning,answer:e.answer,correct:grade(e.answer,[c.english]).correct,repair:Boolean(e.repair),timestamp:Number.isFinite(Date.parse(e.timestamp))?new Date(e.timestamp).toISOString():null};});
  if(Array.isArray(raw.queue)&&raw.queue.every(id=>byId.has(id))&&new Set(raw.queue).size===raw.queue.length&&Number.isInteger(raw.position)&&raw.position>=0&&raw.position<=raw.queue.length){
    state.queue=[...raw.queue];state.position=raw.position;
    const c=byId.get(state.queue[state.position]);
    if(!c)state.active=null;
    else if(raw.active?.id===c.id){
      state.active={id:c.id,draft:typeof raw.active.draft==='string'?raw.active.draft.slice(0,1000):'',result:null,repair:Boolean(raw.active.repair)};
      const entry=state.log.find(e=>e.id===raw.active.result?.logId);
      if(entry&&entry.chunkId===c.id)state.active.result={...grade(entry.answer,[c.english]),answer:entry.answer,repair:entry.repair,logId:entry.id};
    }else state.active={id:c.id,draft:'',result:null,repair:false};
  }
  return state;
}
export function submitChunk(bank,state,answer,now=new Date()) {
  if(!state.active||state.active.result||!normalize(answer))return null;
  const c=flattenChunks(bank).find(c=>c.id===state.active.id);
  const id=crypto.randomUUID(),result={...grade(answer,[c.english]),answer,repair:state.active.repair,logId:id};
  state.log.push({id,chunkId:c.id,signature:chunkSignature(c),number:c.sentence.number,english:c.english,meaning:c.meaning,answer,correct:result.correct,repair:result.repair,timestamp:now.toISOString()});
  state.active.result=result;state.active.draft=answer;return result;
}
export function retryChunk(state) {
  if(!state.active?.result||state.active.result.correct)return false;
  state.active={id:state.active.id,draft:'',result:null,repair:true};return true;
}
export function nextChunk(state) {
  if(!state.active?.result?.correct)return false;
  state.position++;
  const id=state.queue[state.position];state.active=id?{id,draft:'',result:null,repair:false}:null;return true;
}
export function startChunkRound(bank,state,errorsOnly=false) {
  const wrong=new Set(state.log.filter(e=>!e.correct).map(e=>e.chunkId));
  state.queue=flattenChunks(bank).filter(c=>!errorsOnly||wrong.has(c.id)).map(c=>c.id);state.position=0;state.mode='drill';
  state.active=state.queue.length?{id:state.queue[0],draft:'',result:null,repair:false}:null;
}
export function chunkStats(state) {
  return {correct:state.log.filter(e=>e.correct).length,wrong:state.log.filter(e=>!e.correct).length,practised:new Set(state.log.map(e=>e.chunkId)).size};
}
