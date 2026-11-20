const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../../client/components/terminal/right-click-report.js')

// A terminal whose program has asked for mouse reports (vim `set mouse=a`,
// tmux `set -g mouse on`) - the only state the guard has an opinion about.
const tracked = (over = {}) => ({
  config: { rightClickBehavior: 'context', mouseEventsRequireAlt: false },
  mouseTrackingActive: true,
  ...over
})

describe('terminal right click report guard', () => {
  test('a click electerm opens the menu for is not reported to the program', async () => {
    const { shouldForwardRightClick } = await load()
    assert.equal(shouldForwardRightClick(tracked()), false)
  })

  test('a click electerm pastes on is not reported either', async () => {
    const { shouldForwardRightClick } = await load()
    assert.equal(
      shouldForwardRightClick(tracked({
        config: { rightClickBehavior: 'paste' }
      })),
      false
    )
  })

  // The old boolean expressed the same choice and a config synced from an older
  // version can still carry it; it means "paste", so it must not be read as
  // "the program owns the click".
  test('legacy pasteWhenContextMenu is treated as paste, not passthrough', async () => {
    const { shouldForwardRightClick } = await load()
    assert.equal(
      shouldForwardRightClick(tracked({ config: { pasteWhenContextMenu: true } })),
      false
    )
  })

  test('passthrough still hands the click to the program', async () => {
    const { shouldForwardRightClick } = await load()
    assert.equal(
      shouldForwardRightClick(tracked({
        config: { rightClickBehavior: 'passthrough' }
      })),
      true
    )
  })

  // The guard must not change anything for a plain shell: xterm sends no report
  // when no program asked for the mouse, and neither should this.
  test('inert while no program is asking for the mouse', async () => {
    const { shouldForwardRightClick } = await load()
    assert.equal(
      shouldForwardRightClick(tracked({ mouseTrackingActive: false })),
      true
    )
    assert.equal(
      shouldForwardRightClick({
        config: { rightClickBehavior: 'passthrough' },
        mouseTrackingActive: false
      }),
      true
    )
  })

  // mouseEventsRequireAlt already means "local by default, Alt hands the pointer
  // over"; someone holding Alt is asking for the report.
  test('mouseEventsRequireAlt keeps Alt as the way to forward the click', async () => {
    const { shouldForwardRightClick } = await load()
    const config = { rightClickBehavior: 'context', mouseEventsRequireAlt: true }
    assert.equal(shouldForwardRightClick(tracked({ config })), false)
    assert.equal(shouldForwardRightClick(tracked({ config, altKey: true })), true)
  })

  test('a missing config behaves like the default menu', async () => {
    const { shouldForwardRightClick } = await load()
    assert.equal(shouldForwardRightClick({ mouseTrackingActive: true }), false)
  })

  test('isMouseTrackingActive reads the public mouseTrackingMode', async () => {
    const { isMouseTrackingActive } = await load()
    assert.equal(isMouseTrackingActive({ modes: { mouseTrackingMode: 'none' } }), false)
    assert.equal(isMouseTrackingActive({ modes: { mouseTrackingMode: 'vt200' } }), true)
    assert.equal(isMouseTrackingActive({ modes: { mouseTrackingMode: 'drag' } }), true)
    assert.equal(isMouseTrackingActive({ modes: { mouseTrackingMode: 'any' } }), true)
    // not ready yet / a terminal object without modes
    assert.equal(isMouseTrackingActive(null), false)
    assert.equal(isMouseTrackingActive({}), false)
  })
})
