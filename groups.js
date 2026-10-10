import {restoreProgress, activateNext} from './core.js?v=20261010-1';
import {restoreChunks, freshChunks} from './chunks-core.js?v=20261010-1';

export const GROUP_KEY = 'ielts100.group.v1';
export const GROUP_SIZE = 10;
const copy = value => structuredClone(value);

export function sentenceGroups(bank) {
  return Array.from({length:Math.ceil(bank.sentences.length/GROUP_SIZE)}, (_,i) => ({
    id:i+1, start:i*GROUP_SIZE, end:Math.min((i+1)*GROUP_SIZE,bank.sentences.length),
    sentences:bank.sentences.slice(i*GROUP_SIZE,(i+1)*GROUP_SIZE)
  }));
}
export function selectedGroup(bank,state) {
  return sentenceGroups(bank)[state.group-1] || sentenceGroups(bank)[0];
}
export function groupBank(bank,state) {return {...bank,sentences:selectedGroup(bank,state).sentences};}
export function groupLabel(g) {
  const first=g.sentences[0].number ?? g.start+1, last=g.sentences.at(-1).number ?? g.end;
  return `第 ${g.id} 组 · 第 ${String(first).padStart(2,'0')}–${String(last).padStart(2,'0')} 句`;
}
function clampGroup(bank,value,fallback=1) {
  const n=Number(value), groups=sentenceGroups(bank);
  return Number.isInteger(n)&&n>=1&&n<=groups.length?n:Math.min(fallback,groups.length);
}
export function rememberSentenceGroup(state) {
  state.groupSessions[state.group]={active:copy(state.active),reviewIds:[...state.reviewIds]};
}
export function initSentenceGroups(bank,state,raw) {
  const groups=sentenceGroups(bank), index=bank.sentences.findIndex(s=>s.id===state.active?.id);
  state.group=clampGroup(bank,raw?.group, index<0?1:Math.floor(index/GROUP_SIZE)+1);
  state.groupSessions={};
  for(const g of groups) {
    const ids=new Set(g.sentences.map(s=>s.id)), saved=raw?.groupSessions?.[g.id];
    const source=saved ? restoreProgress(bank,{...state,active:saved.active,reviewIds:saved.reviewIds}) : state;
    state.groupSessions[g.id]={active:ids.has(source.active?.id)?copy(source.active):null,
      reviewIds:source.reviewIds.filter(id=>ids.has(id))};
  }
  // The top-level session is the most recently saved one; it takes precedence.
  const ids=new Set(groups[state.group-1].sentences.map(s=>s.id));
  if(ids.has(state.active?.id))rememberSentenceGroup(state);
  else {state.active=null;state.reviewIds=state.groupSessions[state.group].reviewIds;}
  return state;
}
export function switchSentenceGroup(bank,state,value) {
  rememberSentenceGroup(state);
  state.group=clampGroup(bank,value,state.group);
  const session=state.groupSessions[state.group];
  state.active=copy(session.active);state.reviewIds=[...session.reviewIds];
  if(!state.active)activateNext(groupBank(bank,state),state);
  rememberSentenceGroup(state);
}

export function rememberChunkGroup(state) {
  state.groupSessions[state.group]={browseIndex:state.browseIndex,queue:[...state.queue],position:state.position,active:copy(state.active)};
}
export function initChunkGroups(bank,state,raw) {
  const groups=sentenceGroups(bank), activeId=state.active?.id;
  const activeIndex=bank.sentences.findIndex(s=>s.chunks.some(c=>c.id===activeId));
  const index=state.mode==='browse'?state.browseIndex:activeIndex;
  state.group=clampGroup(bank,raw?.group,index<0?1:Math.floor(index/GROUP_SIZE)+1);
  state.groupSessions={};
  for(const g of groups) {
    const ids=new Set(g.sentences.flatMap(s=>s.chunks.map(c=>c.id))), saved=raw?.groupSessions?.[g.id];
    let source;
    if(saved && Array.isArray(saved.queue) && saved.queue.every(id=>ids.has(id))) {
      source=restoreChunks(bank,{...state,...saved});
      // An invalid saved queue must never spill into another group.
      if(source.queue.some(id=>!ids.has(id)))source=null;
    }
    if(!source) {
      if(!raw?.groupSessions) {
        // Migrate a legacy full-bank round without replaying completed items.
        const queue=state.queue.filter(id=>ids.has(id));
        const position=state.queue.slice(0,state.position).filter(id=>ids.has(id)).length;
        source=restoreChunks(bank,{...state,queue,position,active:ids.has(activeId)?state.active:null});
      } else {
        source=freshChunks({...bank,sentences:g.sentences});source.browseIndex=g.start;
      }
    }
    state.groupSessions[g.id]={browseIndex:source.browseIndex>=g.start&&source.browseIndex<g.end?source.browseIndex:g.start,
      queue:[...source.queue],position:source.position,active:copy(source.active)};
  }
  // Preserve the active group, including a checked answer or a repair in progress.
  if(raw?.groupSessions) {
    const g=groups[state.group-1], ids=new Set(g.sentences.flatMap(s=>s.chunks.map(c=>c.id)));
    if(state.queue.every(id=>ids.has(id))){state.browseIndex=state.browseIndex>=g.start&&state.browseIndex<g.end?state.browseIndex:g.start;rememberChunkGroup(state);}
  }
  Object.assign(state,copy(state.groupSessions[state.group]));
  return state;
}
export function switchChunkGroup(bank,state,value) {
  rememberChunkGroup(state);state.group=clampGroup(bank,value,state.group);
  Object.assign(state,copy(state.groupSessions[state.group]));rememberChunkGroup(state);
}

export function renderGroupPicker(select,bank,state) {
  select.replaceChildren(...sentenceGroups(bank).map(g=>{
    const option=document.createElement('option');option.value=g.id;option.textContent=groupLabel(g);return option;
  }));
  select.value=state.group;
}
export function groupPickerKey(event,bank,state,change) {
  if(event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
  const last=sentenceGroups(bank).length;
  const value={ArrowUp:Math.max(1,state.group-1),ArrowDown:Math.min(last,state.group+1),Home:1,End:last}[event.key];
  if(value===undefined)return;
  event.preventDefault();change(value);
}
