/**
 * 联调脚本:验证「多范文风格分析」这条核心链路。
 * 用法:node scripts/verify-style-analysis.mjs
 */
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'

const cloud = createWorkBuddyCloud({
  endpoint: 'https://stylemate-34839.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_JQ4RM2uVZZoJ8mV6wSjRb4_N5zj4LVU4sJlHzw6lApvYPS7tfPmDLl6',
})

const SAMPLES = [
  `搬家第三天,终于把书房收拾出来了。
原本堆到天花板的书,现在拆了七箱,寄走了三箱,剩下四箱塞进阳台柜。
最爽的是把那张用了八年的折叠桌换成了实木的,桌面终于能放下一整杯咖啡和摊开的笔记本。
晚上在桌前写了两个小时,一个字都没憋出来,但心情意外地好。
书房的灯是暖黄色的,这是我以前不敢想的配置。`,

  `换了个新工位,第一眼就看中了那张升降桌。
之前腰疼了半年,一直以为是椅子的问题,后来发现是桌子太矮。
现在坐着写代码,手肘能自然搭在桌面上,肩膀是松的,整个人没那么拧巴了。
同事说午休趴着睡舒服,但我觉得把椅子往后一躺更爽。
桌面够大,显示器、键盘、杯子各就各位,看着就开心。`,

  `阳台上多了一盆薄荷,是我同事搬家时分给我的。
刚开始只是随手放在窗台,没想到它活得比我想象的好。
每天早上路过都能闻到那股清凉的味道,泡水喝也ok。
养植物这件事挺奇怪的,你不指望它回报什么,但它就是会让房间变得不一样。
现在每天下班回家第一件事就是看它,比看手机解压。`,
]

function parseJsonLoose(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const s = cleaned.indexOf('{')
    const e = cleaned.lastIndexOf('}')
    return JSON.parse(cleaned.slice(s, e + 1))
  }
}

async function collect(messages, opts = {}) {
  const models = await cloud.llm.models.list()
  const model =
    models.find((m) => m.id === 'balanced-model' && m.disabled !== true)?.id ??
    models.find((m) => m.disabled !== true)?.id
  let out = ''
  for await (const chunk of cloud.llm.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature: opts.temperature ?? 0.4,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  })) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) out += delta
  }
  return out
}

console.log(`分析 ${SAMPLES.length} 篇范文…\n`)

const perSample = []
for (let i = 0; i < SAMPLES.length; i++) {
  process.stdout.write(`  范文 ${i + 1}/${SAMPLES.length} … `)
  const raw = await collect(
    [
      {
        role: 'system',
        content:
          '你是一位文风分析专家。从给定文字中客观提取写作特征,只描述真实观察到的现象。每项不超过 30 字。',
      },
      {
        role: 'user',
        content: `请提取这段文字的写作特征,严格按 JSON 输出:\n{"sentenceLength":"","personUse":"","emotionalTone":"","vocabulary":"","sentencePattern":"","rhetoric":"","rhythm":"","structure":"","signature":""}\n\n${SAMPLES[i]}`,
      },
    ],
    { json: true },
  )
  const parsed = parseJsonLoose(raw)
  perSample.push(`【范文 ${i + 1}】\n${Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join('\n')}`)
  console.log('完成')
}

console.log('\n汇总归纳…')
const rawSummary = await collect(
  [
    {
      role: 'system',
      content:
        '你是资深写作风格顾问,能把零散语言观察归纳成可复用的风格画像。输出会被存成风格模板,必须具体可执行。',
    },
    {
      role: 'user',
      content: `以下��用户提供的 ${SAMPLES.length} 篇范文的逐篇特征提取结果。

${perSample.join('\n\n')}

请综合归纳出用户的个人写作风格,严格按以下 JSON 输出:
{
  "name": "6-12字的风格名字",
  "summary": "2-3句概括,100字内",
  "traits": {"language":"","sentence":"","diction":"","emotion":"","structure":""},
  "stylePrompt": "150-250字的可执行风格指令"
}`,
    },
  ],
  { json: true, temperature: 0.6 },
)

const summary = parseJsonLoose(rawSummary)
console.log('\n' + '='.repeat(60))
console.log('风格名称:', summary.name)
console.log('\n风格描述:\n' + summary.summary)
console.log('\n风格特征:')
for (const [k, v] of Object.entries(summary.traits)) {
  console.log(`  ${k}: ${v}`)
}
console.log('\n风格指令:\n' + summary.stylePrompt)
console.log('='.repeat(60))
console.log('\n✅ 风格分析链路通过')
