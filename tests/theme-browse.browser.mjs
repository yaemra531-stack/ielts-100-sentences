import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:8765/';
const bank=JSON.parse(await readFile(new URL('../chunks-example.json',import.meta.url),'utf8'));
const out=new URL('../.qa/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const ready=p=>p.waitForFunction(()=>document.getElementById('chunk-total').textContent.includes('项词伙'));
function observeSpeech(){
  const synth=new EventTarget();window.speechEvents=[];
  synth.getVoices=()=>[{name:'Sonia',lang:'en-GB'}];
  synth.speak=u=>speechEvents.push({text:u.text});synth.cancel=()=>speechEvents.push({cancel:true});
  Object.defineProperty(window,'speechSynthesis',{value:synth});
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
}
try{
  // The page must have the correct background even when practice modules fail to load.
  for(const [choice,system,expected,blockedStorage] of [['dark','light','dark',false],['light','dark','light',false],[null,'dark','dark',false],['invalid','dark','dark',false],[null,'dark','dark',true]]){
    const ctx=await browser.newContext({colorScheme:system});
    await ctx.addInitScript(({choice,blockedStorage})=>{
      if(blockedStorage)Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}});
      else if(choice!==null)localStorage.setItem('ielts100.theme.v1',choice);
    },{choice,blockedStorage});
    const p=await ctx.newPage();await p.route('**/*.js*',r=>r.abort());
    for(const file of ['index.html','chunks.html']){
      await p.goto(new URL(file,base).href);
      assert.equal(await p.locator('html').getAttribute('data-theme'),expected,`${file}: initial theme`);
      const styles=await p.evaluate(()=>({canvas:getComputedStyle(document.documentElement).backgroundColor,body:getComputedStyle(document.body).backgroundColor,scheme:getComputedStyle(document.documentElement).colorScheme}));
      assert.equal(styles.canvas,expected==='dark'?'rgb(24, 30, 27)':'rgb(244, 243, 238)');
      assert.equal(styles.body,styles.canvas);assert.equal(styles.scheme,expected);
    }
    await ctx.close();
  }
  console.log('PASS initial theme without practice scripts: saved dark/light overrides, system fallback, invalid choice and unavailable storage; both pages paint the matching background.');

  const ctx=await browser.newContext({colorScheme:'light',viewport:{width:1100,height:1000}});
  await ctx.addInitScript(observeSpeech);const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(new URL('chunks.html',base).href);await ready(p);
  const said=()=>p.evaluate(()=>speechEvents.filter(e=>e.text).map(e=>e.text));
  const log=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('ielts100.chunks.progress.v1')).log);
  const initialLog=await log();await p.locator('body').click({position:{x:5,y:150}});
  await p.keyboard.press('1');assert.equal((await said()).at(-1),bank.sentences[0].chunks[0].english);
  await p.keyboard.press('2');assert.equal((await said()).at(-1),bank.sentences[0].chunks[1].english);
  const n=(await said()).length;await p.keyboard.press('2');assert.equal((await said()).length,n);assert.equal(await p.evaluate(()=>speechEvents.at(-1).cancel),true);
  await p.keyboard.press('0');assert.equal((await said()).at(-1),bank.sentences[0].english);
  await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>speechEvents.at(-1).cancel),true);
  await p.keyboard.press('Space');assert.equal((await said()).at(-1),bank.sentences[0].english);
  await p.keyboard.press('ArrowRight');assert.match(await p.locator('#browse-number').textContent(),/^02/);assert.equal(await p.evaluate(()=>speechEvents.at(-1).cancel),true);
  await p.keyboard.press('1');assert.equal((await said()).at(-1),bank.sentences[1].chunks[0].english);
  await p.keyboard.press('ArrowLeft');const beforeMissing=(await said()).length;await p.keyboard.press('8');assert.equal((await said()).length,beforeMissing);
  await p.locator('#sentence-jump').focus();await p.keyboard.press('1');assert.equal((await said()).length,beforeMissing);
  await p.locator('#chunk-settings-open').click();await p.keyboard.press('1');assert.equal((await said()).length,beforeMissing);await p.keyboard.press('Escape');
  await p.locator('#drill-mode').click();await p.locator('#chunk-answer').fill('');await p.keyboard.type('120 ');assert.equal(await p.locator('#chunk-answer').inputValue(),'120 ');assert.equal((await said()).length,beforeMissing);assert.deepEqual(await log(),initialLog);
  await p.locator('#browse-mode').click();await p.locator('#theme-toggle').click();assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(await p.locator('meta[name="theme-color"]').getAttribute('content'),'#181e1b');
  await p.screenshot({path:fileURLToPath(new URL('night-browse-shortcuts.png',out)),fullPage:true});
  for(const width of [390,320]){
    await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await p.screenshot({path:fileURLToPath(new URL(`night-browse-shortcuts-${width}.png`,out)),fullPage:true});
  }
  await p.setViewportSize({width:1100,height:1000});
  for(let i=0;i<2;i++){
    await p.getByRole('link',{name:'整句默写 ↗',exact:true}).click();await p.locator('#answer:not([disabled])').waitFor();
    assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
    await p.getByRole('link',{name:'词伙',exact:true}).click();await ready(p);assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
  }
  assert.deepEqual(await log(),initialLog);assert.deepEqual(errors,[]);await ctx.close();
  console.log('PASS browse shortcuts: numbered chunks, source replay, stop, sentence navigation, missing key, input/select/settings guards, no attempts added, night navigation and mobile layout.');
}finally{await browser.close();}
