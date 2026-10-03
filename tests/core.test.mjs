import test from 'node:test';
import assert from 'node:assert/strict';
import {grade,normalize,validateBank,freshProgress,restoreProgress,activateNext,submit,masteredCount,localDate} from '../core.js';
const bank = validateBank({title:'Test',sentences:[
  {id:'one',chinese:'原创一',answers:['We walk home after lunch.','After lunch, we walk home.']},
  {id:'two',chinese:'原创二',answers:['She keeps a blue notebook.']},
  {id:'three',chinese:'原创三',answers:['They buy fruit on Friday.']}
]});
test('case, punctuation, curly apostrophes and whitespace are ignored; actual words are not',()=>{
  assert.equal(grade('  WE WALK HOME, AFTER LUNCH!!! ',bank.sentences[0].answers).correct,true);
  assert.equal(grade('After lunch\nwe walk home',bank.sentences[0].answers).correct,true);
  assert.equal(grade("We'll walk home.",["We’ll walk home!"]).correct,true);
  assert.equal(grade('We walk house after lunch',bank.sentences[0].answers).correct,false);
  assert.equal(grade('',bank.sentences[0].answers).correct,false);
  assert.equal(normalize('SELF-CONFIDENCE'),'self confidence');
});
test('diff finds missing, extra and substituted words and chooses the closest accepted variant',()=>{
  const r=grade('After lunch we slowly walk house',bank.sentences[0].answers);
  assert.equal(r.target,'After lunch, we walk home.');assert.equal(r.distance,2);
  assert.equal(r.inputMarks.filter(Boolean).length,2);assert.equal(r.targetMarks.filter(Boolean).length,1);
  assert.equal(grade('We home after lunch',bank.sentences[0].answers).targetMarks[1],true);
});
test('a weak sentence returns after two intervening answers, and needs two independent successes',()=>{
  const s=freshProgress(bank);activateNext(bank,s);assert.equal(s.active.id,'one');
  submit(bank,s,'wrong','2026-10-03');activateNext(bank,s);assert.equal(s.active.id,'two');
  submit(bank,s,bank.sentences[1].answers[0],'2026-10-03');activateNext(bank,s);assert.equal(s.active.id,'three');
  submit(bank,s,bank.sentences[2].answers[0],'2026-10-03');activateNext(bank,s);assert.equal(s.active.id,'one');
  submit(bank,s,bank.sentences[0].answers[0],'2026-10-03');assert.equal(s.records.one.streak,1);
  let cycles=0;
  while(activateNext(bank,s)){const q=bank.sentences.find(q=>q.id===s.active.id);submit(bank,s,q.answers[0],'2026-10-03');assert.ok(++cycles<20);}
  assert.equal(masteredCount(s),3);assert.equal(s.daily['2026-10-03'].ids.length,3);
});
test('hints break the independent streak and remain used after refresh',()=>{
  const s=freshProgress(bank);activateNext(bank,s);s.active.hintLevel=1;
  const restored=restoreProgress(bank,JSON.parse(JSON.stringify(s)));
  assert.equal(restored.active.hintLevel,1);
  submit(bank,restored,bank.sentences[0].answers[0],'2026-10-03');
  assert.equal(restored.records.one.streak,0);assert.equal(restored.records.one.independentCorrect,0);
  restored.active.hintLevel=0;restored.active.result=null;
  submit(bank,restored,bank.sentences[0].answers[0],'2026-10-03');assert.equal(restored.records.one.streak,1);
  restored.active.result=null;restored.active.hintLevel=1;
  submit(bank,restored,bank.sentences[0].answers[0],'2026-10-03');assert.equal(restored.records.one.streak,0);
});
test('a completed submission persists and cannot count twice after refresh',()=>{
  const s=freshProgress(bank);activateNext(bank,s);s.active.draft='draft';
  assert.equal(restoreProgress(bank,s).active.draft,'draft');
  submit(bank,s,bank.sentences[0].answers[0],'2026-10-03');const r=restoreProgress(bank,JSON.parse(JSON.stringify(s)));
  assert.equal(r.active.result.correct,true);assert.equal(r.records.one.streak,1);
  assert.equal(submit(bank,r,'anything','2026-10-03'),null);assert.equal(r.daily['2026-10-03'].attempts,1);
});
test('changed question content does not inherit mastery; exact questions retain it',()=>{
  const s=freshProgress(bank);s.records.one.streak=2;
  const changed=validateBank({...bank,sentences:bank.sentences.map(q=>q.id==='one'?{...q,answers:['A new answer.']}:q)});
  assert.equal(restoreProgress(changed,s).records.one.streak,0);
  assert.equal(restoreProgress(bank,s).records.one.streak,2);
});
test('mastered fillers give the final weak sentence a gap; review errors reopen mastery',()=>{
  const s=freshProgress(bank);s.records.two.streak=2;s.records.three.streak=2;activateNext(bank,s);
  submit(bank,s,bank.sentences[0].answers[0],'2026-10-03');activateNext(bank,s);assert.equal(s.active.id,'two');
  submit(bank,s,bank.sentences[1].answers[0],'2026-10-03');activateNext(bank,s);assert.equal(s.active.id,'three');
  submit(bank,s,bank.sentences[2].answers[0],'2026-10-03');activateNext(bank,s);assert.equal(s.active.id,'one');
  submit(bank,s,bank.sentences[0].answers[0],'2026-10-03');assert.equal(activateNext(bank,s),null);
  s.reviewIds=bank.sentences.map(q=>q.id);activateNext(bank,s);submit(bank,s,'mistake','2026-10-03');assert.equal(masteredCount(s),2);assert.equal(s.records[s.active.id].streak,0);
});
test('invalid or duplicate bank entries are rejected; a single-sentence bank can complete',()=>{
  assert.throws(()=>validateBank([]));assert.throws(()=>validateBank([bank.sentences[0],bank.sentences[0]]));assert.throws(()=>validateBank([{id:'a',chinese:'中',answers:['!!!']}]));
  const one=validateBank([bank.sentences[0]]),s=freshProgress(one);activateNext(one,s);submit(one,s,one.sentences[0].answers[0]);activateNext(one,s);submit(one,s,one.sentences[0].answers[0]);assert.equal(activateNext(one,s),null);
});
test('today keys use the local calendar day',()=>{assert.equal(localDate(new Date(2026,9,3,23,59)),'2026-10-03');});
test('a 100-sentence bank completes without losing or starving questions',()=>{
  const hundred=validateBank(Array.from({length:100},(_,i)=>({id:`synthetic-${i}`,chinese:`原创测试句 ${i}`,answers:[`This is synthetic test sentence number ${i}.`]})));
  const s=freshProgress(hundred);let tries=0;
  while(activateNext(hundred,s)){
    const q=hundred.sentences.find(q=>q.id===s.active.id);submit(hundred,s,q.answers[0],'2026-10-03');assert.ok(++tries<250);
  }
  assert.equal(masteredCount(s),100);assert.equal(s.daily['2026-10-03'].ids.length,100);
});
