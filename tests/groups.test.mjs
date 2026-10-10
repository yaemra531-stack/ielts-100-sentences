import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateBank,freshProgress,restoreProgress,activateNext,submit,retry} from '../core.js';
import {validateChunks,flattenChunks,freshChunks,restoreChunks,submitChunk,nextChunk,retryChunk,startChunkRound} from '../chunks-core.js';
import {sentenceGroups,groupBank,initSentenceGroups,switchSentenceGroup,rememberSentenceGroup,initChunkGroups,switchChunkGroup,rememberChunkGroup} from '../groups.js';

import {bank,chunks} from './group-fixture.mjs';
const save=s=>JSON.parse(JSON.stringify(s));

test('100 sentences divide into ten matching ordered groups without changing source',()=>{
  const a=sentenceGroups(bank),b=sentenceGroups(chunks);
  assert.equal(a.length,10);assert.equal(b.length,10);
  a.forEach((g,i)=>{assert.equal(g.sentences.length,10);assert.deepEqual(g.sentences.map(s=>s.id),b[i].sentences.map(s=>s.id));});
  assert.equal(a[9].sentences[0].id,'s91');assert.equal(a[9].sentences.at(-1).id,'s100');
});
test('whole practice stays inside ten sentences, retains global log numbers and needs two successes',()=>{
  const state=initSentenceGroups(bank,freshProgress(bank));switchSentenceGroup(bank,state,2);
  for(let i=0;i<20;i++){
    const q=bank.sentences.find(q=>q.id===state.active.id);assert.ok(Number(q.id.slice(1))>=11&&Number(q.id.slice(1))<=20);
    submit(bank,state,q.answers[0]);activateNext(groupBank(bank,state),state);
  }
  assert.equal(state.active,null);assert.equal(state.attemptLog[0].questionNumber,11);
  assert.equal(Object.values(state.records).filter(r=>r.streak===2).length,10);assert.equal(state.records.s21.attempts,0);
});
test('whole migration and group switching retain errors, hints, drafts, logs and completed groups',()=>{
  const old=freshProgress(bank);old.active={id:'s39',hintLevel:1,draft:'old draft',result:null,repair:false,history:[]};
  submit(bank,old,'wrong');const expected=save(restoreProgress(bank,old).attemptLog);
  let state=initSentenceGroups(bank,restoreProgress(bank,old),old);
  assert.equal(state.group,4);switchSentenceGroup(bank,state,1);state.active.draft='group one draft';
  switchSentenceGroup(bank,state,4);assert.equal(state.active.id,'s39');assert.equal(state.active.hintLevel,1);assert.equal(state.active.result.correct,false);
  retry(state);state.active.draft='repair draft';rememberSentenceGroup(state);const raw=save(state);
  state=initSentenceGroups(bank,restoreProgress(bank,raw),raw);switchSentenceGroup(bank,state,4);
  assert.equal(state.active.repair,true);assert.equal(state.active.draft,'repair draft');assert.deepEqual(state.attemptLog,expected);
  switchSentenceGroup(bank,state,1);assert.equal(state.active.draft,'group one draft');assert.equal(Object.keys(state.records).length,100);
});
test('legacy chunk round retains completed prefix, current correction and all 265 attempts',()=>{
  const flat=flattenChunks(chunks),old=freshChunks(chunks);old.mode='drill';old.browseIndex=38;
  // Real submissions, including separate repairs; migration must not create new attempts.
  for(const c of flat.slice(0,100)){
    submitChunk(chunks,old,'wrong');retryChunk(old);submitChunk(chunks,old,c.english);nextChunk(old);
  }
  for(let i=0;i<65;i++){submitChunk(chunks,old,'wrong');retryChunk(old);}
  old.active.draft='repair in progress';assert.equal(old.log.length,265);
  const expected=save(old.log);let state=initChunkGroups(chunks,restoreChunks(chunks,old),old);
  assert.equal(state.group,6);assert.equal(state.active.id,flat[100].id);assert.equal(state.position,0);
  assert.equal(state.active.repair,true);assert.equal(state.active.draft,'repair in progress');assert.deepEqual(state.log,expected);
  switchChunkGroup(chunks,state,1);assert.equal(state.browseIndex,0);assert.equal(state.active,null);assert.equal(state.position,20);
  switchChunkGroup(chunks,state,6);assert.equal(state.active.draft,'repair in progress');
  rememberChunkGroup(state);const raw=save(state);state=initChunkGroups(chunks,restoreChunks(chunks,raw),raw);
  assert.equal(state.active.repair,true);assert.equal(state.active.draft,'repair in progress');assert.deepEqual(state.log,expected);
});
test('chunk group rounds and wrong-only practice never cross into the next group',()=>{
  const state=initChunkGroups(chunks,freshChunks(chunks));switchChunkGroup(chunks,state,2);
  submitChunk(chunks,state,'wrong');retryChunk(state);submitChunk(chunks,state,'book number 11');nextChunk(state);
  for(const c of flattenChunks(groupBank(chunks,state)).slice(1)){assert.equal(state.active.id,c.id);submitChunk(chunks,state,c.english);nextChunk(state);}
  assert.equal(state.active,null);assert.equal(state.log.length,21);assert.equal(state.log[0].number,11);
  startChunkRound(groupBank(chunks,state),state,true);assert.deepEqual(state.queue,['c11a']);
  state.active.draft='group two draft';switchChunkGroup(chunks,state,10);assert.equal(state.active.id,'c91a');
  submitChunk(chunks,state,'wrong');rememberChunkGroup(state);const raw=save(state);
  const restored=initChunkGroups(chunks,restoreChunks(chunks,raw),raw);assert.equal(restored.active.result.correct,false);
  switchChunkGroup(chunks,restored,2);assert.equal(restored.active.draft,'group two draft');assert.deepEqual(restored.queue,['c11a']);
  assert.equal(restored.log.length,22);assert.equal(restored.browseIndex,10);
});
test('reimporting unchanged bank preserves paused group sessions; changed answers discard stale results',()=>{
  const state=initChunkGroups(chunks,freshChunks(chunks));switchChunkGroup(chunks,state,2);submitChunk(chunks,state,'wrong');
  switchChunkGroup(chunks,state,3);state.active.draft='group three';rememberChunkGroup(state);
  const raw=save(state), restored=initChunkGroups(chunks,restoreChunks(chunks,raw),raw);
  switchChunkGroup(chunks,restored,2);assert.equal(restored.active.result.correct,false);
  const changed=save(chunks);changed.sentences[10].chunks[0].meaning='更改释义';
  const updated=initChunkGroups(changed,restoreChunks(changed,raw),raw);switchChunkGroup(changed,updated,2);
  assert.equal(updated.active.result,null);assert.equal(updated.log.length,0);
});
