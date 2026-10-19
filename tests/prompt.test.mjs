import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPrompt, parseAiResponse } from '../shared/prompt.js';

test('buildReviewPrompt generates prompt with all required context', () => {
  const prompt = buildReviewPrompt({
    question: {
      task: 'T2',
      type: 'opinion',
      prompt: 'Some people believe that building roads is the best way to reduce traffic.'
    },
    draft: 'In my opinion, building roads is effective.',
    mode: '审题 + 主体段',
    candidatePoints: [
      { id: 'T2-30', title: 'best way 需比较优劣' },
      { id: 'T2-28', title: '比较级题论证任何一侧' }
    ]
  });

  assert.ok(prompt.includes('目标分数 6.0'));
  assert.ok(prompt.includes('Some people believe that building roads'));
  assert.ok(prompt.includes('In my opinion, building roads is effective.'));
  assert.ok(prompt.includes('T2-30: best way 需比较优劣'));
  assert.ok(prompt.includes('T2-28: 比较级题论证任何一侧'));
  assert.ok(prompt.includes('最影响分数的 1–2 个问题'));
  assert.ok(prompt.includes('{"issues":[{"criterion":"","tag":"","pointIds":[],"chunk":null,"note":""}],"rewriteTask":""}'));
});

test('parseAiResponse parses markdown code block with JSON', () => {
  const aiOutput = `
考官诊断反馈：
1. 做对了什么：主题明确，针对 traffic congestion 提出方案。
2. 最影响分数的 1 个问题：TR 评分项。未能比较其他出行方式。
3. 对应要点：T2-30
4. 参考版本：
Although building new motorways may offer short-term relief, upgrading public transit is far more effective.
5. 重写任务：重写主体段，加入公共交通的对比。

\`\`\`json
{
  "issues": [
    {
      "criterion": "TR",
      "tag": "best way 未比较优劣",
      "pointIds": ["T2-30"],
      "chunk": null,
      "note": "题目包含 best way，考官要求论证为何优于公共交通。"
    }
  ],
  "rewriteTask": "重写主体段，加入公共交通的对比。"
}
\`\`\`
`;

  const res = parseAiResponse(aiOutput);
  assert.equal(res.success, true);
  assert.equal(res.issues.length, 1);
  assert.equal(res.issues[0].criterion, 'TR');
  assert.equal(res.issues[0].tag, 'best way 未比较优劣');
  assert.deepEqual(res.issues[0].pointIds, ['T2-30']);
  assert.equal(res.rewriteTask, '重写主体段，加入公共交通的对比。');
  assert.ok(res.reference.includes('Although building new motorways'));
});

test('parseAiResponse handles raw JSON and normalizes criteria', () => {
  const rawJson = `
诊断完成，以下是机器读取结构：
{
  "issues": [
    {
      "criterion": "gra",
      "tag": "run-on sentence",
      "pointIds": ["T2-69"],
      "chunk": null,
      "note": "逗号连接两个独立分句"
    },
    {
      "criterion": "lr",
      "tag": "中式词伙",
      "pointIds": ["T2-61"],
      "chunk": "big road",
      "note": "应使用 highway 或 motorway"
    },
    {
      "criterion": "cc",
      "tag": "多余问题应被截断"
    }
  ],
  "rewriteTask": "拆分长难句，替换低质词汇"
}
`;

  const res = parseAiResponse(rawJson);
  assert.equal(res.success, true);
  assert.equal(res.issues.length, 2, '最多保留 2 个核心问题');
  assert.equal(res.issues[0].criterion, 'GRA');
  assert.equal(res.issues[1].criterion, 'LR');
  assert.equal(res.issues[1].chunk, 'big road');
  assert.equal(res.rewriteTask, '拆分长难句，替换低质词汇');
});

test('parseAiResponse returns false when JSON is missing or invalid', () => {
  const badOutput = '很遗憾，你的作文写得很好，但没有任何 JSON 代码块。';
  const res = parseAiResponse(badOutput);
  assert.equal(res.success, false);
  assert.ok(res.error);
});
