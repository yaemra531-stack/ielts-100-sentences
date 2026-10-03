import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateChunks,flattenChunks,freshChunks,restoreChunks,submitChunk,retryChunk,nextChunk,startChunkRound,chunkStats} from '../chunks-core.js';
const raw=JSON.parse(await readFile(new URL('../chunks-example.json',import.meta.url),'utf8'));
const bank=validateChunks(raw),flat=flattenChunks(bank);
test('chunk bank validates exact source, IDs, source labels and annotation ranges',()=>{
  assert.equal(flat.length,12);assert.equal(bank.sentences[0].english,raw.sentences[0].english);
  for(const mutate of [b=>b.sentences[0].chunks[0].english='not in the sentence',b=>b.sentences[0].chunks[0].source='unknown',b=>b.sentences[0].chunks[0].notes[0].focus=['not in sentence'],b=>b.sentences[1].id=b.sentences[0].id,b=>b.sentences[1].number=1,b=>b.sentences[1].chunks[0].id=b.sentences[0].chunks[0].id]){const b=structuredClone(raw);mutate(b);assert.throws(()=>validateChunks(b));}
});
test('case and punctuation accepted; articles and plurals must match',()=>{
  const state=freshChunks(bank);assert.equal(submitChunk(bank,state,'TAKE A WALK!!!').correct,true);
  const wrong=freshChunks(bank);assert.equal(submitChunk(bank,wrong,'take walk').correct,false);assert.equal(nextChunk(wrong),false);
  const plural=freshChunks(bank);plural.active.id=flat[2].id;assert.equal(submitChunk(bank,plural,'her key').correct,false);
  const tenseBank=validateChunks({format:'ielts100-chunks',version:1,title:'original test',sentences:[{id:'test',number:1,chinese:'她已经把钥匙留在这里。',english:'She has left her keys here.',chunks:[{id:'has-left',english:'has left',meaning:'已经留下',source:'hint'}]}]});
  assert.equal(submitChunk(tenseBank,freshChunks(tenseBank),'have left').correct,false);
});
test('wrong and repaired right are separate permanent entries, no duplicate submits',()=>{
  const state=freshChunks(bank);assert.equal(submitChunk(bank,state,''),null);assert.equal(state.log.length,0);
  submitChunk(bank,state,'take walk');assert.equal(submitChunk(bank,state,'take a walk'),null);assert.equal(state.log.length,1);
  retryChunk(state);submitChunk(bank,state,'take a walk');assert.equal(state.log[1].repair,true);assert.deepEqual(chunkStats(state),{correct:1,wrong:1,practised:1});
  assert.equal(nextChunk(state),true);assert.equal(state.active.id,flat[1].id);assert.equal(state.active.repair,false);
});
test('draft, browse position, correction and submitted result survive reload',()=>{
  const state=freshChunks(bank);state.browseIndex=3;state.mode='drill';state.active.draft='take';const restored=restoreChunks(bank,JSON.parse(JSON.stringify(state)));assert.equal(restored.browseIndex,3);assert.equal(restored.active.draft,'take');
  submitChunk(bank,state,'take walk');const checked=restoreChunks(bank,state);assert.equal(checked.active.result.correct,false);assert.equal(checked.log.length,1);retryChunk(checked);assert.equal(restoreChunks(bank,checked).active.repair,true);
  const changed=structuredClone(bank);changed.sentences[0].chunks[0].meaning='a changed meaning';assert.equal(restoreChunks(changed,state).log.length,0);
});
test('a full round and wrong-only round use source order, keep previous attempts',()=>{
  const state=freshChunks(bank);for(const c of flat){assert.equal(state.active.id,c.id);submitChunk(bank,state,c.english);nextChunk(state);}assert.equal(state.active,null);assert.equal(restoreChunks(bank,state).active,null);assert.equal(state.log.length,12);
  startChunkRound(bank,state,true);assert.equal(state.active,null);assert.equal(restoreChunks(bank,state).active,null);
  startChunkRound(bank,state);submitChunk(bank,state,'wrong');retryChunk(state);submitChunk(bank,state,flat[0].english);nextChunk(state);startChunkRound(bank,state,true);assert.deepEqual(state.queue,[flat[0].id]);assert.equal(state.log.length,14);
});
