import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8765/';
const url = new URL('today.html', base).href;

const initialLegacyStorage = {
  'ielts100.bank.v1': JSON.stringify({ version: 1, sentences: [{ id: 's1', chinese: '测试', answers: ['test'] }] }),
  'ielts100.progress.v1': JSON.stringify({ records: { s1: { streak: 2, attempts: 2 } }, turn: 2, daily: {} }),
  'ielts100.chunks.bank.v1': JSON.stringify({ version: 1, sentences: [{ id: 's1', chunks: [{ id: 'c1', chinese: '词伙', english: 'chunk' }] }] }),
  'ielts100.chunks.progress.v1': JSON.stringify({ log: [{ id: 'c1', correct: true }] }),
  'ielts100.theme.v1': 'dark',
  'ielts100.narration.v1': 'off',
  'ielts100.feedback.v1': 'off',
  'ielts100.chunks.narration.v1': 'off'
};

const dummyAudioData = { id: 's1-audio', base64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' };

async function seedLegacyData(page) {
  await page.evaluate(({ storage, audio }) => {
    // 写入 legacy localStorage
    for (const [k, v] of Object.entries(storage)) {
      localStorage.setItem(k, v);
    }
    // 写入 legacy IndexedDB ielts100.audio.v1
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('ielts100.audio.v1', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('clips')) {
          db.createObjectStore('clips', { keyPath: 'id' });
        }
      };
      req.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('clips', 'readwrite');
        tx.objectStore('clips').put(audio);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = e => reject(req.error);
    });
  }, { storage: initialLegacyStorage, audio: dummyAudioData });
}

async function snapshotLegacyData(page) {
  return await page.evaluate(() => {
    // 读取所有以 ielts100. 开头的 localStorage 键
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ielts100.')) {
        storage[k] = localStorage.getItem(k);
      }
    }

    // 读取 IndexedDB ielts100.audio.v1 的数据
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('ielts100.audio.v1', 1);
      req.onsuccess = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('clips')) {
          db.close();
          resolve({ storage, audioClips: [] });
          return;
        }
        const tx = db.transaction('clips', 'readonly');
        const getReq = tx.objectStore('clips').getAll();
        getReq.onsuccess = () => {
          const audioClips = getReq.result;
          db.close();
          resolve({ storage, audioClips });
        };
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = e => reject(req.error);
    });
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', async d => await d.accept());

  // 1. 访问页面并预置 legacy 数据
  await page.goto(url);
  await seedLegacyData(page);

  // 2. 刷新后抓取初始快照
  await page.reload();
  await page.waitForSelector('#welcome-view:not([hidden])');
  const beforeSnapshot = await snapshotLegacyData(page);

  assert.deepEqual(beforeSnapshot.storage, initialLegacyStorage, '初始 localStorage 必须完全匹配');
  assert.equal(beforeSnapshot.audioClips.length, 1, '初始 audio.v1 必须存在 1 条测试记录');

  // 3. 执行五步训练完整交互流程
  // 步骤 1: 开始训练
  await page.click('#start-training-btn');
  await page.waitForSelector('#step-1-panel:not([hidden])');
  await page.click('#step1-next-btn');

  // 步骤 2: 输入初稿
  await page.waitForSelector('#step-2-panel:not([hidden])');
  await page.fill('#draft-input', 'Building more roads can reduce traffic congestion temporarily, but it encourages more people to drive cars.');
  await page.click('#step2-next-btn');

  // 步骤 3: 复制提示词与粘贴 AI 结果
  await page.waitForSelector('#step-3-panel:not([hidden])');
  await page.click('#copy-prompt-btn');

  // 模拟粘贴 ChatGPT 输出
  await page.click('#open-paste-modal-btn');
  await page.waitForSelector('#paste-modal:not([hidden])');
  const fakeChatGptResponse = `
1. 做对了什么：立场明确，指出了短期效果和潜在副作用。
2. 最影响分数的 1 个问题：TR 评分项，没有同发展公共交通等其他替代措施进行对比。
3. 对应要点：T2-30
4. 参考版本：
While constructing additional roads may ease congestion in the short term, investing in public transit offers a far more sustainable solution.
5. 重写任务：
重写主体段，加入公共交通的对比论证。
\`\`\`json
{
  "issues": [
    {
      "criterion": "TR",
      "tag": "best way 未比较其他办法",
      "pointIds": ["T2-30"],
      "chunk": null,
      "note": "题目问的是最好的办法，必须比较修路与公共交通等其他策略。"
    }
  ],
  "rewriteTask": "重写主体段，加入公共交通的对比论证。"
}
\`\`\`
`;
  await page.fill('#chatgpt-raw-input', fakeChatGptResponse);
  await page.click('#confirm-paste-parse-btn');
  await page.waitForSelector('#paste-modal', { state: 'hidden' });

  // 校验问题渲染成功
  assert.ok(await page.locator('.issue-card').count() >= 1, '至少渲染一个问题卡片');

  // 进入步骤 4
  await page.click('#step3-next-btn');
  await page.waitForSelector('#step-4-panel:not([hidden])');

  // 步骤 4: 输入独立重写
  await page.fill('#rewrite-input', 'Constructing more roads is not the best way to address traffic jams. In comparison, public transport is more effective.');
  await page.click('#step4-next-btn');

  // 步骤 5: 保存记录
  await page.waitForSelector('#step-5-panel:not([hidden])');
  await page.click('#save-session-btn');

  // 4. 打开设置面板，执行导出、导入与重置数据测试
  await page.click('#settings-open');
  await page.waitForSelector('#settings-modal:not([hidden])');

  // 导出完整数据包
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-full-pack-btn')
  ]);
  assert.ok(download.suggestedFilename().includes('ielts6-pack'), '导出文件名应为 ielts6-pack.json');

  // 清空重置 IndexedDB ielts6.v1
  await page.click('#reset-db-btn');

  // 5. 校验完成后的快照：所有 ielts100.* 键与 ielts100.audio.v1 必须完全一致！
  const afterSnapshot = await snapshotLegacyData(page);

  assert.deepEqual(afterSnapshot.storage, beforeSnapshot.storage, '所有 ielts100.* localStorage 键必须完全一致');
  assert.deepEqual(afterSnapshot.audioClips, beforeSnapshot.audioClips, 'IndexedDB ielts100.audio.v1 必须完全未被修改');

  console.log('PASS legacy-keys.browser: 旧系统所有 localStorage (ielts100.*) 与 IndexedDB (ielts100.audio.v1) 在新系统训练全流程、导入、导出、重置前后完全保持一致！');
  await ctx.close();
} finally {
  await browser.close();
}
