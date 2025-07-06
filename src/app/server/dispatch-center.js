/**
 * communication between webview and app
 * run functions in seprate process, avoid using electron.remote directly
 */

const fs = require('./fs')
const log = require('../common/log')
const { Upgrade } = require('./download-upgrade')
const fetch = require('./fetch')
const sync = require('./sync')
const {
  createTerm,
  testTerm,
  resize,
  runCmd,
  toggleTerminalLog,
  toggleTerminalLogTimestamp
} = require('./terminal-api')
const globalState = require('./global-state')
const wsDec = require('./ws-dec')

const { tokenElecterm } = process.env

function verify (req) {
  const { token: to } = req.query
  if (to !== tokenElecterm) {
    throw new Error('not valid request')
  }
  if (process.env.requireAuth === 'yes' && !globalState.authed) {
    throw new Error('auth required')
  }
}

const initWs = function (app) {
  // upgrade
  app.ws('/upgrade/:id', (ws, req) => {
    verify(req)
    wsDec(ws)
    const { id } = req.params
    ws.on('close', () => {
      const inst = globalState.getUpgradeInst(id)
      if (inst) {
        inst.destroy()
      }
    })
    ws.on('message', async (message) => {
      const msg = JSON.parse(message)
      const { action } = msg

      if (action === 'upgrade-new') {
        const { id } = msg
        const opts = Object.assign({}, msg, {
          ws
        })
        const inst = new Upgrade(opts)
        globalState.setUpgradeInst(id, inst)
        await inst.init()
      } else if (action === 'upgrade-func') {
        const { id, func, args } = msg
        globalState.getUpgradeInst(id)[func](...args)
      }
    })
  })

  // common functions
  app.ws('/common/s', (ws, req) => {
    verify(req)
    wsDec(ws)
    ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message)
        const { action } = msg
        if (action === 'fetch') {
          fetch(ws, msg)
        } else if (action === 'sync') {
          sync(ws, msg)
        } else if (action === 'fs') {
          fs(ws, msg)
        } else if (action === 'create-terminal') {
          createTerm(ws, msg)
        } else if (action === 'test-terminal') {
          testTerm(ws, msg)
        } else if (action === 'resize-terminal') {
          resize(ws, msg)
        } else if (action === 'toggle-terminal-log') {
          toggleTerminalLog(ws, msg)
        } else if (action === 'toggle-terminal-log-timestamp') {
          toggleTerminalLogTimestamp(ws, msg)
        } else if (action === 'run-cmd') {
          runCmd(ws, msg)
        }
      } catch (err) {
        log.error('common ws error', err)
      }
    })
  })
  // end
}

exports.verifyWs = verify
exports.initWs = initWs
