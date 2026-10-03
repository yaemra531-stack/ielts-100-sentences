import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.TEST_URL || 'http://127.0.0.1:8765/';
const bank = JSON.parse(await readFile(new URL('../sentences.json',import.meta.url),'utf8'));
const out = new URL('../.qa/',import.meta.url); await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true});

// Observe real Web Audio nodes, rather than replacing playback with a mock.
function observeAudio() {
  window.audioEvents = [];
  const NativeContext = window.AudioContext;
  window.AudioContext = class extends NativeContext {
    constructor(...args) { super(...args); window.audioEvents.push({type:'context'}); }
    createOscillator() {
      const node = super.createOscillator();
      for (const method of ['setValueAtTime','exponentialRampToValueAtTime']) {
        const original = node.frequency[method].bind(node.frequency);
        node.frequency[method] = (...args) => { window.audioEvents.push({type:method,frequency:args[0]}); return original(...args); };
      }
      const originalStart = node.start.bind(node);
      node.start = (...args) => { window.audioEvents.push({type:'start',state:this.state}); return originalStart(...args); };
      return node;
    }
  };
}
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(observeAudio);
  const page = await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const ready = () => page.waitForFunction(()=>!document.getElementById('answer').disabled);
  const starts = () => page.evaluate(()=>window.audioEvents.filter(e=>e.type==='start').length);
  const initialFrequencies = () => page.evaluate(()=>window.audioEvents.filter(e=>e.type==='setValueAtTime').map(e=>e.frequency));
  const check = async answer => { await page.locator('#answer').fill(answer); await page.keyboard.press('Enter'); await page.locator('#feedback').waitFor({state:'visible'}); };
  await page.goto(url);await ready(); assert.equal(await starts(),0);
  await check('');await page.waitForFunction(()=>window.audioEvents.some(e=>e.type==='start'));
  assert.deepEqual(await initialFrequencies(),[440]);assert.equal(await page.locator('#next-button').isVisible(),false);
  assert.equal(await page.locator('#feedback').evaluate(e=>e.classList.contains('feedback-pop')),false);
  await page.keyboard.press('Enter');await check(bank.sentences[0].answers[0]);
  await page.waitForFunction(()=>window.audioEvents.filter(e=>e.type==='start').length===3);
  assert.deepEqual(await initialFrequencies(),[440,660,880]);
  assert.equal(await page.locator('#result-icon').evaluate(e=>getComputedStyle(e).animationName),'feedback-pop');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'next-button');
  assert.equal(await page.locator('#next-button').isEnabled(),true);
  await page.screenshot({path:fileURLToPath(new URL('feedback-success.png',out)),fullPage:true});
  await page.reload();await page.locator('#feedback').waitFor({state:'visible'});
  assert.equal(await starts(),0);assert.equal(await page.locator('#result-icon').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.keyboard.press('Enter');await check('Something unmatched.');
  await page.waitForFunction(()=>window.audioEvents.filter(e=>e.type==='start').length===1);
  assert.deepEqual(await initialFrequencies(),[260]);
  assert.equal(await page.evaluate(()=>window.audioEvents.find(e=>e.type==='exponentialRampToValueAtTime').frequency),205);
  assert.equal(await page.locator('#result-icon').evaluate(e=>getComputedStyle(e).animationName),'none');
  // Toggle / preview clicks must not alter the user's saved learning data.
  await page.locator('#settings-open').click();
  const saved = await page.evaluate(()=>localStorage.getItem('ielts100.progress.v1'));
  for (const kind of ['correct','unmatched','empty']) await page.locator(`[data-feedback-sound="${kind}"]`).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('ielts100.progress.v1')),saved);
  await page.locator('#feedback-toggle').uncheck();
  assert.equal(await page.locator('[data-feedback-sound="correct"]').isDisabled(),true);
  const mutedStarts = await starts();
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement.id==='retry-button');
  await page.keyboard.press('Enter');await check(bank.sentences[1].answers[0]);
  assert.equal(await starts(),mutedStarts);
  assert.equal(await page.locator('#result-icon').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.reload();await page.locator('#feedback').waitFor({state:'visible'});assert.equal(await starts(),0);
  await page.locator('#settings-open').click();assert.equal(await page.locator('#feedback-toggle').isChecked(),false);
  await page.locator('#feedback-toggle').check();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement.id==='next-button');await page.keyboard.press('Enter');
  await check(bank.sentences[2].answers[0]);await page.waitForFunction(()=>window.audioEvents.filter(e=>e.type==='start').length===2);
  assert.ok(await page.evaluate(()=>window.audioEvents.filter(e=>e.type==='start').every(e=>e.state==='running')));
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS real Web Audio: distinct blank / unmatched / matched cues; success animation; immediate keyboard next; no replay on reload; mute persisted; previews leave progress intact.');

  const mobile = await browser.newContext({viewport:{width:320,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await mobile.addInitScript(observeAudio);const mp=await mobile.newPage();
  await mp.goto(url);await mp.waitForFunction(()=>!document.getElementById('answer').disabled);
  await mp.locator('#answer').fill(bank.sentences[0].answers[0]);await mp.locator('#submit-button').tap();
  await mp.waitForFunction(()=>window.audioEvents.filter(e=>e.type==='start').length===2);
  assert.equal(await mp.locator('#result-icon').evaluate(e=>getComputedStyle(e).animationName),'none');
  await mp.locator('#next-button').tap();assert.equal(await mp.locator('#question-number').textContent(),'02 / 06');
  await mp.locator('#settings-open').tap();
  assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
  assert.equal(await mp.locator('#feedback-toggle').isVisible(),true);
  await mp.locator('.feedback-previews').scrollIntoViewIfNeeded();
  await mp.screenshot({path:fileURLToPath(new URL('feedback-mobile-settings.png',out)),fullPage:true});
  await mobile.close();console.log('PASS mobile touch: audio unlocks on submission; 320px settings fit; reduced motion disables animation.');

  for (const failure of ['unavailable','resume-blocked']) {
    const fallback=await browser.newContext();
    await fallback.addInitScript(mode=>{
      if (mode==='unavailable') { window.AudioContext=undefined;window.webkitAudioContext=undefined; }
      else window.AudioContext=class { state='suspended';resume(){return Promise.reject(new Error('Audio blocked'));} };
    },failure);
    const fp=await fallback.newPage(),failures=[];fp.on('pageerror',e=>failures.push(e.message));
    await fp.goto(url);await fp.waitForFunction(()=>!document.getElementById('answer').disabled);
    await fp.locator('#answer').fill(bank.sentences[0].answers[0]);await fp.keyboard.press('Enter');
    await fp.locator('#feedback').waitFor({state:'visible'});await fp.keyboard.press('Enter');
    assert.equal(await fp.locator('#question-number').textContent(),'02 / 06');assert.deepEqual(failures,[]);
    await fallback.close();
  }
  console.log('PASS unavailable / blocked audio: answer, saved progress and keyboard next remain usable.');
} finally { await browser.close(); }
