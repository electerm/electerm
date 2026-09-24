// CSS 契约测试 4：圆角/阴影只允许 token（美化设计规范 §6.10 / §3.3）
// 防止 12 种圆角 / 22 种阴影的写法再次发散
// 白名单 = 非设计语义的保留项：几何正圆/零值/功能指示条/状态光晕
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const clientRoot = path.resolve(__dirname, '../../client')

function walkStyl (dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      walkStyl(p, out)
    } else if (name.endsWith('.styl')) {
      out.push(p)
    }
  }
  return out
}

const files = walkStyl(clientRoot)

// border-radius 允许形式：
//   var(--radius*)（含多值组合 var(--radius) var(--radius) 0 0）
//   0 / none / 100% / 百分比形变（60% 40% 30% 70% / ...）
const RADIUS_OK = /^border-radius\s+(var\(--radius[a-z-]*\)|0|none|100%|[0-9.%/\s]+%)($|\s)/

// box-shadow 允许形式（单值或多值逗号组合，逐个检查）：
//   var(--shadow-1/2/3)、var(--accent-glow)、none
//   功能指示条：inset 0 ±2px 0 0 var(--primary)（dnd/激活条）
//   左侧色条：inset 2px 0 0 0 var(--primary)（列表 hover/选中/激活）
//   焦点环：inset 0 0 0 1px var(--primary)（remote-monitor 上游写法）
//   状态光晕：0 0 0 0 / 0 0 8px 2px var(--primary)（bookmark-form）
//   描边环组合：0 0 0 1px var(--border), var(--shadow-2)（浮层容器）
//   状态色条组合：inset 3px 0 0 0 var(--status), var(--shadow-2)（消息/通知芯片）
const SHADOW_ATOM = [
  /^var\(--shadow-[123]\)$/,
  /^var\(--accent-glow\)$/,
  /^none$/,
  /^inset 0 -?2px 0 0 var\(--primary\)$/,
  /^inset 2px 0 0 0 var\(--primary\)$/,
  /^inset 0 0 0 1px var\(--primary\)$/,
  /^0 0 0 0 var\(--primary\)$/,
  /^0 0 8px 2px var\(--primary\)$/,
  /^0 0 0 1px var\(--border\)$/,
  /^inset 3px 0 0 0 var\(--(success|error|warn|info)\)$/
]

function shadowOk (value) {
  return value.split(',').every(part => {
    const v = part.trim()
      // 组合形式里 token 本身含逗号（var(--accent-glow) 展开? 不会——var 引用是原子的）
      .replace(/--shadow-2\s*$/, '--shadow-2')
    return SHADOW_ATOM.some(re => re.test(v)) || /^var\(--/.test(v)
  })
}

describe('css-radius-shadow: 圆角与阴影只允许 token', () => {
  it('border-radius 不得出现 px 字面量（保留 0/none/100%/百分比几何）', () => {
    const bad = []
    for (const f of files) {
      const rel = path.relative(clientRoot, f)
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return
        const t = line.trim()
        if (!t.startsWith('border-radius')) return
        if (!RADIUS_OK.test(t)) bad.push(`${rel}:${i + 1}: ${t}`)
      })
    }
    assert.deepEqual(bad, [], `以下 border-radius 不在允许形式内:\n${bad.join('\n')}`)
  })

  it('box-shadow 不得出现裸 rgba/px（仅 token + 功能白名单）', () => {
    const bad = []
    for (const f of files) {
      const rel = path.relative(clientRoot, f)
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim()
        if (t.startsWith('//')) return
        if (t.startsWith('transition')) return // transition 里的 box-shadow 字样
        if (t.startsWith('-webkit-box-shadow')) {
          if (t !== '-webkit-box-shadow none') bad.push(`${rel}:${i + 1}: ${t}`)
          return
        }
        if (!t.startsWith('box-shadow')) return
        const value = t.replace(/^box-shadow\s+/, '')
        if (!shadowOk(value)) bad.push(`${rel}:${i + 1}: ${t}`)
      })
    }
    assert.deepEqual(bad, [], `以下 box-shadow 不在允许形式内:\n${bad.join('\n')}`)
  })
})
