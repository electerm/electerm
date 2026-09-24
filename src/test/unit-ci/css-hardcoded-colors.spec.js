// CSS 契约测试 3：零硬编码颜色（美化设计规范 §6.10 / §5.3）
// allowlist：css/includes/（theme.styl 静态兜底 + tokens.styl 定义）
// 额外覆盖 hex 扫描扫不到的命名色（color red / color blue）
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

// includes/ 是唯一的颜色定义点（theme 兜底 + tokens），其余一律禁止
const files = walkStyl(clientRoot).filter(f => !/[\\/]css[\\/]includes[\\/]/.test(f))

const HEX = /#[0-9a-fA-F]{3,8}\b/
const NAMED = /^\s*(color|background|background-color|border-color)\s+(red|blue|green|white|black|gray|grey|orange|yellow)\s*$/

describe('css-hardcoded-colors: 零硬编码颜色', () => {
  it('非 includes 的 .styl 中不得出现 hex 颜色', () => {
    const bad = []
    for (const f of files) {
      const rel = path.relative(clientRoot, f)
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // 跳过注释行
        if (line.trim().startsWith('//')) return
        if (HEX.test(line)) bad.push(`${rel}:${i + 1}: ${line.trim()}`)
      })
    }
    assert.deepEqual(bad, [], `以下位置存在硬编码 hex（请改用 var(--token)）:\n${bad.join('\n')}`)
  })

  it('不得使用命名颜色字面量（red/blue 等）', () => {
    const bad = []
    for (const f of files) {
      const rel = path.relative(clientRoot, f)
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//')) return
        if (NAMED.test(line)) bad.push(`${rel}:${i + 1}: ${line.trim()}`)
      })
    }
    assert.deepEqual(bad, [], `以下位置存在命名颜色:\n${bad.join('\n')}`)
  })
})
