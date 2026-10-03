import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.env.TEST_URL || 'http://127.0.0.1:8765/';
const bank=JSON.parse(await readFile(new URL('../sentences.json',import.meta.url),'utf8'));
const out=new URL('../.qa/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
function observeSpeech() {
  window.speechEvents=[];
  const synth=new EventTarget();
  synth.getVoices=()=>[{name:'US Test Voice',lang:'en-US'},{name:'Daniel',lang:'en-GB'},{name:'Sonia',lang:'en-GB'}];
  synth.speak=utterance=>window.speechEvents.push({text:utterance.text,voice:utterance.voice?.name,lang:utterance.lang,rate:utterance.rate});
  synth.cancel=()=>window.speechEvents.push({cancel:true});
  Object.defineProperty(window,'speechSynthesis',{value:synth});
  window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
}
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(observeSpeech);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const voices=()=>page.evaluate(()=>window.speechEvents.filter(e=>!e.cancel));
  const saved=()=>page.evaluate(()=>localStorage.getItem('ielts100.progress.v1'));
  await page.goto(url);await page.waitForFunction(()=>!document.getElementById('answer').disabled);
  assert.deepEqual(await voices(),[]);
  await page.keyboard.press('Alt+h');assert.deepEqual(await voices(),[]);
  await page.locator('#answer').fill('Unmatched answer.');await page.keyboard.press('Enter');
  assert.equal((await voices())[0].text,await page.locator('#reference-answer').textContent());
  assert.equal((await voices())[0].voice,'Sonia');assert.equal((await voices())[0].rate,.95);
  const beforeReplay=await saved();await page.keyboard.press('Alt+r');assert.match(await page.locator('#replay-button').textContent(),/重听/);
  await page.keyboard.press('Alt+r');assert.equal((await voices()).length,2);assert.equal(await saved(),beforeReplay);
  await page.keyboard.press('Enter');assert.equal(await page.locator('#feedback').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.speechEvents.at(-1).cancel),true);
  await page.locator('#answer').fill(bank.sentences[0].answers[0]);await page.keyboard.press('Enter');
  assert.match(await page.locator('#result-detail').textContent(),/订正/);
  await page.reload();await page.locator('#feedback').waitFor({state:'visible'});assert.deepEqual(await voices(),[]);
  await page.locator('#settings-open').click();await page.locator('#narration-toggle').uncheck();
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement.id==='next-button');await page.keyboard.press('Enter');
  await page.locator('#answer').fill(bank.sentences[1].answers[0]);await page.keyboard.press('Enter');assert.deepEqual(await voices(),[]);
  await page.keyboard.press('Alt+r');assert.equal((await voices()).length,1);
  await page.reload();await page.locator('#feedback').waitFor({state:'visible'});assert.deepEqual(await voices(),[]);
  await page.locator('#settings-open').click();assert.equal(await page.locator('#narration-toggle').isChecked(),false);
  // Invalid imports must preserve both learning state and any existing voice pack.
  const beforeImport=await saved();await page.locator('#audio-import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wrong"}')});
  await page.waitForFunction(()=>document.getElementById('settings-message').classList.contains('error'));assert.equal(await saved(),beforeImport);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS speech orchestration (API simulated): reference only after submission, British female preference, repeat / stop shortcut, cancellation on rewrite / next, no replay on reload, independent auto toggle, no extra attempts, invalid import preserves state.');

  if (process.env.AUDIO_PACK && process.env.BANK_FILE) {
    const audioBank=JSON.parse(await readFile(process.env.BANK_FILE,'utf8'));
    const real=await browser.newContext({viewport:{width:1065,height:900}});
    await real.addInitScript(()=>{
      const NativeAudio=window.Audio;window.testPlayers=[];
      window.Audio=function(...args){const player=new NativeAudio(...args);window.testPlayers.push(player);return player;};
    });
    const rp=await real.newPage(),failures=[];rp.on('pageerror',e=>failures.push(e.message));
    await rp.goto(url);await rp.waitForFunction(()=>!document.getElementById('answer').disabled);
    await rp.locator('#settings-open').click();rp.once('dialog',d=>d.accept());await rp.locator('#import-file').setInputFiles(process.env.BANK_FILE);
    await rp.waitForFunction(()=>document.getElementById('settings-bank').textContent.includes('100 句'));
    const before=await rp.evaluate(()=>localStorage.getItem('ielts100.progress.v1'));
    await rp.locator('#audio-import').setInputFiles(process.env.AUDIO_PACK);
    await rp.waitForFunction(()=>document.getElementById('narration-bank').textContent.includes('100 / 100'));
    assert.equal(await rp.evaluate(()=>localStorage.getItem('ielts100.progress.v1')),before);
    await rp.keyboard.press('Escape');await rp.waitForFunction(()=>document.activeElement.id==='answer');
    await rp.locator('#answer').fill(audioBank.sentences[0].answers[0]);await rp.keyboard.press('Enter');
    await rp.waitForFunction(()=>window.testPlayers.at(-1)?.currentTime>0 && !window.testPlayers.at(-1)?.paused);
    assert.match(await rp.locator('#narration-note').textContent(),/Sonia.*本机音频/);
    const attempts=await rp.evaluate(()=>JSON.parse(localStorage.getItem('ielts100.progress.v1')).attemptLog.length);
    await rp.screenshot({path:fileURLToPath(new URL('narration-sonia-preview.png',out)),fullPage:true});
    await rp.keyboard.press('Alt+r');assert.equal(await rp.evaluate(()=>window.testPlayers.at(-1).paused),true);
    await rp.keyboard.press('Alt+r');await rp.waitForFunction(()=>window.testPlayers.at(-1)?.currentTime>0);
    assert.equal(await rp.evaluate(()=>JSON.parse(localStorage.getItem('ielts100.progress.v1')).attemptLog.length),attempts);
    await rp.reload();await rp.waitForFunction(()=>document.getElementById('narration-bank').textContent.includes('100 / 100'));
    assert.equal(await rp.evaluate(()=>window.testPlayers.length),0);
    await rp.keyboard.press('Alt+r');await rp.waitForFunction(()=>window.testPlayers.at(-1)?.currentTime>0);
    await rp.keyboard.press('Enter');assert.equal(await rp.locator('#question-number').textContent(),'02 / 100');assert.equal(await rp.evaluate(()=>window.testPlayers.at(-1).paused),true);
    assert.deepEqual(failures,[]);await real.close();
    console.log('PASS real Sonia MP3: 100 / 100 imported locally, IndexedDB reload persistence, decoded playback advances, repeat adds no attempts, next stops audio, no playback on reload.');
  }
  const unsupported=await browser.newContext();await unsupported.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:undefined}));
  const up=await unsupported.newPage();await up.goto(url);await up.waitForFunction(()=>!document.getElementById('answer').disabled);
  await up.locator('#answer').fill(bank.sentences[0].answers[0]);await up.keyboard.press('Enter');assert.match(await up.locator('#narration-note').textContent(),/导入语音包/);
  await up.keyboard.press('Enter');assert.equal(await up.locator('#question-number').textContent(),'02 / 06');await unsupported.close();
  console.log('PASS no browser speech: clear local-pack fallback, keyboard next remains immediate.');
} finally { await browser.close(); }
