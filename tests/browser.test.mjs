// Test-only dependency: npm install --no-save playwright; no dependency is shipped to the site.
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.env.TEST_URL || 'http://127.0.0.1:8765/';
const bank=JSON.parse(await readFile(new URL('../sentences.json',import.meta.url),'utf8'));
const out=new URL('../.qa/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Taipei',acceptDownloads:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ielts100.progress.v1')));
const focused=()=>page.evaluate(()=>document.activeElement?.id);
const typeAnswer=async answer=>{assert.equal(await focused(),'answer');await page.keyboard.type(answer);await page.keyboard.press('Enter');await page.locator('#feedback').waitFor({state:'visible'});assert.equal(await focused(),(await state()).active.result.correct?'next-button':'retry-button');};
const next=async()=>{await page.keyboard.press('Enter');};
async function finishRound(limit=40){
  let attempts=0;
  while(await page.locator('#practice').isVisible()){
    const chinese=await page.locator('#chinese').textContent(),q=bank.sentences.find(q=>q.chinese===chinese);
    assert.ok(q);await typeAnswer(q.answers[q.answers.length-1]);await next();assert.ok(++attempts<limit,'round must finish');
  }
  assert.equal(await page.locator('#complete').isVisible(),true);
  return attempts;
}
try{
  await page.goto(url);await page.locator('#answer').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('answer').disabled);
  assert.equal(await focused(),'answer');assert.equal(await page.locator('#question-number').textContent(),'01 / 06');
  await page.screenshot({path:fileURLToPath(new URL('desktop-start.png',out)),fullPage:true});
  await typeAnswer('I usually walk by the sea.');assert.ok(await page.locator('.word-error').count()>0);assert.ok(await page.locator('.word-needed').count()>0);
  assert.equal((await state()).records['demo-01'].streak,0);
  await page.screenshot({path:fileURLToPath(new URL('desktop-diff.png',out)),fullPage:true});
  await page.reload();await page.locator('#feedback').waitFor({state:'visible'});
  assert.equal((await state()).records['demo-01'].attempts,1);assert.equal(await focused(),'retry-button');assert.equal(await page.locator('#next-button').isVisible(),false);
  await next();assert.equal(await focused(),'answer');assert.equal(await page.locator('#answer').inputValue(),'');assert.equal(await page.locator('#feedback').isVisible(),false);assert.equal(await page.locator('#attempt-history').isVisible(),false);
  await page.reload();await page.waitForFunction(()=>document.activeElement?.id==='answer');assert.equal((await state()).active.repair,true);assert.equal((await state()).active.history.length,1);
  await typeAnswer('Still wrong.');await next();await typeAnswer(bank.sentences[0].answers[0]);
  assert.equal((await state()).records['demo-01'].streak,0);assert.equal((await state()).turn,1);assert.match(await page.locator('#result-detail').textContent(),/订正/);
  await page.keyboard.press('Tab');assert.equal(await focused(),'history-summary');await page.keyboard.press('Enter');assert.equal(await page.locator('.history-item').count(),2);
  assert.match(await page.locator('#history-list').textContent(),/Still wrong/);
  await page.screenshot({path:fileURLToPath(new URL('desktop-correction-history.png',out)),fullPage:true});
  await page.keyboard.press('Shift+Tab');assert.equal(await focused(),'next-button');await next();
  assert.equal(await page.locator('#question-number').textContent(),'02 / 06');
  await page.keyboard.press('Alt+h');assert.equal(await page.locator('#hint-box').isVisible(),true);
  await page.reload();await page.locator('#hint-box').waitFor({state:'visible'});assert.equal((await state()).active.hintLevel,1);
  await typeAnswer(bank.sentences[1].answers[0]);assert.equal((await state()).records['demo-02'].streak,0);assert.match(await page.locator('#result-detail').textContent(),/提示/);await next();
  await typeAnswer(bank.sentences[2].answers[0].toUpperCase().replace('.','!!!'));assert.equal((await state()).records['demo-03'].streak,1);await next();
  assert.equal(await page.locator('#question-number').textContent(),'04 / 06');
  await page.keyboard.type('I usually');await page.reload();await page.waitForFunction(()=>document.getElementById('answer').value==='I usually');
  assert.equal(await focused(),'answer');await page.keyboard.press('ControlOrMeta+a');await typeAnswer(bank.sentences[3].answers[0]);await next();
  const steps=await finishRound();assert.equal(Object.values((await state()).records).filter(r=>r.streak===2).length,6);
  assert.equal(await page.locator('#today-count').textContent(),'6');await page.reload();await page.locator('#complete').waitFor({state:'visible'});assert.equal(await focused(),'review-button');
  await page.locator('#theme-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.reload();await page.locator('#complete').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  await page.screenshot({path:fileURLToPath(new URL('desktop-dark.png',out)),fullPage:true});
  await page.locator('#theme-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  await page.locator('#review-button').focus();
  // Keyboard access to the quiet settings dialog, backup, and reset.
  await page.keyboard.press('Shift+Tab');assert.equal(await focused(),'settings-open');await page.keyboard.press('Enter');
  await page.locator('#settings').waitFor({state:'visible'});assert.equal(await focused(),'settings-close');
  await page.keyboard.press('Tab');assert.equal(await focused(),'import-file');await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await focused(),'export-button');
  const downloadEvent=page.waitForEvent('download');await page.keyboard.press('Enter');const download=await downloadEvent;
  const backupText=await readFile(await download.path(),'utf8'),backup=JSON.parse(backupText);assert.equal(backup.format,'ielts100-backup');assert.equal(Object.values(backup.progress.records).filter(r=>r.streak===2).length,6);
  await page.keyboard.press('Tab');assert.equal(await focused(),'reset-button');page.once('dialog',d=>d.accept());await page.keyboard.press('Enter');
  assert.equal(Object.values((await state()).records).filter(r=>r.streak===2).length,0);assert.deepEqual((await state()).daily,{});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.id==='answer');assert.equal(await focused(),'answer');
  // Invalid imports must leave progress untouched; imported strings must render only as text.
  await page.locator('#settings-open').click();const before=await state();
  await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({sentences:[bank.sentences[0],bank.sentences[0]]}))});
  await page.waitForFunction(()=>document.getElementById('settings-message').classList.contains('error'));assert.deepEqual(await state(),before);
  const imported={title:'导入测试',sentences:[{id:'custom',chinese:'测试文字 <img src=x onerror="window.hacked=true">',answers:['A local sentence.'],hint:'A local'}]};
  page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'custom.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.waitForFunction(()=>document.getElementById('settings-bank').textContent.includes('导入测试'));
  await page.keyboard.press('Escape');assert.match(await page.locator('#chinese').textContent(),/<img/);assert.equal(await page.locator('#chinese img').count(),0);assert.equal(await page.evaluate(()=>window.hacked),undefined);
  await page.reload();await page.waitForFunction(()=>document.getElementById('bank-label').textContent==='导入测试');assert.match(await page.locator('#chinese').textContent(),/测试文字/);
  await page.locator('#settings-open').click();page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await page.waitForFunction(()=>document.getElementById('settings-message').textContent.includes('恢复'));await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.id==='review-button');assert.equal(await page.locator('#complete').isVisible(),true);
  // Review does not discard mastery, but an actual failure puts that sentence back in the queue.
  await page.keyboard.press('Enter');assert.equal(await page.locator('#practice').isVisible(),true);assert.equal(Object.values((await state()).records).filter(r=>r.streak===2).length,6);
  await typeAnswer('A wrong review answer.');assert.equal(Object.values((await state()).records).filter(r=>r.streak===2).length,5);const reviewId=(await state()).active.id;const reviewed=bank.sentences.find(q=>q.id===reviewId);await next();await typeAnswer(reviewed.answers[0]);await next();await finishRound();
  assert.deepEqual(errors,[]);
  console.log(`PASS desktop: keyboard round (${steps} remaining answers), diff, repeated correction gate/history, recycling, hints, draft/result reload, mastery, backup/import/reset, review, safe text rendering.`);
  for(const width of [390,320]){
    const mobile=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,timezoneId:'Asia/Taipei'});
    const mp=await mobile.newPage();await mp.goto(url);await mp.waitForFunction(()=>!document.getElementById('answer').disabled);
    assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
    await mp.screenshot({path:fileURLToPath(new URL(`mobile-${width}-start.png`,out)),fullPage:true});
    await mp.locator('#answer').fill('I usually take a walk after lunch.');await mp.locator('#submit-button').tap();await mp.locator('#feedback').waitFor({state:'visible'});
    assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
    await mp.screenshot({path:fileURLToPath(new URL(`mobile-${width}-diff.png`,out)),fullPage:true});
    assert.equal(await mp.locator('#next-button').isVisible(),false);await mp.locator('#retry-button').tap();
    assert.equal(await mp.locator('#feedback').isVisible(),false);assert.equal(await mp.locator('#answer').inputValue(),'');
    await mp.locator('#answer').fill(bank.sentences[0].answers[0]);await mp.locator('#submit-button').tap();
    assert.match(await mp.locator('#result-detail').textContent(),/订正/);
    await mp.locator('#history-summary').tap();assert.equal(await mp.locator('.history-item').count(),1);
    assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);
    await mp.screenshot({path:fileURLToPath(new URL(`mobile-${width}-correction.png`,out)),fullPage:true});
    await mp.locator('#next-button').tap();assert.equal(await mp.locator('#question-number').textContent(),'02 / 06');
    await mp.locator('#theme-toggle').tap();assert.equal(await mp.evaluate(()=>document.documentElement.dataset.theme),'dark');
    await mp.reload();await mp.locator('#answer').waitFor({state:'visible'});assert.equal(await mp.evaluate(()=>document.documentElement.dataset.theme),'dark');
    await mp.screenshot({path:fileURLToPath(new URL(`mobile-${width}-dark.png`,out)),fullPage:true});
    await mp.locator('#settings-open').tap();await mp.screenshot({path:fileURLToPath(new URL(`mobile-${width}-settings.png`,out)),fullPage:true});
    await mobile.close();console.log(`PASS mobile ${width}px: layout, touch submit/next, settings, no horizontal overflow.`);
  }
  const blocked=await browser.newContext();await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}}));
  const bp=await blocked.newPage();await bp.goto(url);await bp.waitForFunction(()=>!document.getElementById('answer').disabled);assert.match(await bp.locator('#notice').textContent(),/存储/);
  await bp.locator('#answer').fill(bank.sentences[0].answers[0]);await bp.locator('#submit-button').click();assert.match(await bp.locator('#result-title').textContent(),/写对/);await blocked.close();
  console.log('PASS storage blocked: explicit warning; practice stays usable.');
}finally{await browser.close();}
