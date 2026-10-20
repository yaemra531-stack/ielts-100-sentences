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

  /* 题目：source=book 有范文可对；source=abc 只有审题解析，作文靠 AI 批改。prompt 为英文题目（OCR 整理，以书为准）。
   英文题目原文不放进公开仓库：在设置里导入本机的「题目原文包」后显示。 */
  const questions = {
    'B2.2.9': { task: T2, type: 'opinion', title: '不交税', section: '2.2.9', q: 84, a: 88, aLabel: '6 分范文', points: [32, 15], t: 85, c: 90, source: 'book', prompt: "Some people believe that they should be able to keep all the money they earn and should not pay any tax to the state. To what extent do you agree or disagree?" },
    'B3.2.1': { task: T1, type: 'line', title: '英国货运量线图', section: '3.2.1', q: 234, a: 236, aLabel: '7 分范文', points: [10, 12, 15], t: 234, c: 237, source: 'book', prompt: "The graph below shows the quantities of goods transported in the UK between 1974 and 2002 by four different modes of transport." },
    'B2.2.13': { task: T2, type: 'advdis', title: '英语成为通用语言', section: '2.2.13', q: 124, a: 128, aLabel: '6.5 分范文', points: [43, 44, 14], t: 125, c: 131, source: 'book', prompt: "The advantages brought by the spread of English as a \"global language\" will outweigh the disadvantages. To what extent do you agree or disagree with this view?" },
    'B2.2.16': { task: T2, type: 'discuss', title: '学校教分辨对错', section: '2.2.16', q: 153, a: 157, aLabel: '6.5 分范文', points: [52, 54, 55], t: 154, c: 159, source: 'book', prompt: "Some people think schools should only teach students academic subjects. Others think schools should also teach students how to discriminate between right and wrong. Discuss both views and give your own opinion." },
    'B2.2.20': { task: T2, type: 'report', title: '用完即弃的社会', section: '2.2.20', q: 190, a: 194, aLabel: '6.5 分范文', points: [65, 66, 67, 68], t: 191, c: 197, source: 'book', prompt: "It has been argued that we are living in a throw-away society in which people throw away what they use in daily life, instead of recycling or reusing it. Why has this happened and how can we address this problem?" },
    'B3.3.1': { task: T1, type: 'bar', title: '澳大利亚男女选科柱状图', section: '3.3.1', q: 265, a: 267, aLabel: '7 分范文', points: [18, 20, 10], t: 266, c: 268, source: 'book', prompt: "The chart below contains information provided by Australian education institutions about the percentage of male and female students who enrolled in different subjects in 1995." },
    'B2.2.23': { task: T2, type: 'mixed', title: '老城镇不适合现代人', section: '2.2.23', q: 218, a: 222, aLabel: '6.5 分范文', points: [74, 75, 76], t: 219, c: 224, source: 'book', prompt: "The world has many towns and cities constructed in previous centuries that were more suitable and livable for people in those times than they are now. What problems will this cause today and what can be done to solve these problems?" },
    'B3.4.2': { task: T1, type: 'process', title: '地热发电流程图', section: '3.4.2', q: 284, a: 287, aLabel: '6.5 分范文', points: [24, 25, 26, 27], t: 285, c: 288, source: 'book', prompt: "The diagram below shows how geothermal energy is used to produce electricity." },
    'B2.2.14': { task: T2, type: 'opinion', title: '禁止针对儿童的广告', section: '2.2.14', q: 136, a: 140, aLabel: '6.5 分范文', points: [40, 41, 42], t: 137, c: 142, source: 'book', prompt: "Advertising aimed at children should be banned. To what extent do you agree or disagree?" },
    'B3.5.1': { task: T1, type: 'map', title: '小岛旅游设施地图', section: '3.5.1', q: 296, a: 297, aLabel: '6.5 分范文', points: [31, 32, 34], t: 296, c: 298, source: 'book', prompt: "The two maps below show an island, before and after the construction of some tourist facilities." },
    'B2.2.18': { task: T2, type: 'discuss', title: '政府管健康还是个人选择', section: '2.2.18', q: 171, a: 175, aLabel: '6 分范文', points: [52, 53, 56], t: 172, c: 177, source: 'book', prompt: "Some people say that the government should do more to ensure that people lead a healthy life, while others believe that individuals should have their own choices. Discuss both views and give your own opinion." },

    /* 针对期题池：书里还有范文的题 */
    'B2.2.1': { task: T2, type: 'advdis', title: '老龄化', section: '2.2.1', q: 16, a: 20, aLabel: '6.5 分范文', points: [16, 17], t: 17, c: 23, source: 'book', prompt: "In many countries, the proportion of older people is steadily increasing. Does this trend have positive or negative effects on society?" },
    'B2.2.2': { task: T2, type: 'advdis', title: '购买外国产品', section: '2.2.2', q: 25, a: 29, aLabel: '6 分范文', points: [16, 20], t: 26, c: 31, source: 'book', prompt: "In some countries, it is now possible for people to buy products made in other countries. To what extent do the benefits of this development outweigh the problems?" },
    'B2.2.3': { task: T2, type: 'opinion', title: '社会靠法律运转', section: '2.2.3', q: 34, a: 38, aLabel: '6.5 分范文', points: [22, 24], t: 35, c: 40, source: 'book', prompt: "The efficient functioning of society is based on rules and laws. Society would not function well if individuals were free to do whatever they wanted. To what extent do you agree or disagree?" },
    'B2.2.11': { task: T2, type: 'opinion', title: '中学组织志愿者工作', section: '2.2.11', q: 104, a: 108, aLabel: '6.5 分范文', points: [38, 39], t: 105, c: 111, source: 'book', prompt: "Volunteer work organised by middle schools brings more benefits than problems. To what extent do you agree or disagree?" },
    'B2.2.15': { task: T2, type: 'discuss', title: '孩子该不该听话', section: '2.2.15', q: 145, a: 149, aLabel: '6.5 分范文', points: [52, 53, 54], t: 146, c: 151, source: 'book', prompt: "Some people think that children should obey rules and do what their parents and teachers want them to do. Other people think that children controlled too much cannot deal with problems themselves when they become adults. Discuss both views and give your own opinion." },
    'B2.2.17': { task: T2, type: 'discuss', title: '钱花在艺术还是公共服务', section: '2.2.17', q: 161, a: 166, aLabel: '6 分范文', points: [55, 61], t: 162, c: 168, source: 'book', prompt: "Many countries spend a lot of money on art. Some people think the money spent on art is necessary, but others say money is better spent on public services and facilities. Discuss both views and give your own opinion." },
    'B2.2.19': { task: T2, type: 'discuss', title: '廉价航空', section: '2.2.19', q: 180, a: 185, aLabel: '6.5 分范文', points: [35, 54], t: 182, c: 188, source: 'book', prompt: "Many people think cheap air travel should be encouraged because it gives ordinary people freedom to travel further. However, others think this leads to environmental problems, so air travel should be more expensive in order to discourage people from travelling by air. Discuss both views and give your own opinion." },
    'B2.2.21': { task: T2, type: 'report', title: '频繁换工作', section: '2.2.21', q: 198, a: 204, aLabel: '6.5 分范文', points: [65, 68], t: 200, c: 206, source: 'book', prompt: "Nowadays it is quite common for people to change jobs regularly. Why does this happen and how do people prepare for job insecurity?" },
    'B2.2.22': { task: T2, type: 'mixed', title: '农村人口进城', section: '2.2.22', q: 208, a: 214, aLabel: '7+ 范文（本节无 6–6.5 分版）', points: [74, 75], t: 209, c: 215, source: 'book', prompt: "Many people are moving from rural areas to big cities. Why has this happened? To what extent do you think it is a good trend?" },
    'B3.2.2': { task: T1, type: 'line', title: '美国能源消耗（含预测）', section: '3.2.2', q: 238, a: 240, aLabel: '7 分范文', points: [15, 16], t: 239, c: 242, source: 'book', prompt: "The graph below gives information from a 2008 report about consumption of energy in the USA since 1980 with projections until 2030." },
    'B3.2.4': { task: T1, type: 'line', title: '各国垃圾量表格', section: '3.2.4', q: 246, a: 248, aLabel: '7 分范文', points: [11, 14], t: 247, c: 249, source: 'book', prompt: "The table shows the amount of waste produced by different countries in 1980, 1990 and 2000." },
    'B3.3.2': { task: T1, type: 'bar', title: '耕地退化饼图 + 表格', section: '3.3.2', q: 269, a: 271, aLabel: '7 分范文', points: [18, 21], t: 270, c: 273, source: 'book', prompt: "The pie chart shows the main reasons why agricultural land becomes less productive. The table shows how these causes affected three regions of the world during the 1990s." },
    'B3.4.3': { task: T1, type: 'process', title: '三文鱼生命周期', section: '3.4.3', q: 289, a: 291, aLabel: '7 分范文', points: [23, 28], t: 290, c: 292, source: 'book', prompt: "The diagrams below show the life cycle of a species of large fish called the salmon." },
    'B3.5.2': { task: T1, type: 'map', title: '小镇中心规划地图', section: '3.5.2', q: 299, a: 301, aLabel: '6.5–7 分范文', points: [31, 34], t: 300, c: 303, source: 'book', prompt: "The maps below show the centre of a small town called Islip as it is now, and plans for its development." },

    /* 针对期题池：历史真题 ABC 练习（只有审题解析） */
    'A5': { task: T2, type: 'opinion', title: '四周带薪假期', section: 'ABC 5', q: 33, points: [24], source: 'abc', prompt: "Employers should give their staff at least a 4-week holiday a year. It can make them perform better in their work. To what extent do you agree or disagree?" },
    'A7': { task: T2, type: 'opinion', title: '社交能力和学历一样重要', section: 'ABC 7', q: 50, points: [26], source: 'abc', prompt: "Social skills are as important as good qualifications for success in a job. Do you agree or disagree?" },
    'A10': { task: T2, type: 'opinion', title: '孩子自由太多', section: 'ABC 10', q: 73, points: [29, 35], source: 'abc', prompt: "Some people think children nowadays have too much freedom. To what extent do you agree or disagree?" },
    'A13': { task: T2, type: 'opinion', title: '老年继续工作', section: 'ABC 13', q: 83, points: [32], source: 'abc', prompt: "Some people believe that it is a good idea to continue to work at their old age. To what extent do you agree or disagree?" },
    'A3': { task: T2, type: 'advdis', title: '随处生活和工作', section: 'ABC 3', q: 24, points: [16], source: 'abc', prompt: "Today, people in many countries can live and work anywhere they choose because of improved communication technology and transport. Do the advantages outweigh its disadvantages?" },
    'A16': { task: T2, type: 'advdis', title: '产假', section: 'ABC 16', q: 93, points: [16, 33], source: 'abc', prompt: "In many countries women are allowed to take maternity leave from their jobs during the first few months after the birth of their baby. Do the advantages outweigh the disadvantages?" },
    'A19': { task: T2, type: 'advdis', title: '无车日', section: 'ABC 19', q: 112, points: [16, 41], source: 'abc', prompt: "Many cities have vehicle-free days, when people are required or encouraged to take a bus, cycle or travel by taxi. Do the advantages of this outweigh the disadvantages?" },
    'A23': { task: T2, type: 'discuss', title: '小组学习还是独自学习', section: 'ABC 23', q: 152, points: [52, 55], source: 'abc', prompt: "Some teachers think it is effective for students to study in groups while others think it is better to study alone. Discuss both views and give your own opinion." },
    'A25': { task: T2, type: 'discuss', title: '学历史还是学实用科目', section: 'ABC 25', q: 169, points: [52, 56], source: 'abc', prompt: "Some people think learning history in school is important. Others think learning subjects more relevant to life is important. Discuss both views and give your own opinion." },
    'A27': { task: T2, type: 'report', title: '青少年犯罪', section: 'ABC 27', q: 189, points: [65, 68], source: 'abc', prompt: "In many countries, a high proportion of criminal acts are committed by teenagers. Why has this happened? What can be done to deal with this?" },
    'A28': { task: T2, type: 'report', title: '贫富差距', section: 'ABC 28', q: 198, points: [34, 65], source: 'abc', prompt: "The gap between rich and poor is becoming wider: the rich get richer and the poor get even poorer. What has caused this problem and how can it be solved?" },
    'A29': { task: T2, type: 'mixed', title: '女生文科男生理科', section: 'ABC 29', q: 207, points: [74, 75], source: 'abc', prompt: "In schools and universities, girls tend to choose arts subjects, while boys choose science subjects. What is the reason? Should this trend be changed?" },
    'A30': { task: T2, type: 'mixed', title: '生活成本上涨', section: 'ABC 30', q: 217, points: [74, 35], source: 'abc', prompt: "In many countries, the cost of living is on the rise. What effects do higher prices have on individuals and society? How do people deal with higher costs?" }
  };

  /* 模仿期：一个题型一个单元。大作文 3 天（模仿 → 少看范文再模仿 → 真题），小作文 1 天（模仿 + 第二张图写开头和概述）。
   * 顺序：观点 → 动态图 → 优缺点 → 静态图 → 论述 → 流程图 → 报告 → 地图 → 混合，最后一天阶段全真。 */
  const learn = [
    { kind: 'imitate', unit: 'opinion', qid: 'B2.2.9' },
    { kind: 'imitate', unit: 'opinion', qid: 'B2.2.14', less: true },
    { kind: 'question', unit: 'opinion', qid: 'A13', full: true, real: true },
    { kind: 'imitate', unit: 'line', qid: 'B3.2.1', then: 'B3.2.2' },
    { kind: 'imitate', unit: 'advdis', qid: 'B2.2.2' },
    { kind: 'imitate', unit: 'advdis', qid: 'B2.2.1', less: true },
    { kind: 'question', unit: 'advdis', qid: 'A16', full: true, real: true },
    { kind: 'imitate', unit: 'bar', qid: 'B3.3.1', then: 'B3.3.2' },
    { kind: 'imitate', unit: 'discuss', qid: 'B2.2.18' },
    { kind: 'imitate', unit: 'discuss', qid: 'B2.2.16', less: true },
    { kind: 'question', unit: 'discuss', qid: 'A23', full: true, real: true },
    { kind: 'imitate', unit: 'process', qid: 'B3.4.2', then: 'B3.4.3' },
    { kind: 'imitate', unit: 'report', qid: 'B2.2.20' },
    { kind: 'imitate', unit: 'report', qid: 'B2.2.21', less: true },
    { kind: 'question', unit: 'report', qid: 'A27', full: true, real: true },
    { kind: 'imitate', unit: 'map', qid: 'B3.5.1', then: 'B3.5.2' },
    { kind: 'imitate', unit: 'mixed', qid: 'B2.2.23' },
    { kind: 'imitate', unit: 'mixed', qid: 'B2.2.22', less: true },
    { kind: 'question', unit: 'mixed', qid: 'A29', full: true, real: true },
    { kind: 'mock', unit: 'stage', parts: ['B3.2.4', 'A10'] }
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

  root.SIX_DATA = { version: 2, pdfOffset: 15, types, questions, learn, mocks, points, errors, stuck, dims, lookup };
})(typeof window !== 'undefined' ? window : globalThis);
