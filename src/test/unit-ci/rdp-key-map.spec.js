const { before, describe, test } = require('node:test')
const assert = require('node:assert/strict')

let getScancode

before(async () => {
  const mod = await import('../../client/components/rdp/code-scan.js')
  getScancode = mod.getScancode
})

// scan code set 1, as the IronRDP DeviceEvent API expects it
const CTRL_LEFT = 0x1D
const CTRL_RIGHT = 0xE01D
const WIN_LEFT = 0xE05B
const WIN_RIGHT = 0xE05C

describe('RDP scancode map', () => {
  test('sends the Windows key for Command by default', () => {
    assert.equal(getScancode('MetaLeft'), WIN_LEFT)
    assert.equal(getScancode('MetaRight'), WIN_RIGHT)
  })

  test('accepts the pre-2020 code spelling of the same keys', () => {
    assert.equal(getScancode('OSLeft'), WIN_LEFT)
    assert.equal(getScancode('OSRight'), WIN_RIGHT)
  })

  test('leaves Control alone when the swap is off', () => {
    assert.equal(getScancode('ControlLeft'), CTRL_LEFT)
    assert.equal(getScancode('ControlRight'), CTRL_RIGHT)
  })

  test('swaps both sides in both directions', () => {
    assert.equal(getScancode('MetaLeft', true), CTRL_LEFT)
    assert.equal(getScancode('ControlLeft', true), WIN_LEFT)
    assert.equal(getScancode('MetaRight', true), CTRL_RIGHT)
    assert.equal(getScancode('ControlRight', true), WIN_RIGHT)
  })

  test('a swapped key sends exactly what the other key sends unswapped', () => {
    // this is what "swap" means, and it is also what keeps a press and its
    // release symmetric - keydown and keyup both go through this function, so
    // an asymmetric map would leave a modifier stuck on the remote
    const pairs = [
      ['MetaLeft', 'ControlLeft'],
      ['MetaRight', 'ControlRight']
    ]
    for (const [cmd, ctrl] of pairs) {
      assert.equal(getScancode(cmd, true), getScancode(ctrl, false))
      assert.equal(getScancode(ctrl, true), getScancode(cmd, false))
    }
  })

  test('leaves every other key alone', () => {
    assert.equal(getScancode('KeyC', true), 0x2E)
    assert.equal(getScancode('ShiftLeft', true), 0x2A)
    assert.equal(getScancode('F5', true), 0x3F)
  })

  test('keeps unknown keys unmapped', () => {
    assert.equal(getScancode('NotAKey', true), undefined)
    assert.equal(getScancode('', true), 0x0000)
  })
})
