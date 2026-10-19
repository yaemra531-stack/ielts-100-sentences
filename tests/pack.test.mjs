import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack, migrateLearningPoints, createPublicPoints, exportSessionMarkdown } from '../shared/pack.js';

test('pack validation accepts valid ielts6-pack data', () => {
  const sample = {
    format: 'ielts6-pack',
    version: 1,
    points: [
      {
        id: 'T2-30',
        part: 'T2',
        title: 'best way：不仅验证有效还需比较优劣',
        category: '审题与观点',
        chapter: '',
        page: null,
        book: '',
        explain: '双向论证',
        useWhen: '',
        mistakes: [],
        ai: '建议比较',
        examples: [],
        verify: { title: false, page: false, book: false }
      }
    ],
    questions: [
      {
        id: 'Q2-0001',
        task: 'T2',
        type: 'opinion',
        source: '原创示例',
        prompt: 'Some people believe that...',
        pointIds: ['T2-30']
      }
    ],
    sessions: [
      {
        id: '2026-10-19-01',
        date: '2026-10-19',
        questionId: 'Q2-0001',
        mode: '审题 + 主体段',
        minutes: 45,
        draft: 'My draft essay',
        feedbackRaw: 'Feedback',
        issues: [
          {
            criterion: 'TR',
            tag: '立场不完整',
            pointIds: ['T2-30'],
            chunk: null,
            note: '没有比较'
          }
        ],
        rewrite: 'My rewrite essay',
        independent: true
      }
    ]
  };

  const res = validatePack(sample);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
  assert.equal(res.pack.points.length, 1);
  assert.equal(res.pack.questions.length, 1);
  assert.equal(res.pack.sessions.length, 1);
});

test('pack validation catches wrong format or version', () => {
  assert.equal(validatePack(null).valid, false);
  assert.equal(validatePack({ format: 'wrong', version: 1, points: [], questions: [], sessions: [] }).valid, false);
  assert.equal(validatePack({ format: 'ielts6-pack', version: 2, points: [], questions: [], sessions: [] }).valid, false);
});

test('pack validation checks point ID format and criterion enum', () => {
  const badPoint = {
    format: 'ielts6-pack',
    version: 1,
    points: [{ id: 'BAD-ID', part: 'T2', title: '', verify: {} }],
    questions: [],
    sessions: []
  };
  assert.equal(validatePack(badPoint).valid, false);

  const badCriterion = {
    format: 'ielts6-pack',
    version: 1,
    points: [{ id: 'T2-01', part: 'T2', title: '', verify: {} }],
    questions: [{ id: 'Q2-0001', task: 'T2', prompt: 'test', pointIds: [] }],
    sessions: [{
      id: 's1',
      questionId: 'Q2-0001',
      issues: [{ criterion: 'INVALID_CRIT', tag: '' }]
    }]
  };
  assert.equal(validatePack(badCriterion).valid, false);
});

test('migrateLearningPoints follows exact migration rules', () => {
  const oldNotes = {
    items: [
      {
        id: 'T2-30',
        part: 'Task 2',
        title: 'best way：不仅验证有效还需比较优劣',
        category: '审题与观点',
        summary: '题干包含 the best way 时，需证明为何优于其他方法。',
        howToUse: '主体段列出修路与公共交通的对比。',
        pitfall: '只证明修路有效，未与替代方案比较。',
        sourceStatus: '已结合本次逐点讲解'
      }
    ]
  };

  const migrated = migrateLearningPoints(oldNotes);
  assert.equal(migrated.length, 1);
  const p = migrated[0];
  assert.equal(p.id, 'T2-30');
  assert.equal(p.part, 'T2');
  assert.equal(p.explain, oldNotes.items[0].summary, 'summary 必须迁移为 explain');
  assert.ok(p.ai.includes(oldNotes.items[0].howToUse), 'howToUse 必须并入 ai');
  assert.ok(p.ai.includes(oldNotes.items[0].pitfall), 'pitfall 必须并入 ai');
  assert.deepEqual(p.verify, { title: false, page: false, book: false }, 'verify 必须全为 false');
});

test('createPublicPoints strips sensitive explanation and AI fields', () => {
  const points = [
    {
      id: 'T2-30',
      part: 'T2',
      title: 'best way 比较',
      category: '审题',
      explain: '私密教材转述',
      ai: '私密建议',
      verify: { title: false, page: false, book: false }
    }
  ];

  const pub = createPublicPoints(points);
  assert.equal(pub[0].id, 'T2-30');
  assert.equal(pub[0].title, 'best way 比较');
  assert.equal(pub[0].explain, '');
  assert.equal(pub[0].ai, '');
});

test('exportSessionMarkdown formats session correctly', () => {
  const session = {
    id: '2026-10-19-01',
    date: '2026-10-19',
    questionId: 'Q2-0001',
    mode: '审题 + 主体段',
    minutes: 45,
    draft: 'Draft essay body',
    feedbackRaw: 'Good structure',
    issues: [
      {
        criterion: 'TR',
        tag: '未比较优劣',
        pointIds: ['T2-30'],
        chunk: 'build roads',
        note: '需要补充替代手段'
      }
    ],
    rewrite: 'Rewrite essay body',
    independent: true
  };

  const question = {
    id: 'Q2-0001',
    task: 'T2',
    type: '观点类',
    prompt: 'Should cities build more roads?'
  };

  const pointsMap = {
    'T2-30': { title: 'best way 比较', verify: { title: false, page: false, book: false } }
  };

  const md = exportSessionMarkdown(session, question, pointsMap);
  assert.ok(md.includes('# 雅思写作训练记录 · 2026-10-19'));
  assert.ok(md.includes('Q2-0001'));
  assert.ok(md.includes('Should cities build more roads?'));
  assert.ok(md.includes('Draft essay body'));
  assert.ok(md.includes('[TR] 未比较优劣'));
  assert.ok(md.includes('`T2-30` best way 比较 [草稿]'));
  assert.ok(md.includes('Rewrite essay body'));
  assert.ok(md.includes('独立重写 ✓'));
});
