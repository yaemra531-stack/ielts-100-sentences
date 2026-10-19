/**
 * ielts6-pack 数据包校验、迁移与序列化模块
 */

export const PACK_FORMAT = 'ielts6-pack';
export const PACK_VERSION = 1;

/**
 * 校验数据包对象
 * @param {any} data
 * @returns {{ valid: boolean, errors: string[], pack?: any }}
 */
export function validatePack(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['数据包必须为非空 JSON 对象'] };
  }

  if (data.format !== PACK_FORMAT) {
    errors.push(`数据包 format 必须为 "${PACK_FORMAT}"，当前为 "${data.format}"`);
  }

  if (data.version !== PACK_VERSION) {
    errors.push(`数据包 version 必须为 ${PACK_VERSION}，当前为 ${data.version}`);
  }

  if (!Array.isArray(data.points)) {
    errors.push('points 字段必须为数组');
  } else {
    data.points.forEach((p, idx) => {
      if (!p || typeof p !== 'object') {
        errors.push(`points[${idx}] 必须为对象`);
        return;
      }
      if (!p.id || !/^T[12]-\d+$/.test(p.id)) {
        errors.push(`points[${idx}].id 必须符合 T1-XX 或 T2-XX 格式，当前为 "${p.id}"`);
      }
      if (p.part !== 'T1' && p.part !== 'T2') {
        errors.push(`points[${idx}].part 必须为 "T1" 或 "T2"，当前为 "${p.part}"`);
      }
      if (typeof p.title !== 'string') {
        errors.push(`points[${idx}].title 必须为字符串`);
      }
      if (!p.verify || typeof p.verify !== 'object') {
        errors.push(`points[${idx}].verify 必须为对象`);
      }
    });
  }

  if (!Array.isArray(data.questions)) {
    errors.push('questions 字段必须为数组');
  } else {
    data.questions.forEach((q, idx) => {
      if (!q || typeof q !== 'object') {
        errors.push(`questions[${idx}] 必须为对象`);
        return;
      }
      if (!q.id || !/^Q[12]-\d+$/.test(q.id)) {
        errors.push(`questions[${idx}].id 必须符合 Q1-XXXX 或 Q2-XXXX 格式，当前为 "${q.id}"`);
      }
      if (q.task !== 'T1' && q.task !== 'T2') {
        errors.push(`questions[${idx}].task 必须为 "T1" 或 "T2"`);
      }
      if (typeof q.prompt !== 'string' || !q.prompt.trim()) {
        errors.push(`questions[${idx}].prompt 题目内容不能为空`);
      }
      if (!Array.isArray(q.pointIds)) {
        errors.push(`questions[${idx}].pointIds 必须为数组`);
      }
    });
  }

  if (!Array.isArray(data.sessions)) {
    errors.push('sessions 字段必须为数组');
  } else {
    data.sessions.forEach((s, idx) => {
      if (!s || typeof s !== 'object') {
        errors.push(`sessions[${idx}] 必须为对象`);
        return;
      }
      if (!s.id) {
        errors.push(`sessions[${idx}].id 不能为空`);
      }
      if (!s.questionId) {
        errors.push(`sessions[${idx}].questionId 不能为空`);
      }
      if (!Array.isArray(s.issues)) {
        errors.push(`sessions[${idx}].issues 必须为数组`);
      } else {
        const validCriteria = ['TR', 'TA', 'CC', 'LR', 'GRA'];
        s.issues.forEach((iss, j) => {
          if (!iss || typeof iss !== 'object') {
            errors.push(`sessions[${idx}].issues[${j}] 必须为对象`);
          } else if (!validCriteria.includes(iss.criterion)) {
            errors.push(`sessions[${idx}].issues[${j}].criterion 必须是 ${validCriteria.join('/')} 之一，当前为 "${iss.criterion}"`);
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    pack: errors.length === 0 ? sanitizePack(data) : undefined
  };
}

/**
 * 规范化数据包结构，填充默认值
 */
export function sanitizePack(data) {
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    points: (data.points || []).map(p => ({
      id: String(p.id),
      part: p.part === 'Task 1' ? 'T1' : (p.part === 'Task 2' ? 'T2' : p.part),
      title: String(p.title || ''),
      category: String(p.category || ''),
      chapter: String(p.chapter || ''),
      page: p.page !== null && p.page !== undefined ? Number(p.page) : null,
      book: String(p.book || ''),
      explain: String(p.explain || ''),
      useWhen: String(p.useWhen || ''),
      mistakes: Array.isArray(p.mistakes) ? p.mistakes : [],
      ai: String(p.ai || ''),
      examples: Array.isArray(p.examples) ? p.examples : [],
      verify: {
        title: Boolean(p.verify?.title),
        page: Boolean(p.verify?.page),
        book: Boolean(p.verify?.book)
      }
    })),
    questions: (data.questions || []).map(q => ({
      id: String(q.id),
      task: q.task === 'Task 1' ? 'T1' : (q.task === 'Task 2' ? 'T2' : q.task),
      type: String(q.type || 'opinion'),
      source: String(q.source || ''),
      prompt: String(q.prompt || ''),
      pointIds: Array.isArray(q.pointIds) ? q.pointIds.map(String) : []
    })),
    sessions: (data.sessions || []).map(s => ({
      id: String(s.id),
      date: String(s.date || new Date().toISOString().slice(0, 10)),
      questionId: String(s.questionId),
      mode: String(s.mode || 'analysis+body'),
      minutes: Number(s.minutes || 0),
      draft: String(s.draft || ''),
      feedbackRaw: String(s.feedbackRaw || ''),
      issues: Array.isArray(s.issues) ? s.issues.map(iss => ({
        criterion: String(iss.criterion || 'TR'),
        tag: String(iss.tag || ''),
        pointIds: Array.isArray(iss.pointIds) ? iss.pointIds.map(String) : [],
        chunk: iss.chunk ? String(iss.chunk) : null,
        note: String(iss.note || '')
      })) : [],
      rewrite: String(s.rewrite || ''),
      independent: s.independent !== false
    }))
  };
}

/**
 * 迁移旧版 notes/learning-points.json
 * 规则：summary → explain，howToUse / pitfall → ai，verify 全部设为 false
 */
export function migrateLearningPoints(oldData) {
  const items = Array.isArray(oldData?.items) ? oldData.items : [];
  return items.map(item => {
    const aiParts = [];
    if (item.howToUse) aiParts.push(`【真题中怎么用】${item.howToUse}`);
    if (item.pitfall) aiParts.push(`【典型误区】${item.pitfall}`);

    const part = item.part === 'Task 1' ? 'T1' : (item.part === 'Task 2' ? 'T2' : item.part);

    return {
      id: String(item.id),
      part,
      title: String(item.title || ''),
      category: String(item.category || ''),
      chapter: '',
      page: null,
      book: '',
      explain: String(item.summary || ''),
      useWhen: '',
      mistakes: [],
      ai: aiParts.join('\n\n'),
      examples: [],
      verify: {
        title: false,
        page: false,
        book: false
      }
    };
  });
}

/**
 * 生成仅包含 ID + 短标题的公开要点
 */
export function createPublicPoints(points) {
  return points.map(p => ({
    id: p.id,
    part: p.part,
    title: p.title,
    category: p.category,
    chapter: '',
    page: null,
    book: '',
    explain: '',
    useWhen: '',
    mistakes: [],
    ai: '',
    examples: [],
    verify: {
      title: Boolean(p.verify?.title),
      page: Boolean(p.verify?.page),
      book: Boolean(p.verify?.book)
    }
  }));
}

/**
 * 将单次训练会话导出为 Markdown
 */
export function exportSessionMarkdown(session, question, pointsMap = {}) {
  const dateStr = session.date || new Date().toISOString().slice(0, 10);
  const qId = question?.id || session.questionId || '未知题目';
  const qPrompt = question?.prompt || '（无题目文本）';
  const mode = session.mode || '审题 + 主体段';
  const minutes = session.minutes || 0;
  const indepText = session.independent ? '独立重写 ✓' : '订正（曾查看参考）';

  const lines = [
    `# 雅思写作训练记录 · ${dateStr}`,
    '',
    `- **题目编号**：${qId}`,
    `- **任务类型**：${question?.task || 'T2'} · ${question?.type || '观点题'}`,
    `- **训练模式**：${mode}`,
    `- **练习用时**：${minutes} 分钟`,
    `- **重写状态**：${indepText}`,
    '',
    '## 题目',
    '',
    `> ${qPrompt.replace(/\n/g, '\n> ')}`,
    '',
    '## 我的初稿',
    '',
    session.draft ? session.draft : '（未输入初稿）',
    '',
    '## 诊断问题与关联要点',
    ''
  ];

  if (!session.issues || session.issues.length === 0) {
    lines.push('（无诊断问题）');
  } else {
    session.issues.forEach((iss, idx) => {
      lines.push(`### 问题 ${idx + 1}：[${iss.criterion}] ${iss.tag || '未命名问题'}`);
      if (iss.note) {
        lines.push(`- **说明**：${iss.note}`);
      }
      if (iss.chunk) {
        lines.push(`- **关联词伙**：\`${iss.chunk}\``);
      }
      if (iss.pointIds && iss.pointIds.length > 0) {
        const pointDescs = iss.pointIds.map(pid => {
          const pt = pointsMap[pid];
          if (!pt) return pid;
          const verified = pt.verify?.title && pt.verify?.page && pt.verify?.book;
          return `\`${pid}\` ${pt.title} [${verified ? '已核对' : '草稿'}]`;
        });
        lines.push(`- **教材要点**：${pointDescs.join('；')}`);
      }
      lines.push('');
    });
  }

  lines.push('## 独立重写');
  lines.push('');
  lines.push(session.rewrite ? session.rewrite : '（未输入重写）');
  lines.push('');

  if (session.feedbackRaw) {
    lines.push('## AI 原始批改回复');
    lines.push('');
    lines.push(session.feedbackRaw);
    lines.push('');
  }

  return lines.join('\n');
}
