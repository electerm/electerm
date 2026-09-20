const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

describe('terminal background / main colour rules', () => {
  const load = () => import('../../../src/client/common/terminal-background.mjs')

  test('main drives the terminal background while the two agree', async () => {
    const { terminalBgFollowsMain } = await load()

    assert.equal(
      terminalBgFollowsMain({ main: '#121214', terminalBackground: '#121214' }),
      true
    )
    // a terminal background that differs was set on purpose: keep it
    assert.equal(
      terminalBgFollowsMain({ main: '#121214', terminalBackground: '#000000' }),
      false
    )
    // nothing to link without both values
    assert.equal(
      terminalBgFollowsMain({ main: '#121214', terminalBackground: '' }),
      false
    )
    assert.equal(
      terminalBgFollowsMain({ main: '', terminalBackground: '#121214' }),
      false
    )
    assert.equal(terminalBgFollowsMain({}), false)
  })

  test('a differing terminal background is the warned about case', async () => {
    const { terminalBgDiffersFromMain } = await load()

    assert.equal(
      terminalBgDiffersFromMain({ main: '#ededed', terminalBackground: '#121214' }),
      true
    )
    assert.equal(
      terminalBgDiffersFromMain({ main: '#ededed', terminalBackground: '#ededed' }),
      false
    )
    // missing values must not be reported as a mismatch
    assert.equal(
      terminalBgDiffersFromMain({ main: '#ededed', terminalBackground: undefined }),
      false
    )
    assert.equal(terminalBgDiffersFromMain({}), false)
  })

  test('exposes the theme keys and the CSS variable name', async () => {
    const { mainKey, terminalBgKey, terminalBgVar } = await load()

    assert.equal(mainKey, 'main')
    assert.equal(terminalBgKey, 'background')
    assert.equal(terminalBgVar, '--main-terminal')
  })
})
