/**
 * Unit tests for the MCP widget side of the transfer fix.
 *
 * Two things are pinned here:
 *
 *  1. the defaults: the write tools stay off until someone opts in and the
 *     conflict dialog is not skipped unless someone opts in — GHSA-vw4q-c6px-w5p3
 *     was exactly a default that let an MCP client write an arbitrary local
 *     path with nobody asked;
 *  2. what the widget tells the renderer about a transfer (strict = whitelist
 *     mode, autoConfirm = the user opted out of the dialog).
 *
 * Same mocking pattern as mcp-command-rules.spec.js: the widget is an
 * electron-side module, so electron and glob-state are stubbed out.
 */

const { test, describe, before } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

let ElectermMCPServer
let widgetInfo

before(() => {
  const originalLoad = Module._load.bind(Module)
  const mockIpcMain = {
    on () {},
    removeListener () {}
  }
  const mockGlobState = {
    get () { return null },
    set () {}
  }
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return { ipcMain: mockIpcMain }
    if (request.includes('glob-state')) return mockGlobState
    return originalLoad(request, parent, isMain)
  }
  const widget = require('../../../src/app/widgets/widget-mcp-server')
  Module._load = originalLoad
  ElectermMCPServer = widget._ElectermMCPServer
  widgetInfo = widget.widgetInfo
})

const configDefault = name => {
  const item = widgetInfo.configs.find(c => c.name === name)
  return item && item.default
}

const make = config => new ElectermMCPServer({
  host: '127.0.0.1',
  port: 0,
  apiKey: 'test-key',
  ...config
})

describe('MCP widget defaults', () => {
  test('sftp read is on, sftp write is off', () => {
    assert.equal(configDefault('enableSftp'), true)
    assert.equal(configDefault('enableSftpWrite'), false)
  })

  test('silent overwrite is off', () => {
    assert.equal(configDefault('autoConfirmTransfers'), false)
  })

  test('the write switch is documented as a write switch, not a transfer switch', () => {
    const write = widgetInfo.configs.find(c => c.name === 'enableSftpWrite')
    assert.match(write.description, /upload/)
    assert.match(write.description, /download/)
    const read = widgetInfo.configs.find(c => c.name === 'enableSftp')
    assert.ok(!/upload/.test(read.description), 'enableSftp must describe read-only tools')
  })
})

describe('getTransferPolicy', () => {
  test('is permissive by default, so the conflict dialog still shows', () => {
    assert.deepEqual(make().getTransferPolicy(), {
      strict: false,
      autoConfirm: false
    })
  })

  test('reports whitelist mode as strict', () => {
    const server = make({ commandWhitelist: '^ls\\b' })
    assert.equal(server.getTransferPolicy().strict, true)
    // a blacklist is not strict mode: it only vetoes the command tools
    assert.equal(make({ commandBlacklist: '^rm ' }).getTransferPolicy().strict, false)
  })

  test('reports the opt-in for skipping the conflict dialog', () => {
    assert.equal(make({ autoConfirmTransfers: true }).getTransferPolicy().autoConfirm, true)
  })
})
