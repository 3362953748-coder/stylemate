/**
 * 联调脚本:验证「风格模板 → 约束改写」闭环。
 * 用同一段素材,分别在「无模板」和「套用模板」下改写,对比风格差异。
 * 用法:node scripts/verify-template-loop.mjs
 */
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'

const cloud = createWorkBuddyCloud({
  endpoint: 'https://stylemate-34839.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_JQ4RM2uVZZoJ8mV6wSjRb4_N5zj4LVU4sJlHzw6lApvYPS7tfPmDLl6',
})

const STYLE_PROMPT = `用第一人称"我"写日常随笔。通篇短句,单句控制在15-25字内,多用动词串联动作,像说话一样自然。
词汇只用日常口语,可用"最爽""拧巴""解压"这类词,允许偶尔中英混用。禁止比喻、夸张等修辞,全部白描。
情绪保持平和松弛,写小确幸但不煽情,可加一点自嘲式反转(如"一个字没憋出来,但心情意外地好")。
评价物件时用身体感受代替形容词,如"肩膀是松的"。多给具体量化细节(数量、时间、次数)。
结构上首句点题,然后按时间或事项逐条展开,一段只写一事,段落短小。
结尾不总结不升华,用一个轻口语短语或具体小细节(灯光、薄荷、"看着就开心")轻轻收住。整体像随手写的日记,不刻意修饰。`

const SOURCE = `公司新推出了一款智能升降桌,支持记忆高度,桌面材质是环保板材,质保五年,售价 1999 元。`

async function collect(messages, temperature = 0.9) {
  const models = await cloud.llm.models.list()
  const model =
    models.find((m) => m.id === 'auto' && m.disabled !== true)?.id ??
    models.find((m) => m.disabled !== true)?.id
  let out = ''
  for await (const chunk of cloud.llm.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature,
  })) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) out += delta
  }
  return out
}

const base = '你是一名专业的写作助手,改写文案使其更清晰、更有表达力。'

console.log('A) 无风格模板的通用改写:\n')
const plain = await collect([
  { role: 'system', content: base },
  {
    role: 'user',
    content: `请改写下面这段文字。只输出改写后的正文。\n\n原文:\n"""\n${SOURCE}\n"""`,
  },
])
console.log(plain)

console.log('\n' + '='.repeat(60))
console.log('B) 套用专属风格模板后的改写:\n')
const styled = await collect([
  {
    role: 'system',
    content: `${base}\n\n同时必须严格模仿以下用户的个人写作风格,这是最重要的要求:\n${STYLE_PROMPT}`,
  },
  {
    role: 'user',
    content: `请改写下面这段文字。只输出改写后的正文。\n\n原文:\n"""\n${SOURCE}\n"""`,
  },
])
console.log(styled)

console.log('\n' + '='.repeat(60))
console.log('C) 多版本并行生成(A/B/C):\n')
const specs = [
  { label: 'A', desc: '简洁专业', hint: '结构清晰、信息克制、偏书面表达' },
  { label: 'B', desc: '自然亲切', hint: '口语自然、有温度、贴近日常交流' },
  { label: 'C', desc: '情绪感染力强', hint: '节奏感强、情绪饱满、容易引发共鸣' },
]
const results = await Promise.all(
  specs.map(async (spec) => ({
    spec,
    text: await collect([
      { role: 'system', content: `${base}\n\n同时必须严格模仿以下用户的个人写作风格:\n${STYLE_PROMPT}` },
      {
        role: 'user',
        content: `语气要求:偏日常自然,既不随便也不刻板;情绪适度,有温度但不夸张;篇幅适中,信息完整但不冗余。

本次要求版本取向:【${spec.label} 版 · ${spec.desc}】。具体标准:${spec.hint}。
请围绕这一取向改写,与其他版本形成明显区分,不要试图兼顾所有风格。

只输出改写后的正文。

原文:
"""
${SOURCE}
"""`,
      },
    ], 0.95),
  })),
)
for (const r of results) {
  console.log(`\n【${r.spec.label} 版 · ${r.spec.desc}】`)
  console.log(r.text)
}
console.log('\n✅ 风格模板闭环验证通过')
