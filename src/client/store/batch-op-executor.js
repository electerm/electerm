/**
 * Batch operation executor store module
 * Provides workflow step execution using MCP handler APIs
 */

import { autoRun } from 'manate'
import { refs } from '../components/common/ref'
import uid from '../common/uid'
import { statusMap } from '../common/constants'

export default Store => {
  // Internal state for tracking batch operation progress
  Store.prototype._batchProgress = {
    steps: [],
    currentIndex: 0,
    status: 'idle'
  }

  Store.prototype.getBatchProgress = function () {
    return { ...this._batchProgress }
  }

  Store.prototype.resetBatchProgress = function () {
    this._batchProgress = {
      steps: [],
      currentIndex: 0,
      status: 'idle'
    }
  }

  // Run batch operation from a JSON file (command line -bo option)
  Store.prototype.runBatchOpFromFile = async function (filePath) {
    const { store } = window
    try {
      const content = await window.fs.readFile(filePath)
      let workflows
      try {
        workflows = JSON.parse(content)
        if (!Array.isArray(workflows)) {
          throw new Error('Workflow must be an array')
        }
      } catch (e) {
        console.error('Invalid batch operation JSON:', e.message)
        return
      }

      store.resetBatchProgress()
      const results = []
      for (let i = 0; i < workflows.length; i++) {
        const step = workflows[i]
        store._batchProgress.currentIndex = i
        store._batchProgress.status = 'running'

        let result
        try {
          result = await store.executeBatchStep(step, results)
          store._batchProgress.steps.push({ name: step.name || `Step ${i + 1}`, status: 'success', result })
          results.push(result)
          console.log(`Batch op step ${i + 1} completed:`, step.name || 'unnamed')
        } catch (e) {
          store._batchProgress.steps.push({ name: step.name || `Step ${i + 1}`, status: 'error', error: e.message })
          console.error(`Batch op step ${i + 1} failed:`, e.message)
          break
        }
      }
      store._batchProgress.status = 'completed'
      console.log('Batch operation completed')
    } catch (e) {
      console.error('Failed to run batch operation from file:', e.message)
    }
  }

  // Execute a single workflow step
  Store.prototype.executeBatchStep = async function (step, previousResults) {
    const { store } = window
    const { action, prevDelay, afterDelay } = step

    if (!action) {
      throw new Error('Step must have an "action" field')
    }

    if (prevDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, prevDelay))
    }

    // Merge params into step so all handlers receive flat args (backward compatible)
    const s = step.params ? { ...step, ...step.params } : step

    let result
    switch (action) {
      case 'connect':
        result = await store.batchStepConnect(s, previousResults)
        break
      case 'command':
        result = await store.batchStepCommand(s, previousResults)
        break
      case 'sftp_upload':
        result = await store.batchStepSftpUpload(s, previousResults)
        break
      case 'sftp_download':
        result = await store.batchStepSftpDownload(s, previousResults)
        break
      case 'zmodem_upload':
        result = await store.batchStepZmodemUpload(s, previousResults)
        break
      case 'zmodem_download':
        result = await store.batchStepZmodemDownload(s, previousResults)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    if (afterDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, afterDelay))
    }

    return result
  }

  // Connect to SSH host
  Store.prototype.batchStepConnect = async function (step) {
    const { store } = window
    const p = step.params || step

    // Create tab directly (without adding to bookmarks)
    const tab = {
      id: uid(),
      type: 'ssh',
      host: p.host || '',
      port: p.port || 22,
      username: p.username || '',
      password: p.password || '',
      privateKey: p.privateKey || '',
      passphrase: p.passphrase || '',
      certificate: p.certificate || '',
      authType: p.authType || 'password',
      profile: p.profile || '',
      enableSftp: p.enableSftp !== false,
      enableSsh: p.enableSsh !== false,
      useSshAgent: p.useSshAgent !== false,
      sshAgent: p.sshAgent || '',
      term: p.term || 'xterm-256color',
      encode: p.encode || 'utf8',
      envLang: p.envLang || 'en_US.UTF-8',
      setEnv: p.setEnv || '',
      startDirectoryRemote: p.startDirectoryRemote || '',
      startDirectoryLocal: p.startDirectoryLocal || '',
      proxy: p.proxy || '',
      x11: p.x11 || false,
      displayRaw: p.displayRaw || false,
      sshTunnels: p.sshTunnels || [],
      connectionHoppings: p.connectionHoppings || [],
      title: step.name || `SSH: ${p.host}`,
      status: 'processing',
      pane: 'terminal',
      batch: store.batch
    }

    // Add the tab directly
    store.addTab(tab)

    // Wait for connection to establish
    await store.batchWaitForConnection(tab.id)

    return {
      success: true,
      action: 'connect',
      host: p.host,
      port: p.port,
      tabId: tab.id
    }
  }

  // Wait for SSH connection to be ready
  Store.prototype.batchWaitForConnection = async function (tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.refWait) {
          this.refWait.stop()
          delete this.refWait
        }
        reject(new Error('Connection timeout'))
      }, 30000)

      this.refWait = autoRun(() => {
        const { tabs } = window.store
        const tab = tabs.find(t => t.id === tabId)
        if (tab && tab.status === statusMap.success) {
          clearTimeout(timeout)
          this.refWait && this.refWait.stop()
          delete this.refWait
          resolve(tab)
        } else if (tab && tab.status === statusMap.error) {
          clearTimeout(timeout)
          this.refWait && this.refWait.stop()
          delete this.refWait
          reject(new Error('Connection failed: ' + (tab.errorMsg || 'unknown error')))
        }
        return window.store.tabs
      })
      this.refWait.start()
    })
  }

  // Run command in terminal
  Store.prototype.batchStepCommand = async function (step, previousResults) {
    const { store } = window
    const tabId = step.tabId || store.activeTabId

    if (!tabId) {
      throw new Error('No active tab. Please connect first.')
    }

    const term = refs.get('term-' + tabId)
    if (!term || !term.term) {
      throw new Error('Terminal not found')
    }

    // Wait for attachAddon to be ready (initialized asynchronously after connect)
    let waited = 0
    while (!term.attachAddon && waited < 10000) {
      await new Promise(resolve => setTimeout(resolve, 200))
      waited += 200
    }
    if (!term.attachAddon) {
      throw new Error('Terminal not ready: attach addon not initialized')
    }

    // Send command
    term.runQuickCommand(step.command)

    return {
      success: true,
      action: 'command',
      command: step.command,
      tabId
    }
  }

  // Wait for a transfer to finish by watching transferHistory with autoRun
  Store.prototype.batchWaitForTransfer = function (transferId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this._refTransferWait) {
          this._refTransferWait.stop()
          delete this._refTransferWait
        }
        reject(new Error('Transfer timeout (1 hour)'))
      }, 60 * 60 * 1000)

      this._refTransferWait = autoRun(() => {
        const { transferHistory } = window.store
        const item = transferHistory.find(t => t.id === transferId || t.originalId === transferId)
        if (item) {
          clearTimeout(timeout)
          this._refTransferWait && this._refTransferWait.stop()
          delete this._refTransferWait
          if (item.error) {
            reject(new Error('Transfer failed: ' + item.error))
          } else {
            resolve(item)
          }
        }
        return transferHistory
      })
      this._refTransferWait.start()
    })
  }

  // SFTP upload — delegates to mcpSftpUpload (handles getLocalFileInfo enrichment)
  Store.prototype.batchStepSftpUpload = async function (step) {
    const { store } = window
    const { transferId, tabId } = await store.mcpSftpUpload(step)
    await store.batchWaitForTransfer(transferId)
    return { success: true, action: 'sftp_upload', localPath: step.localPath, remotePath: step.remotePath, transferId, tabId }
  }

  // SFTP download — delegates to mcpSftpDownload (handles getRemoteFileInfo enrichment)
  Store.prototype.batchStepSftpDownload = async function (step) {
    const { store } = window
    const { transferId, tabId } = await store.mcpSftpDownload(step)
    await store.batchWaitForTransfer(transferId)
    return { success: true, action: 'sftp_download', remotePath: step.remotePath, localPath: step.localPath, transferId, tabId }
  }

  // Zmodem upload — delegates to mcpZmodemUpload (same field names)
  Store.prototype.batchStepZmodemUpload = async function (step) {
    return window.store.mcpZmodemUpload(step)
  }

  // Zmodem download — delegates to mcpZmodemDownload (same field names)
  Store.prototype.batchStepZmodemDownload = async function (step) {
    return window.store.mcpZmodemDownload(step)
  }
}
