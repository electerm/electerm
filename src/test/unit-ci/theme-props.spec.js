// CSS 契约测试 2：主题 key 与静态兜底不分叉（美化设计规范 §6.10 / §1.5 约束 A/B）
// requiredThemeProps 的 12 个 ui key 必须全部被 theme.styl 静态兜底覆盖
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../..')
const clientRoot = path.resolve(__dirname, '../../client')

// 1. requiredThemeProps：从 common/terminal-theme.js 提取（ESM 源码，正则解析）
const ttSrc = fs.readFileSync(path.join(clientRoot, 'common/terminal-theme.js'), 'utf8')
const m = ttSrc.match(/requiredThemeProps\s*=\s*\[([\s\S]*?)\]/)
assert.ok(m, 'terminal-theme.js 中应能解析出 requiredThemeProps')
const allKeys = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
const uiKeys = allKeys.filter(k => !k.startsWith('terminal:'))

// 2. theme.styl 静态兜底 key
const themeStyl = fs.readFileSync(path.join(clientRoot, 'css/includes/theme.styl'), 'utf8')
const fallbackKeys = new Set(
  themeStyl.split('\n')
    .map(l => (l.match(/^\s*--([a-z0-9-]+)\s/) || [])[1])
    .filter(Boolean)
)

// 3. iTerm 主题抽样（未安装则 skip，参照 integration 的自 skip 模式）
const themesDir = path.join(root, 'node_modules/@electerm/electerm-themes/dist/themes')
let themeFiles = []
try {
  themeFiles = fs.readdirSync(themesDir).filter(f => f.endsWith('.txt')).slice(0, 3)
} catch (e) {
  // node_modules 未安装主题包 → 后面 skip
}

describe('theme-props: 主题 key 契约', () => {
  it('requiredThemeProps 含 12 个 ui key + 20 个 terminal: key（共 33）', () => {
    assert.strictEqual(allKeys.length, 33, `实际 ${allKeys.length}`)
    assert.strictEqual(uiKeys.length, 12, `ui key 实际 ${uiKeys.length}：${uiKeys.join(', ')}`)
  })

  it('12 个 ui key 全部被 theme.styl 静态兜底覆盖', () => {
    const missing = uiKeys.filter(k => !fallbackKeys.has(k))
    assert.deepEqual(missing, [], `theme.styl 缺少兜底: ${missing.join(', ')}（会破坏空配置回落）`)
  })

  it('iTerm 主题样本包含全部 12 个 ui key', { skip: themeFiles.length === 0 && 'electerm-themes 未安装' }, () => {
    for (const f of themeFiles) {
      const txt = fs.readFileSync(path.join(themesDir, f), 'utf8')
      const keys = new Set(txt.split('\n').map(l => (l.split('=')[0] || '').trim()).filter(Boolean))
      const missing = uiKeys.filter(k => !keys.has(k))
      assert.deepEqual(missing, [], `${f} 缺少 ui key: ${missing.join(', ')}`)
    }
  })
})
