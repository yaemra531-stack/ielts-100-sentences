import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765/',url=new URL('chunks.html',base).href;
const demo=JSON.parse(await readFile(new URL('../chunks-example.json',import.meta.url),'utf8'));
const out=new URL('../.qa/',import.meta.url);await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});
function observeSpeech(){const synth=new EventTarget();window.speechEvents=[];synth.getVoices=()=>[{name:'Sonia',lang:'en-GB'}];synth.speak=u=>speechEvents.push({text:u.text});synth.cancel=()=>speechEvents.push({cancel:true});Object.defineProperty(window,'speechSynthesis',{value:synth});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};}
async function ready(p){await p.waitForFunction(()=>document.getElementById('chunk-total').textContent.includes('项词伙'));}
async function bankImport(p,path){await p.locator('#chunk-settings-open').click();p.once('dialog',d=>d.accept());await p.locator('#chunk-import').setInputFiles(path);await p.waitForFunction(()=>document.getElementById('chunk-settings-bank').textContent.includes('100 句'));}
try{
  const ctx=await browser.newContext();await ctx.addInitScript(observeSpeech);const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await ready(p);
  const events=()=>p.evaluate(()=>speechEvents.filter(e=>e.text)),saved=()=>p.evaluate(()=>localStorage.getItem('ielts100.chunks.progress.v1'));
  assert.deepEqual(await events(),[]);await p.locator('[data-chunk-audio]').first().click();assert.equal((await events())[0].text,'take a walk');const before=await saved();await p.locator('#browse-sentence-play').click();assert.equal((await events()).at(-1).text,demo.sentences[0].english);assert.equal(await saved(),before);
  await p.locator('#drill-mode').click();assert.equal(await p.evaluate(()=>speechEvents.at(-1).cancel),true);assert.equal(await p.locator('#chunk-replay').isVisible(),false);
  const n=(await events()).length;await p.locator('#chunk-answer').fill('take walk');assert.equal((await events()).length,n);await p.keyboard.press('Enter');assert.equal((await events()).at(-1).text,'take a walk');assert.equal((await events()).length,n+1);
  const submitted=await saved();await p.keyboard.press('Alt+r');assert.equal(await p.evaluate(()=>speechEvents.at(-1).cancel),true);await p.keyboard.press('Alt+r');assert.equal((await events()).at(-1).text,'take a walk');assert.equal(await saved(),submitted);
  await p.keyboard.press('Enter');assert.equal(await p.locator('#chunk-feedback').isVisible(),false);assert.equal(await p.evaluate(()=>speechEvents.at(-1).cancel),true);
  await p.locator('#chunk-answer').fill('take a walk');await p.keyboard.press('Enter');await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>speechEvents.at(-1).cancel),true);
  await p.locator('#chunk-settings-open').click();await p.locator('#chunk-auto-audio').uncheck();await p.keyboard.press('Escape');const start=(await events()).length;await p.locator('#chunk-answer').fill('after lunch');await p.keyboard.press('Enter');assert.equal((await events()).length,start);
  await p.locator('#chunk-replay').click();assert.equal((await events()).at(-1).text,'after lunch');await p.reload();await ready(p);assert.deepEqual(await events(),[]);await p.locator('#chunk-settings-open').click();assert.equal(await p.locator('#chunk-auto-audio').isChecked(),false);await p.keyboard.press('Escape');assert.deepEqual(errors,[]);await ctx.close();
  console.log('PASS chunk speech orchestration: manual browsing, standard chunk after wrong/right, no precheck hints, stop on retry/next/settings, replay does not add attempts, auto preference and refresh silence.');
  if(process.env.CHUNK_AUDIO_PACK&&process.env.CHUNKS_FILE&&process.env.AUDIO_PACK){
    const bank=JSON.parse(await readFile(process.env.CHUNKS_FILE,'utf8')),real=await browser.newContext({viewport:{width:1065,height:930}});
    await real.addInitScript(()=>{const NativeAudio=window.Audio;window.testPlayers=[];window.Audio=function(...args){const a=new NativeAudio(...args);testPlayers.push(a);return a;};});
    const rp=await real.newPage(),fail=[];rp.on('pageerror',e=>fail.push(e.message));await rp.goto(url);await ready(rp);await bankImport(rp,process.env.CHUNKS_FILE);
    // Seed the same full-sentence audio key that the original page uses.
    await rp.evaluate(async raw=>{const {createNarration}=await import('./narration.js?v=20261003-6');await createNarration().importPack(raw);},JSON.parse(await readFile(process.env.AUDIO_PACK,'utf8')));
    await rp.reload();await ready(rp);await rp.waitForFunction(()=>document.getElementById('chunk-sentence-audio-bank').textContent.includes('100 / 100'));
    const wholeBefore=await rp.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('ielts100.audio.v1',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('packs').objectStore('packs').get('current');q.onsuccess=()=>{resolve({voice:q.result.voice,texts:q.result.entries.map(e=>e.text),sizes:q.result.entries.map(e=>e.blob.size)});db.close();};};}));
    await rp.locator('#chunk-settings-open').click();const progressBefore=await rp.evaluate(()=>localStorage.getItem('ielts100.chunks.progress.v1'));
    await rp.locator('#chunk-audio-import').setInputFiles(process.env.CHUNK_AUDIO_PACK);await rp.waitForFunction(()=>document.getElementById('chunk-audio-bank').textContent.includes('273 / 273'));
    assert.equal(await rp.evaluate(()=>localStorage.getItem('ielts100.chunks.progress.v1')),progressBefore);
    const wholeAfter=await rp.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('ielts100.audio.v1',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('packs').objectStore('packs').get('current');q.onsuccess=()=>{resolve({voice:q.result.voice,texts:q.result.entries.map(e=>e.text),sizes:q.result.entries.map(e=>e.blob.size)});db.close();};};}));assert.deepEqual(wholeAfter,wholeBefore);
    const badBefore=await rp.evaluate(()=>localStorage.getItem('ielts100.chunks.progress.v1'));await rp.locator('#chunk-audio-import').setInputFiles(process.env.AUDIO_PACK);await rp.waitForFunction(()=>document.getElementById('chunk-settings-message').classList.contains('error'));assert.equal(await rp.evaluate(()=>localStorage.getItem('ielts100.chunks.progress.v1')),badBefore);assert.match(await rp.locator('#chunk-audio-bank').textContent(),/273 \/ 273/);
    await rp.keyboard.press('Escape');await rp.locator('[data-chunk-audio]').first().click();await rp.waitForFunction(()=>testPlayers.at(-1)?.currentTime>0&&!testPlayers.at(-1).paused);
    await rp.locator('#browse-sentence-play').click();assert.equal(await rp.evaluate(()=>testPlayers[0].paused),true);await rp.waitForFunction(()=>testPlayers.at(-1)?.currentTime>0&&!testPlayers.at(-1).paused);
    await rp.locator('#drill-mode').click();assert.equal(await rp.evaluate(()=>testPlayers.at(-1).paused),true);await rp.locator('#chunk-answer').fill('wrong');await rp.keyboard.press('Enter');await rp.waitForFunction(()=>testPlayers.at(-1)?.currentTime>0&&!testPlayers.at(-1).paused);assert.match(await rp.locator('#chunk-audio-note').textContent(),/Sonia.*本机音频/);
    const attempts=await rp.evaluate(()=>JSON.parse(localStorage.getItem('ielts100.chunks.progress.v1')).log.length);await rp.keyboard.press('Alt+r');assert.equal(await rp.evaluate(()=>testPlayers.at(-1).paused),true);await rp.keyboard.press('Alt+r');await rp.waitForFunction(()=>testPlayers.at(-1)?.currentTime>0);assert.equal(await rp.evaluate(()=>JSON.parse(localStorage.getItem('ielts100.chunks.progress.v1')).log.length),attempts);
    await rp.reload();await ready(rp);await rp.waitForFunction(()=>document.getElementById('chunk-audio-bank').textContent.includes('273 / 273'));assert.equal(await rp.evaluate(()=>testPlayers.length),0);await rp.keyboard.press('Alt+r');await rp.waitForFunction(()=>testPlayers.at(-1)?.currentTime>0);await rp.keyboard.press('Enter');assert.equal(await rp.evaluate(()=>testPlayers.at(-1).paused),true);
    await rp.locator('#browse-mode').click();await rp.locator('#sentence-jump').selectOption('0');await rp.screenshot({path:fileURLToPath(new URL('chunks-sonia-browse.png',out)),fullPage:true});await rp.locator('#chunk-settings-open').click();await rp.screenshot({path:fileURLToPath(new URL('chunks-sonia-settings.png',out))});assert.deepEqual(fail,[]);await real.close();
    console.log('PASS real chunk MP3: all 273 items covered by 271 clips, full sentence pack preserved, wrong pack rejected, playback advances, repeat leaves progress unchanged, reload keeps packs without autoplay, retry stops.');
  }
}finally{await browser.close();}
