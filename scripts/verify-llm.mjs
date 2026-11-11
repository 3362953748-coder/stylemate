/**
 * 联调脚本:验证云端 LLM 调用与模型目录可用性。
 * 用法:node scripts/verify-llm.mjs
 */
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk'

const cloud = createWorkBuddyCloud({
  endpoint: 'https://stylemate-34839.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_JQ4RM2uVZZoJ8mV6wSjRb4_N5zj4LVU4sJlHzw6lApvYPS7tfPmDLl6',
})

console.log('1) 拉取模型目录…')
const models = await cloud.llm.models.list()
console.log(`   可用模型 ${models.length} 个`)
for (const m of models.slice(0, 5)) {
  console.log(`   - ${m.id}${m.name ? ` (${m.name})` : ''}${m.disabled ? ' [已禁用]' : ''}`)
}

const usable = models.find((m) => m.disabled !== true)
if (!usable) throw new Error('没有可用模型')

console.log(`\n2) 用 ${usable.id} 做一次流式改写…`)
const messages = [
  {
    role: 'system',
    content: '你是一名小红书博主写手,语气口语自然。',
  },
  {
    role: 'user',
    content: '请把「我们新推出的智能水杯可以监测饮水量,提醒你按时喝水」改写成小红书风格,只输出正文。',
  },
]

let out = ''
let chunks = 0
for await (const chunk of cloud.llm.chat.completions.create({
  model: usable.id,
  messages,
  stream: true,
  temperature: 0.9,
})) {
  const delta = chunk.choices[0]?.delta?.content
  if (delta) {
    out += delta
    chunks++
  }
}

console.log(`   收到 ${chunks} 个增量,共 ${out.length} 字`)
console.log(`   输出预览: ${out.slice(0, 120)}…`)

console.log('\n3) 验证结构化输出(风格分析用的 JSON 模式)…')
let jsonRaw = ''
for await (const chunk of cloud.llm.chat.completions.create({
  model: usable.id,
  messages: [
    { role: 'system', content: '你是文风分析专家,只输出 JSON。' },
    {
      role: 'user',
      content:
        '分析这段文字的风格,输出 JSON:{"sentenceLength":"","emotion":""}\n\n"今天真的累死了,地铁挤到怀疑人生。晚上随便煮了碗面,加点辣椒居然还不错。"',
    },
  ],
  stream: true,
  response_format: { type: 'json_object' },
})) {
  const delta = chunk.choices[0]?.delta?.content
  if (delta) jsonRaw += delta
}
const parsed = JSON.parse(jsonRaw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''))
console.log('   解析成功:', JSON.stringify(parsed))

console.log('\n✅ LLM 链路全部通过')
