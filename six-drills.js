/* 每日一题 · 配套练习题库
 * packs[qid] 对应 six-data.js 里的题目 id，做完这一天的题后在「练习」页练。
 * 题型：
 *   chunk  中文 → 英文词块默写；en 用 " / " 分隔多个可接受答案（第一个是标准答案）
 *   cloze  句型填空；text 里用 {答案} 标空，空内用 "/" 分隔备选
 *   choice 选择题；a 为正确选项下标，why 为解析
 */
(function (root) {
  'use strict';
  const c = (id, zh, en) => ({ id, type: 'chunk', zh, en });
  const z = (id, zh, text) => ({ id, type: 'cloze', zh, text });
  const q = (id, tag, stem, opts, a, why) => ({ id, type: 'choice', tag, q: stem, opts, a, why });

  root.SIX_DRILLS = {
    packs: {
      'B2.2.9': {
        title: '第 1 天 · 不交税',
        note: '题目：Some people believe that they should be able to keep all the money they earn and should not pay any tax to the state.',
        items: [
          /* --- 读题与逻辑 --- */
          q('t1-keep', '读题', '题目里 keep all the money they earn 的 keep 是什么意思？', ['留着、自己拿着（挣的钱）', '保持', '坚持', '继续做'], 0, '常见词别只记第一义：keep 在这里是「留着」，keep all the money they earn = 挣的钱全留着。'),
          q('t1-state', '读题', 'pay tax to the state 里的 state 指什么？', ['国家（政府）', '状态', '美国的州', '陈述'], 0, 'state 作名词常指「国家」。整句是「不向国家交税」，不是「交税」以外的别的事。'),
          q('t1-all', '读题', '哪组词决定了这题讨论的是「一分税都不交」，而不是「少交点税」？', ['all the money … not pay any tax', 'some people believe', 'should be able to', 'they earn'], 0, '盯住绝对词：all / not…any。写成「税太高应该降税」就偏题了。'),
          q('t1-steps', '读题', '见题三步的正确顺序是？', ['理解意思 → 判断题型 → 确定是 A 还是 C', '判断题型 → 想例子 → 写开头', '找关键词 → 背模板 → 直接写', '先想观点 → 再读题'], 0, '先把题目意思读准（逐词直译最容易翻错），再判断题型，最后确定题目给了 A 还是 C，决定往哪个方向想。'),
          q('t1-pay', '读题', '为什么「pay tax = 交税」这种逐词直译容易出问题？', ['只对上了字面，没读出整句「全部收入都留着、一分不交」的意思', '因为 pay 不是「交」', '因为 tax 不可数', '没有问题'], 0, '翻译不准的三个习惯：常见词只记第一义、逐词直译、没盯绝对词。读题要读整句意思。'),
          q('t1-A', 'ABC', '这道题题目给出的 A（动作 / 做法）是？', ['所有人都不交税，挣的钱全留着', '政府没有钱', '经济增长变慢', '贫富差距扩大'], 0, 'A 是一个动作或做法。后三个都是它带来的结果（B 或 C），是你要自己想的。'),
          q('t1-should', 'ABC', '题目是 should，你反对「不交税」，主体段该怎么想？', ['从 A 往后想坏处', '从 C 往前想原因', '想不交税的好处', '写各国税率的对比'], 0, '要点 32：should 题确定了 A——支持就往后想好处，反对就往后想坏处。'),
          q('t1-hw1', 'ABC', '「Students should do a lot of homework.」题目确定了什么？', ['A：一个动作，往后想结果', 'C：一个结果，往前想原因', 'A 和 C：想中间的 B', '什么都没确定'], 0, '书 p.10 的作业例子：A 做作业 → B 巩固知识 → C 成绩更好（反对：没时间玩 → 不能全面发展）。'),
          q('t1-hw2', 'ABC', '「In the future, teachers will give students less homework.」题目确定了什么？', ['C：一个结果，往前想原因', 'A：一个动作，往后想结果', 'A 和 C：想中间的 B', '什么都没确定'], 0, '「将来作业会变少」是结果，要往前想：为什么会少？'),
          q('t1-hw3', 'ABC', '「Doing more homework helps students find jobs.」题目确定了什么？', ['A 和 C：想中间的 B，把两头连起来', 'A：只想结果', 'C：只想原因', '什么都没确定'], 0, '做作业（A）和找工作（C）都给了，你要想 B：作业怎么帮到找工作？'),
          q('t1-B', 'ABC', '下面哪条链里的 B 是「新事情」？', ['不交税 → 政府没有税收收入 → 修不了路和学校', '不交税 → 人们不给国家钱 → 政府没有钱', '不交税 → 大家都不交税 → 政府很困难', '不交税 → 税没交 → 很不好'], 0, 'B 必须往前走一步，不能只是 A 换个说法。「不给国家钱」就是「不交税」。'),
          q('t1-jump', '逻辑', '「Governments build schools. Therefore, the economy grows.」中间漏了什么？', ['学生获得知识和技能 → 成为熟练工人', '学校的数量', '老师的工资', '学校建在哪里'], 0, '解释不能跳跃：建学校 → 学到知识技能 → 成为熟练工人 → 促进经济增长。范文这一步就跳了。'),
          q('t1-topic', '段落', '哪句更适合做主体段中心句？', ['Without tax revenue, governments could not provide public services that are essential to economic growth.', 'Without tax, the road from my home to the city centre would never be built.', 'Tax is very important.', 'Many people do not like paying tax.'], 0, '书 p.88 批注：中心句是概括，不要太具体（第 2 句是例子的写法）；也不能空（第 3 句）。'),
          q('t1-body', '段落', '主体段的结构是？', ['中心句 + 解释 2–3 句 + 举例', '举例 + 举例 + 举例', '中心句 + 重复中心句', '背景 + 观点 + 让步'], 0, '中心句先给观点，解释一步步推（不跳跃），最后用例子落地。'),
          q('t1-end', '段落', '主体段最后一句怎么写更好？', ['补一句「为什么」或后果（例：看不起病 → 因病致贫）', '把中心句换个说法再写一遍', '加一个新观点', '写「总之，税很重要」'], 0, '你的第二个主体段首尾重复。明天的第一条：段尾不重复中心句，补「为什么」。'),
          q('t1-since', '段落', '「私营企业不愿投资（利润率低）」这句放哪最好？', ['中心句后面，用 Since … 说明为什么非得政府出钱', '段尾', '结尾段', '开头段'], 0, '它是「为什么需要政府」的理由，紧跟中心句：Since private companies are unwilling to invest in these projects, government funding becomes essential.'),
          q('t1-offtopic', '段落', '范文第二段写到「消费税」，问题在哪？', ['跑题：消费税和「收入不交税」不是一回事', '词汇太简单', '句子太长', '没有问题'], 0, '题目说的是收入（the money they earn）不交税。范文也有坑：中心句太具体、学校→经济跳跃、消费税跑题。'),
          q('t1-len', '篇幅', '250 词大约要写多少句？', ['17–20 句（每句约 12 词）', '8–10 句', '30 句以上', '5 句'], 0, '按每句约 12 词估。你短句偏多，明天至少合并一组短句。'),
          q('t1-layers', '方法', '英语写作的三层，先抓哪层？', ['逻辑链（ABC）→ 句型 → 词块', '词块 → 句型 → 逻辑链', '只背范文', '先背高级词汇'], 0, '逻辑通了才有内容；句型决定句子结构；词块让表达地道。'),
          /* --- 语法判断 --- */
          q('t1-gov', '改错', '「The government have to help people in need.」哪里要改？', ['have → has', 'help → helps', 'people → peoples', '没有错'], 0, 'the government 在这里作单数，谓语用 has。'),
          q('t1-rev', '改错', '「Tax revenue are used to build schools.」哪里要改？', ['are → is（revenue 不可数）', 'used → use', 'build → building', '没有错'], 0, 'revenue 不可数，谓语用单数 is。'),
          q('t1-if', '语法', 'If nobody paid tax, many people ___ afford medical bills when they got ill.', ['could not', 'cannot', 'will not', 'do not'], 0, '与事实相反的假设：If + 过去式，主句 could / would + 动词原形。'),
          q('t1-which', '语法', '「…provide public services, which is vital to economic growth.」which 后用 is 还是 are？', ['都可以：指整件事用 is，指 public services 用 are', '只能 is', '只能 are', '都不行，要用 that'], 0, '非限定从句 which 可以指前面整件事（is），也可以指前面的名词（are）。AI 说这里错，是误判。'),
          q('t1-count', 'AI 批改', 'AI 说你的作文 237 词、字数不足，实际网页统计 250 词。怎么办？', ['以网页计数为准；下次写到 260–280 词留余量', '相信 AI，重写', '删掉一段', '不用管字数'], 0, 'AI 数字数常出错。该听的是内容问题：首尾重复、句子顺序、短句太多。'),
          /* --- 词块默写 --- */
          c('t1-c01', '挣的钱全留着', 'keep all the money they earn / keep all the money people earn'),
          c('t1-c02', '一分税都不交', 'not pay any tax / pay no tax'),
          c('t1-c03', '可支配收入', 'disposable income'),
          c('t1-c04', '税收收入', 'tax revenue'),
          c('t1-c05', '正常运转', 'function properly'),
          c('t1-c06', '提供公共服务', 'provide public services'),
          c('t1-c07', '经济增长', 'economic growth'),
          c('t1-c08', '修路', 'build roads'),
          c('t1-c09', '上下班（通勤）', 'travel to and from work / commute'),
          c('t1-c10', '更高效地工作', 'work more efficiently'),
          c('t1-c11', '建公立学校', 'build public schools'),
          c('t1-c12', '获得知识和技能', 'gain knowledge and skills'),
          c('t1-c13', '成为熟练工人', 'become skilled workers'),
          c('t1-c14', '促进经济增长', 'contribute to economic growth / promote economic growth / boost economic growth'),
          c('t1-c15', '投资这些项目', 'invest in these projects'),
          c('t1-c16', '利润率低', 'low profit margin / have a low profit margin / have low profit margins'),
          c('t1-c17', '帮助有需要的人', 'help people in need'),
          c('t1-c18', '防止贫富差距扩大', 'prevent the gap between the rich and the poor from widening'),
          c('t1-c19', '高收入人群', 'people with high incomes / people with high income / high-income earners'),
          c('t1-c20', '交更高的税', 'pay higher taxes'),
          c('t1-c21', '资助低收入家庭', 'support low-income families'),
          c('t1-c22', '免费医疗', 'free medical care / free healthcare'),
          c('t1-c23', '失业救济金', 'unemployment benefits'),
          c('t1-c24', '付不起医药费', 'could not afford medical bills / cannot afford medical bills / can not afford medical bills'),
          c('t1-c25', '生病', 'get ill / fall ill'),
          c('t1-c26', '变得越来越大', 'become wider and wider / become larger and larger'),
          c('t1-c27', '收入再分配', 'income redistribution'),
          c('t1-c28', '利用税收实现收入再分配的目标', 'take advantage of taxation to achieve the goal of income redistribution'),
          /* --- 句型填空 --- */
          z('t1-z01', '税收让政府能够提供公共服务，这对经济增长至关重要。', 'Tax revenue {allows/enables} governments {to} provide public services, {which} is vital to economic growth.'),
          z('t1-z02', '没有税收，政府就没法修路、建学校。', '{Without} tax revenue, governments {cannot/could not/can not} build roads or public schools.'),
          z('t1-z03', '交税有必要的另一个原因是，它能帮助有需要的人。', '{Another} reason {why} paying tax is necessary is {that} it helps people in need.'),
          z('t1-z04', '政府可以通过提供免费医疗来资助低收入家庭。', 'Governments can support low-income families {by} {providing/offering} free medical care.'),
          z('t1-z05', '如果没人交税，很多人生病时就付不起医药费。', 'If nobody {paid} tax, many people {could} not afford medical bills when they {got/fell} ill.'),
          z('t1-z06', '由于私营企业不愿投资这些项目，政府出资就变得必不可少。', '{Since} private companies are {unwilling} to invest in these projects, government funding becomes {essential/necessary/vital}.'),
          z('t1-z07', '政府修路，从而提高了交通效率。', 'Governments build roads, {thereby} {improving} transport efficiency.'),
          z('t1-z08', '政府建公立学校，孩子们在那里获得知识和技能。', 'Governments build public schools, {where} children {gain/acquire} knowledge and skills.'),
          z('t1-z09', '政府可以利用税收实现收入再分配的目标。', 'Governments can {take} advantage of taxation to achieve the {goal/aim} of income redistribution.'),
          z('t1-z10', '总之，尽管把钱全留着看起来很诱人，我确信每个人都应该交税。', 'In {conclusion}, {although/though} keeping all the money may seem attractive, I am {convinced} that everyone should pay tax.')
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
