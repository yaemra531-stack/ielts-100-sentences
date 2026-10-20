/* 每日一题 · 题库与规则数据
 * 页码均为《顾家北手把手教你雅思写作（6.0 版）》书页；PDF 页 = 书页 + 偏移（默认 15，可在设置里改）。
 * 要点提示是概括，不是原书原文；以原书为准。 */
(function (root) {
  'use strict';
  const T2 = 'T2', T1 = 'T1';

  const types = {
    opinion: { label: '观点类', task: T2 },
    advdis: { label: '优缺点类', task: T2 },
    discuss: { label: '论述类', task: T2 },
    report: { label: '报告类', task: T2 },
    mixed: { label: '混合类', task: T2 },
    line: { label: '动态图', task: T1 },
    bar: { label: '静态图', task: T1 },
    process: { label: '流程图', task: T1 },
    map: { label: '地图', task: T1 }
  };

  /* 题目：source=book 有范文可对；source=abc 只有审题解析，作文靠 AI 批改。
   英文题目原文不放进公开仓库：在设置里导入本机的「题目原文包」后显示。 */
  const questions = {
    'B2.2.9': { task: T2, type: 'opinion', title: '不交税', section: '2.2.9', q: 84, a: 88, aLabel: '6 分范文', points: [32, 15], t: 85, c: 90, source: 'book' },
    'B3.2.1': { task: T1, type: 'line', title: '英国货运量线图', section: '3.2.1', q: 234, a: 236, aLabel: '7 分范文', points: [10, 12, 15], t: 234, c: 237, source: 'book' },
    'B2.2.13': { task: T2, type: 'advdis', title: '英语成为通用语言', section: '2.2.13', q: 124, a: 128, aLabel: '6.5 分范文', points: [43, 44, 14], t: 125, c: 131, source: 'book' },
    'B2.2.16': { task: T2, type: 'discuss', title: '学校教分辨对错', section: '2.2.16', q: 153, a: 157, aLabel: '6.5 分范文', points: [52, 54, 55], t: 154, c: 159, source: 'book' },
    'B2.2.20': { task: T2, type: 'report', title: '用完即弃的社会', section: '2.2.20', q: 190, a: 194, aLabel: '6.5 分范文', points: [65, 66, 67, 68], t: 191, c: 197, source: 'book' },
    'B3.3.1': { task: T1, type: 'bar', title: '澳大利亚男女选科柱状图', section: '3.3.1', q: 265, a: 267, aLabel: '7 分范文', points: [18, 20, 10], t: 266, c: 268, source: 'book' },
    'B2.2.23': { task: T2, type: 'mixed', title: '老城镇不适合现代人', section: '2.2.23', q: 218, a: 222, aLabel: '6.5 分范文', points: [74, 75, 76], t: 219, c: 224, source: 'book' },
    'B3.4.2': { task: T1, type: 'process', title: '地热发电流程图', section: '3.4.2', q: 284, a: 287, aLabel: '6.5 分范文', points: [24, 25, 26, 27], t: 285, c: 288, source: 'book' },
    'B2.2.14': { task: T2, type: 'opinion', title: '禁止针对儿童的广告', section: '2.2.14', q: 136, a: 140, aLabel: '6.5 分范文', points: [40, 41, 42], t: 137, c: 142, source: 'book' },
    'B3.5.1': { task: T1, type: 'map', title: '小岛旅游设施地图', section: '3.5.1', q: 296, a: 297, aLabel: '6.5 分范文', points: [31, 32, 34], t: 296, c: 298, source: 'book' },
    'B2.2.18': { task: T2, type: 'discuss', title: '政府管健康还是个人选择', section: '2.2.18', q: 171, a: 175, aLabel: '6 分范文', points: [52, 53, 56], t: 172, c: 177, source: 'book' },

    /* 针对期题池：书里还有范文的题 */
    'B2.2.1': { task: T2, type: 'advdis', title: '老龄化', section: '2.2.1', q: 16, a: 20, aLabel: '6.5 分范文', points: [16, 17], t: 17, c: 23, source: 'book' },
    'B2.2.2': { task: T2, type: 'advdis', title: '购买外国产品', section: '2.2.2', q: 25, a: 29, aLabel: '6 分范文', points: [16, 20], t: 26, c: 31, source: 'book' },
    'B2.2.3': { task: T2, type: 'opinion', title: '社会靠法律运转', section: '2.2.3', q: 34, a: 38, aLabel: '6.5 分范文', points: [22, 24], t: 35, c: 40, source: 'book' },
    'B2.2.11': { task: T2, type: 'opinion', title: '中学组织志愿者工作', section: '2.2.11', q: 104, a: 108, aLabel: '6.5 分范文', points: [38, 39], t: 105, c: 111, source: 'book' },
    'B2.2.15': { task: T2, type: 'discuss', title: '孩子该不该听话', section: '2.2.15', q: 145, a: 149, aLabel: '6.5 分范文', points: [52, 53, 54], t: 146, c: 151, source: 'book' },
    'B2.2.17': { task: T2, type: 'discuss', title: '钱花在艺术还是公共服务', section: '2.2.17', q: 161, a: 166, aLabel: '6 分范文', points: [55, 61], t: 162, c: 168, source: 'book' },
    'B2.2.19': { task: T2, type: 'discuss', title: '廉价航空', section: '2.2.19', q: 180, a: 185, aLabel: '6.5 分范文', points: [35, 54], t: 182, c: 188, source: 'book' },
    'B2.2.21': { task: T2, type: 'report', title: '频繁换工作', section: '2.2.21', q: 198, a: 204, aLabel: '6.5 分范文', points: [65, 68], t: 200, c: 206, source: 'book' },
    'B2.2.22': { task: T2, type: 'mixed', title: '农村人口进城', section: '2.2.22', q: 208, a: 214, aLabel: '7+ 范文（本节无 6–6.5 分版）', points: [74, 75], t: 209, c: 215, source: 'book' },
    'B3.2.2': { task: T1, type: 'line', title: '美国能源消耗（含预测）', section: '3.2.2', q: 238, a: 240, aLabel: '7 分范文', points: [15, 16], t: 239, c: 242, source: 'book' },
    'B3.2.4': { task: T1, type: 'line', title: '各国垃圾量表格', section: '3.2.4', q: 246, a: 248, aLabel: '7 分范文', points: [11, 14], t: 247, c: 249, source: 'book' },
    'B3.3.2': { task: T1, type: 'bar', title: '耕地退化饼图 + 表格', section: '3.3.2', q: 269, a: 271, aLabel: '7 分范文', points: [18, 21], t: 270, c: 273, source: 'book' },
    'B3.4.3': { task: T1, type: 'process', title: '三文鱼生命周期', section: '3.4.3', q: 289, a: 291, aLabel: '7 分范文', points: [23, 28], t: 290, c: 292, source: 'book' },
    'B3.5.2': { task: T1, type: 'map', title: '小镇中心规划地图', section: '3.5.2', q: 299, a: 301, aLabel: '6.5–7 分范文', points: [31, 34], t: 300, c: 303, source: 'book' },

    /* 针对期题池：历史真题 ABC 练习（只有审题解析） */
    'A5': { task: T2, type: 'opinion', title: '四周带薪假期', section: 'ABC 5', q: 33, points: [24], source: 'abc' },
    'A7': { task: T2, type: 'opinion', title: '社交能力和学历一样重要', section: 'ABC 7', q: 50, points: [26], source: 'abc' },
    'A10': { task: T2, type: 'opinion', title: '孩子自由太多', section: 'ABC 10', q: 73, points: [29, 35], source: 'abc' },
    'A13': { task: T2, type: 'opinion', title: '老年继续工作', section: 'ABC 13', q: 83, points: [32], source: 'abc' },
    'A3': { task: T2, type: 'advdis', title: '随处生活和工作', section: 'ABC 3', q: 24, points: [16], source: 'abc' },
    'A16': { task: T2, type: 'advdis', title: '产假', section: 'ABC 16', q: 93, points: [16, 33], source: 'abc' },
    'A19': { task: T2, type: 'advdis', title: '无车日', section: 'ABC 19', q: 112, points: [16, 41], source: 'abc' },
    'A23': { task: T2, type: 'discuss', title: '小组学习还是独自学习', section: 'ABC 23', q: 152, points: [52, 55], source: 'abc' },
    'A25': { task: T2, type: 'discuss', title: '学历史还是学实用科目', section: 'ABC 25', q: 169, points: [52, 56], source: 'abc' },
    'A27': { task: T2, type: 'report', title: '青少年犯罪', section: 'ABC 27', q: 189, points: [65, 68], source: 'abc' },
    'A28': { task: T2, type: 'report', title: '贫富差距', section: 'ABC 28', q: 198, points: [34, 65], source: 'abc' },
    'A29': { task: T2, type: 'mixed', title: '女生文科男生理科', section: 'ABC 29', q: 207, points: [74, 75], source: 'abc' },
    'A30': { task: T2, type: 'mixed', title: '生活成本上涨', section: 'ABC 30', q: 217, points: [74, 35], source: 'abc' }
  };

  /* 混乱期：2 周，10 道新题 + 2 次重写，题型全覆盖 */
  const explore = [
    { kind: 'question', qid: 'B2.2.9' },
    { kind: 'question', qid: 'B3.2.1' },
    { kind: 'question', qid: 'B2.2.13' },
    { kind: 'question', qid: 'B2.2.16' },
    { kind: 'rewrite' },
    { kind: 'question', qid: 'B2.2.20', full: true },
    { kind: 'question', qid: 'B3.3.1' },
    { kind: 'question', qid: 'B2.2.23' },
    { kind: 'question', qid: 'B3.4.2' },
    { kind: 'question', qid: 'B2.2.14' },
    { kind: 'rewrite' },
    { kind: 'mock', parts: ['B3.5.1', 'B2.2.18'] }
  ];

  /* 全真期：书后附录的考场题（题目只在书上） */
  const mocks = [
    { id: 'M21', title: '附录 21 · 2018 年考题', page: 409 },
    { id: 'M22', title: '附录 22 · 2019 年考题', page: 411 },
    { id: 'M18', title: '附录 18 + 19 · 2012/2013 年考题', page: 403 }
  ];

  const points = {
    12: ['T2', 10, 'ABC 法：先找题目确定的是 A（动作）还是 C（结果）'],
    13: ['T2', 11, 'ABC 也用来写每个主体段的中心句'],
    14: ['T2', 12, '五种题型：优缺点 / 观点 / 论述 / 报告 / 混合'],
    15: ['T2', 12, '确定 A 就往后想结果，确定 C 就往前想原因'],
    16: ['T2', 14, '优缺点类：围绕一个动作或事件谈好坏'],
    17: ['T2', 15, '注意题目对结果范围的限定'],
    20: ['T2', 23, 'rather than / instead of：只写前面那部分'],
    22: ['T2', 32, '观点类可以完全支持、完全反对或部分支持'],
    24: ['T2', 33, '题目确定 A 和 C 时，论证 A 能否导致 C'],
    26: ['T2', 49, 'as…as 结构的处理'],
    28: ['T2', 65, '比较级题目：前后两边都能写'],
    29: ['T2', 73, '将来时 / to 引出的目标：确定 C'],
    32: ['T2', 83, '题目里有 good / important / necessary / should 怎么写'],
    33: ['T2', 91, '看清题目针对的对象'],
    34: ['T2', 92, '并列结构（and / or）要找共同点，不能只写一半'],
    35: ['T2', 92, '形容词或定语限定了讨论范围'],
    36: ['T2', 93, '状语限定了思考范围'],
    37: ['T2', 94, '题目里的例子会影响词的定义'],
    38: ['T2', 102, '选最好的观点'],
    39: ['T2', 102, '哪些观点尽量别用'],
    40: ['T2', 111, '开头段不抄题，也别花太多时间'],
    41: ['T2', 112, '改写题目的三种办法'],
    42: ['T2', 112, '开头段要给出立场'],
    43: ['T2', 121, '主体段 = 中心句 + 围绕它展开的句子'],
    44: ['T2', 122, '论述的方式（不靠名人名言等）'],
    45: ['T2', 132, '四种连接方式'],
    46: ['T2', 133, '连接词别太多太机械，多用关键词复现'],
    47: ['T2', 133, '用代词连接'],
    49: ['T2', 133, '主体段中心句要和上一段衔接'],
    50: ['T2', 134, '避免全文出现跑题、重复'],
    51: ['T2', 134, '结尾段不加新信息'],
    52: ['T2', 143, '论述类的两种文章结构'],
    53: ['T2', 143, '论述类开头不用两个立场都改写'],
    54: ['T2', 144, '论述类中心句的常见写法'],
    55: ['T2', 144, '只能支持题目里出现的立场'],
    56: ['T2', 144, '两个立场看似无关时怎么处理'],
    57: ['T2', 152, '用词尽量正式'],
    60: ['T2', 152, '不用第二人称 you'],
    61: ['T2', 160, '换词靠词伙（collocation）'],
    63: ['T2', 168, '七类常见中式英文'],
    64: ['T2', 178, '从动词、名词、整句三个角度增加句子变化'],
    65: ['T2', 189, '报告类：通常问原因 + 解决方法'],
    66: ['T2', 189, '报告类主体段写 2–3 段'],
    67: ['T2', 189, '原因和方法要解释，不要罗列'],
    68: ['T2', 189, '解决方法尽量对应原因'],
    69: ['T2', 197, '6 分门槛①：逗号不能连接两个独立句'],
    70: ['T2', 198, '6 分门槛②：词性（as / with、easy / easily）'],
    71: ['T2', 198, '6 分门槛③：谓语（主谓一致、时态、情态动词）'],
    72: ['T2', 198, '6 分门槛④：句子成分残缺'],
    73: ['T2', 198, '6 分门槛⑤：单复数、不可数名词'],
    74: ['T2', 207, '混合类：两个不同类型的问题'],
    75: ['T2', 207, '混合类主体段的分配'],
    76: ['T2', 216, '论述不给力的两个原因'],
    'T10': ['T1', 230, '一定要写概述段'],
    'T11': ['T1', 230, '按是否有多个时间点分动态 / 静态'],
    'T12': ['T1', 231, '动态图写变化趋势和相对高低'],
    'T14': ['T1', 232, '动态图、静态图的分段'],
    'T15': ['T1', 232, '三种趋势的常用词'],
    'T16': ['T1', 233, '别用夸张的趋势词'],
    'T18': ['T1', 263, '静态图只有高低，没有趋势'],
    'T20': ['T1', 264, '不能漏掉任何描述对象'],
    'T21': ['T1', 264, '静态图句子包含的元素'],
    'T23': ['T1', 278, '流程图分工序图和生长图'],
    'T24': ['T1', 278, '流程图审题三要点'],
    'T25': ['T1', 278, '流程图句子的固定元素'],
    'T26': ['T1', 279, '从名词（如 grinder）推出动词'],
    'T27': ['T1', 280, '流程图的连接词'],
    'T28': ['T1', 280, '生长图的阶段时间表达'],
    'T31': ['T1', 293, '地图句子四要素'],
    'T32': ['T1', 293, '方位介词 in / on / to'],
    'T34': ['T1', 295, '地图里时间变化的表达']
  };

  /* 错误标签：前 5 个是原书说的「影响拿 6 分」的低级错误 */
  const errors = [
    { id: 'comma', label: '逗号连句', page: 197, gate: true },
    { id: 'pos', label: '词性', page: 198, gate: true },
    { id: 'verb', label: '谓语 / 时态', page: 198, gate: true },
    { id: 'frag', label: '句子残缺', page: 198, gate: true },
    { id: 'noun', label: '单复数 / 不可数', page: 198, gate: true },
    { id: 'offtopic', label: '偏题', page: 10 },
    { id: 'vague', label: '观点空泛', page: 102 },
    { id: 'thin', label: '展开不足', page: 121 },
    { id: 'link', label: '衔接生硬', page: 132 },
    { id: 'chinglish', label: '中式表达', page: 168 },
    { id: 'informal', label: '不够正式', page: 152 },
    { id: 'overview', label: 'T1 缺概述', page: 230, task: 'T1' },
    { id: 'data', label: 'T1 数据错漏', page: 396, task: 'T1' }
  ];

  const stuck = ['审题', '想观点', '段落展开', '造句', '时间不够'];

  const dims = {
    T2: [['task', '切题与立场'], ['ideas', '观点'], ['develop', '段落展开'], ['language', '语言']],
    T1: [['task', '概述与要点'], ['ideas', '数据选择'], ['develop', '分段'], ['language', '语言']]
  };

  const lookup = [
    ['题型判断错 / 偏题', '要点 12–15', 10],
    ['想不出观点', '要点 38–39；附录 1「20 个观点思考角度」p.369', 102],
    ['主体段写不长', '要点 43–44；当题翻译范例里的「中心句 / 解释 / 举例」', 121],
    ['开头段', '要点 40–42', 111],
    ['结尾段', '要点 50–51', 134],
    ['连接生硬', '要点 45–49；附录 3 p.372', 132],
    ['题目有 and / or、限定词、状语、例子', '要点 33–37', 91],
    ['语法扣分', '要点 69–73；附录 6–9 p.376–390', 197],
    ['句子写不出来', '当题翻译范例；附录 2「18 个基本句型」p.370', 370],
    ['用词不正式 / 中式表达', '要点 57–64', 152],
    ['T1 概述段', 'T1 要点 10', 230],
    ['T1 数据句', '附录 13–14', 396],
    ['T1 流程图 / 地图步骤', '附录 16–17', 401]
  ];

  root.SIX_DATA = { version: 1, pdfOffset: 15, types, questions, explore, mocks, points, errors, stuck, dims, lookup };
})(typeof window !== 'undefined' ? window : globalThis);
