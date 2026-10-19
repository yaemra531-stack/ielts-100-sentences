/**
 * ChatGPT 批改提示词生成与回复解析模块
 */

/**
 * 生成复制给 ChatGPT 的批改提示词
 * @param {object} params
 * @param {object} params.question 题目对象
 * @param {string} params.draft 用户的作答初稿
 * @param {string} params.mode 训练模式（如：审题 + 主体段、完整大作文）
 * @param {Array<{ id: string, title: string }>} params.candidatePoints 关联/候选要点
 * @returns {string}
 */
export function buildReviewPrompt({ question, draft, mode = '审题 + 主体段', candidatePoints = [] }) {
  const taskName = question?.task === 'T1' ? 'Task 1' : 'Task 2';
  const typeMap = {
    opinion: '观点类 (Agree / Disagree)',
    discuss: '双边讨论类 (Discuss both views)',
    report: '原因与措施类 (Causes & Solutions)',
    mixed: '利弊或混合提问类 (Advantages vs Disadvantages)',
    dynamic: '动态图',
    static: '静态图',
    process: '流程图',
    map: '地图题'
  };
  const typeName = typeMap[question?.type] || question?.type || '观点类';
  const promptText = question?.prompt || '';

  const pointListText = candidatePoints.length > 0
    ? candidatePoints.map(p => `- ${p.id}: ${p.title}`).join('\n')
    : '（无特定候选要点，可从 T2-01…T2-76 选取最核心要点）';

  return `你是雅思写作考官和教练。目标分数 6.0。
题目（${taskName}，${typeName}）：
${promptText}

本次练习：${mode}
我的作答：
${draft ? draft.trim() : '（未提供作答）'}

本题可能相关的教材要点（只能从中选择，不要编造新编号）：
${pointListText}

请按以下格式回答：
1. 做对了什么（1–3 条）
2. 最影响分数的 1–2 个问题：评分项（TR/TA/CC/LR/GRA）、原文位置、为什么影响分数
3. 对应的要点 ID（只用上面列出的）
4. 一个自然、符合 6 分水平的参考版本
5. 一个独立重写任务（一句话）
最后输出一个 JSON 代码块：
\`\`\`json
{"issues":[{"criterion":"","tag":"","pointIds":[],"chunk":null,"note":""}],"rewriteTask":""}
\`\`\``;
}

/**
 * 解析 ChatGPT 返回的内容，提取 issues、rewriteTask 及参考版本
 * @param {string} rawText
 * @returns {{ success: boolean, issues?: any[], rewriteTask?: string, reference?: string, error?: string, raw: string }}
 */
export function parseAiResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, error: '输入内容为空', raw: '' };
  }

  const cleanText = rawText.trim();
  let jsonString = '';

  // 1. 尝试匹配 ```json ... ``` 或 ``` ... ``` 里的 JSON
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  const codeBlocks = [];
  while ((match = codeBlockRegex.exec(cleanText)) !== null) {
    codeBlocks.push(match[1].trim());
  }

  // 优先看最后一个代码块（因为提示词要求最后输出 JSON）
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    const block = codeBlocks[i];
    if (block.includes('"issues"') || block.includes('issues')) {
      jsonString = block;
      break;
    }
  }

  // 2. 如果没匹配到代码块，尝试用大括号范围匹配
  if (!jsonString) {
    const braceMatch = cleanText.match(/\{[\s\S]*"issues"[\s\S]*\}/);
    if (braceMatch) {
      jsonString = braceMatch[0];
    }
  }

  // 3. 尝试解析 JSON
  let parsed = null;
  if (jsonString) {
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      // 容错：去除多余逗号或换行再试一次
      try {
        const fixed = jsonString.replace(/,\s*([}\]])/g, '$1');
        parsed = JSON.parse(fixed);
      } catch {
        // 继续向下
      }
    }
  }

  // 4. 尝试提取第 4 点参考版本
  let reference = '';
  const refMatch = cleanText.match(/(?:(?:4\.|第\s*4\s*点)[^\n]*?(?:参考版本|6\s*分版本)[^\n]*\n)([\s\S]*?)(?=(?:(?:5\.|第\s*5\s*点)|最后|```|$))/i);
  if (refMatch && refMatch[1]) {
    reference = refMatch[1].trim();
  }

  if (!parsed || !Array.isArray(parsed.issues)) {
    return {
      success: false,
      error: '未能从回复中解析出格式正确的 JSON（包含 issues 数组）',
      reference: reference || undefined,
      raw: cleanText
    };
  }

  const validCriteria = ['TR', 'TA', 'CC', 'LR', 'GRA'];
  const sanitizedIssues = parsed.issues.map(iss => {
    let crit = String(iss.criterion || 'TR').toUpperCase().trim();
    if (!validCriteria.includes(crit)) {
      if (crit.includes('TR')) crit = 'TR';
      else if (crit.includes('TA')) crit = 'TA';
      else if (crit.includes('CC')) crit = 'CC';
      else if (crit.includes('LR')) crit = 'LR';
      else if (crit.includes('GRA')) crit = 'GRA';
      else crit = 'TR';
    }

    return {
      criterion: crit,
      tag: String(iss.tag || '未命名问题').trim(),
      pointIds: Array.isArray(iss.pointIds) ? iss.pointIds.map(String) : [],
      chunk: iss.chunk ? String(iss.chunk).trim() : null,
      note: String(iss.note || '').trim()
    };
  });

  return {
    success: true,
    issues: sanitizedIssues.slice(0, 2), // 最多保留 1-2 个核心问题
    rewriteTask: String(parsed.rewriteTask || '').trim(),
    reference: reference || (parsed.reference ? String(parsed.reference).trim() : ''),
    raw: cleanText
  };
}
