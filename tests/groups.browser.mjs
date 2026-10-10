import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {bank,chunks} from './group-fixture.mjs';
import {freshChunks,flattenChunks,submitChunk,nextChunk,retryChunk,validateChunks} from '../chunks-core.js';
import {validateBank} from '../core.js';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765/';
const out=new URL('../.qa/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
async function context(whole=bank,words=chunks,old=null){
  const ctx=await browser.newContext({viewport:{width:1440,height:1100},colorScheme:'dark',acceptDownloads:true});
  await ctx.addInitScript(({whole,words,old})=>{
    if(!['http:','https:'].includes(location.protocol))return;
    if(!localStorage.getItem('groups-test-seeded')){
      localStorage.setItem('ielts100.bank.v1',JSON.stringify(whole));
      localStorage.setItem('ielts100.chunks.bank.v1',JSON.stringify(words));
      if(old)localStorage.setItem('ielts100.chunks.progress.v1',JSON.stringify(old));
      localStorage.setItem('ielts100.theme.v1','dark');
      localStorage.setItem('ielts100.narration.v1','off');
      localStorage.setItem('ielts100.feedback.v1','off');
      localStorage.setItem('ielts100.chunks.narration.v1','off');
      localStorage.setItem('groups-test-seeded','yes');
    }
    const synth=new EventTarget();window.speechEvents=[];
    synth.getVoices=()=>[{name:'Sonia',lang:'en-GB'}];synth.speak=u=>speechEvents.push(u.text);synth.cancel=()=>{};
    Object.defineProperty(window,'speechSynthesis',{value:synth});window.SpeechSynthesisUtterance=class{constructor(t){this.text=t;}};
  },{whole,words,old});
  ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return ctx;
}
const ready=p=>p.waitForFunction(()=>document.getElementById('group-select').options.length>0);
const get=(p,key)=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const chunkState=p=>get(p,'ielts100.chunks.progress.v1');
const wholeState=p=>get(p,'ielts100.progress.v1');
async function keyboardGroup(p,value){await p.locator('#group-select').focus();await p.keyboard.press('Home');for(let i=1;i<value;i++)await p.keyboard.press('ArrowDown');assert.equal(await p.locator('#group-select').inputValue(),String(value));}
async function writeChunk(p,answer){await p.locator('#chunk-answer').fill(answer);await p.keyboard.press('Enter');await p.locator('#chunk-feedback').waitFor({state:'visible'});}
async function writeWhole(p,answer){await p.locator('#answer').fill(answer);await p.keyboard.press('Enter');await p.locator('#feedback').waitFor({state:'visible'});}
try{
  const ctx=await context(),p=await ctx.newPage();await p.goto(new URL('chunks.html',base).href);await ready(p);
  assert.equal(await p.locator('#group-select option').count(),10);
  assert.equal(await p.locator('#chunk-total').textContent(),'10 句 · 20 项词伙');
  assert.equal(await p.locator('#sentence-jump option').count(),10);
  await p.locator('body').click({position:{x:5,y:150}});for(let i=0;i<14;i++)await p.keyboard.press('ArrowRight');
  assert.equal(await p.locator('#browse-number').textContent(),'10 / 100');assert.equal(await p.locator('#browse-next').isDisabled(),true);
  await keyboardGroup(p,2);assert.equal(await p.locator('#browse-number').textContent(),'11 / 100');
  await p.locator('body').click({position:{x:5,y:150}});await p.keyboard.press('1');
  assert.deepEqual(await p.evaluate(()=>speechEvents),['book number 11']);assert.equal((await chunkState(p)).log.length,0);
  await p.locator('#drill-mode').focus();await p.keyboard.press('Enter');await writeChunk(p,'book 11');
  assert.equal((await chunkState(p)).log[0].number,11);assert.equal(await p.locator('#chunk-next').isVisible(),false);
  await p.keyboard.press('Enter');await p.locator('#chunk-answer').fill('unfinished correction');
  await keyboardGroup(p,3);assert.equal((await chunkState(p)).active.id,'c21a');
  await keyboardGroup(p,2);assert.equal(await p.locator('#chunk-answer').inputValue(),'unfinished correction');
  await p.reload();await ready(p);assert.equal((await chunkState(p)).active.repair,true);
  await writeChunk(p,'book number 11');await p.keyboard.press('Enter');
  for(const c of flattenChunks(chunks).slice(21,40)){await writeChunk(p,c.english);await p.keyboard.press('Enter');}
  assert.equal(await p.locator('#chunk-complete').isVisible(),true);assert.equal((await chunkState(p)).active,null);
  assert.equal((await chunkState(p)).log.length,21);assert.equal(await p.locator('#chunk-correct').textContent(),'20');
  await p.locator('#chunk-complete a').focus();await p.keyboard.press('Enter');await ready(p);
  assert.equal(await p.locator('#group-select').inputValue(),'2');assert.equal((await wholeState(p)).active.id,'s11');
  await writeWhole(p,'wrong');await p.keyboard.press('Enter');await p.locator('#answer').fill('whole repair draft');
  await keyboardGroup(p,3);await p.locator('#answer').fill('group three whole draft');await keyboardGroup(p,2);
  assert.equal(await p.locator('#answer').inputValue(),'whole repair draft');await p.reload();await ready(p);
  assert.equal((await wholeState(p)).active.repair,true);await writeWhole(p,bank.sentences[10].answers[0]);await p.keyboard.press('Enter');
  for(let i=0;i<35&&!(await p.locator('#complete').isVisible());i++){
    const state=await wholeState(p),q=bank.sentences.find(q=>q.id===state.active.id);
    assert.ok(+q.id.slice(1)>=11&&+q.id.slice(1)<=20);await writeWhole(p,q.answers[0]);await p.keyboard.press('Enter');
  }
  assert.equal(await p.locator('#complete').isVisible(),true);assert.equal((await wholeState(p)).records.s21.attempts,0);
  assert.ok((await wholeState(p)).attemptLog.every(e=>e.questionNumber>=11&&e.questionNumber<=20));
  assert.equal(await p.locator('#mastered-count').textContent(),'10 / 10');
  // Two open pages share the selected group while maintaining separate practice records.
  const wordPage=await ctx.newPage();await wordPage.goto(new URL('chunks.html',base).href);await ready(wordPage);
  assert.equal(await wordPage.locator('#chunk-complete').isVisible(),true);await keyboardGroup(p,3);
  await wordPage.waitForFunction(()=>document.getElementById('group-select').value==='3');
  assert.equal((await wholeState(p)).active.draft,'group three whole draft');assert.equal((await chunkState(wordPage)).active.id,'c21a');
  await keyboardGroup(wordPage,2);await p.waitForFunction(()=>document.getElementById('group-select').value==='2');
  assert.equal(await p.locator('#complete').isVisible(),true);
  // Backups include all groups, and restoring does not collapse paused sessions.
  if(!await wordPage.locator('#chunk-records').evaluate(e=>e.open))await wordPage.locator('#chunk-records summary').click();
  const before=await chunkState(wordPage);const dl=wordPage.waitForEvent('download');await wordPage.locator('#chunk-export').click();
  const download=await dl;const backup=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(backup.bank.sentences.length,100);assert.equal(Object.keys(backup.progress.groupSessions).length,10);assert.equal(backup.progress.log.length,21);
  await wordPage.locator('#chunk-settings-open').click();wordPage.once('dialog',d=>d.accept());
  await wordPage.locator('#chunk-import').setInputFiles({name:'groups-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await wordPage.waitForFunction(()=>document.getElementById('chunk-settings-message').textContent.includes('已导入'));
  assert.equal((await chunkState(wordPage)).log.length,before.log.length);await wordPage.keyboard.press('Escape');await wordPage.waitForFunction(()=>document.activeElement.id==='round-all');
  await keyboardGroup(wordPage,10);assert.equal((await chunkState(wordPage)).active.id,'c91a');
  await wordPage.screenshot({path:fileURLToPath(new URL('groups-chunks-desktop.png',out)),fullPage:true});
  await p.screenshot({path:fileURLToPath(new URL('groups-whole-desktop.png',out)),fullPage:false});
  assert.equal(await wordPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'dark');await ctx.close();

  // Check the user's exact bank only in an isolated profile; never publish or change real progress.
  if(process.env.PRIVATE_BANK_DIR){
    const dir=process.env.PRIVATE_BANK_DIR;
    const words=validateChunks(JSON.parse(await readFile(`${dir}/顾家北100句-词伙.json`,'utf8')));
    const whole=validateBank(JSON.parse(await readFile(`${dir}/顾家北100句-按原序.json`,'utf8')));
    words.sentences.forEach((s,i)=>{assert.equal(s.chinese,whole.sentences[i].chinese);assert.equal(s.english,whole.sentences[i].answers[0]);});
    const flat=flattenChunks(words),old=freshChunks(words);old.mode='drill';old.browseIndex=38;
    for(const c of flat.slice(0,100)){submitChunk(words,old,c.english);nextChunk(old);}
    for(let i=0;i<165;i++){submitChunk(words,old,'test mismatch');retryChunk(old);}old.active.draft='isolated test draft';
    const ctx=await context(whole,words,old),p=await ctx.newPage();await p.goto(new URL('chunks.html',base).href);await ready(p);
    const saved=await chunkState(p);assert.equal(saved.group,4);assert.equal(saved.log.length,265);assert.equal(saved.active.id,old.active.id);
    assert.equal(saved.log.filter(e=>e.correct).length,100);assert.equal(saved.active.draft,'isolated test draft');
    for(let g=1;g<=10;g++){
      await p.locator('#group-select').selectOption(String(g));const current=await chunkState(p);
      const ids=new Set(words.sentences.slice((g-1)*10,g*10).flatMap(s=>s.chunks.map(c=>c.id)));
      assert.ok(current.queue.every(id=>ids.has(id)));assert.equal(await p.locator('#sentence-jump option').count(),10);
    }
    await p.locator('#group-select').selectOption('1');await p.locator('#browse-mode').click();
    await p.screenshot({path:fileURLToPath(new URL('groups-private-desktop.png',out)),fullPage:true});
    const raw=await chunkState(p);assert.equal(raw.log.length,265);await ctx.close();
    console.log('Private bank: 100 sentences / 273 chunks scoped; 265 legacy attempts preserved.');
  }
  assert.deepEqual(errors,[]);console.log('Desktop groups: keyboard, boundaries, retries, mastery, shared selection, backups and refresh passed.');
}finally{await browser.close();}
