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
    const { action } = step

    if (!action) {
      throw new Error('Step must have an "action" field')
    }

    switch (action) {
      case 'connect':
        return store.batchStepConnect(step, previousResults)
      case 'command':
        return store.batchStepCommand(step, previousResults)
      case 'sftp_upload':
        return store.batchStepSftpUpload(step, previousResults)
      case 'sftp_download':
        return store.batchStepSftpDownload(step, previousResults)
      case 'zmodem_upload':
        return store.batchStepZmodemUpload(step, previousResults)
      case 'zmodem_download':
        return store.batchStepZmodemDownload(step, previousResults)
      case 'wait':
        return store.batchStepWait(step, previousResults)
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  // Connect to SSH host
  Store.prototype.batchStepConnect = async function (step) {
    const { store } = window

    // Create tab directly (without adding to bookmarks)
    const tab = {
      id: uid(),
      type: 'ssh',
      host: step.host || '',
      port: step.port || 22,
      username: step.username || '',
      password: step.password || '',
      privateKey: step.privateKey || '',
      passphrase: step.passphrase || '',
      certificate: step.certificate || '',
      authType: step.authType || 'password',
      profile: step.profile || '',
      enableSftp: step.enableSftp !== false,
      enableSsh: step.enableSsh !== false,
      useSshAgent: step.useSshAgent !== false,
      sshAgent: step.sshAgent || '',
      term: step.term || 'xterm-256color',
      encode: step.encode || 'utf8',
      envLang: step.envLang || 'en_US.UTF-8',
      setEnv: step.setEnv || '',
      startDirectoryRemote: step.startDirectoryRemote || '',
      startDirectoryLocal: step.startDirectoryLocal || '',
      proxy: step.proxy || '',
      x11: step.x11 || false,
      displayRaw: step.displayRaw || false,
      sshTunnels: step.sshTunnels || [],
      connectionHoppings: step.connectionHoppings || [],
      title: step.name || `SSH: ${step.host}`,
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
      host: step.host,
      port: step.port,
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

    // Send command
    term.runQuickCommand(step.command)

    // Wait if requested
    if (step.wait) {
      const waitTime = typeof step.wait === 'number' ? step.wait : 2000
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    return {
      success: true,
      action: 'command',
      command: step.command,
      tabId
    }
  }

  // SFTP upload
  Store.prototype.batchStepSftpUpload = async function (step, previousResults) {
    const { store } = window
    const tabId = step.tabId || store.activeTabId

    if (!tabId) {
      throw new Error('No active tab. Please connect first.')
    }

    // Get tab info
    const tab = store.tabs.find(t => t.id === tabId)
    if (!tab) {
      throw new Error('Tab not found')
    }

    // Create transfer item
    const transferItem = {
      host: tab.host,
      tabType: tab.type || 'ssh',
      typeFrom: 'local',
      typeTo: 'remote',
      fromPath: step.localPath,
      toPath: step.remotePath,
      fromFile: {
        host: tab.host,
        tabType: tab.type || 'ssh',
        tabId,
        title: tab.title
      },
      id: uid(),
      title: tab.title,
      tabId,
      operation: ''
    }

    store.addTransferList([transferItem])

    return {
      success: true,
      action: 'sftp_upload',
      localPath: step.localPath,
      remotePath: step.remotePath,
      transferId: transferItem.id,
      tabId
    }
  }

  // SFTP download
  Store.prototype.batchStepSftpDownload = async function (step, previousResults) {
    const { store } = window
    const tabId = step.tabId || store.activeTabId

    if (!tabId) {
      throw new Error('No active tab. Please connect first.')
    }

    // Get tab info
    const tab = store.tabs.find(t => t.id === tabId)
    if (!tab) {
      throw new Error('Tab not found')
    }

    // Get SFTP ref
    const sftpEntry = refs.get('sftp-' + tabId)
    if (!sftpEntry || !sftpEntry.sftp) {
      throw new Error('SFTP not initialized. Please open SFTP panel first.')
    }

    // Create transfer item
    const transferItem = {
      host: tab.host,
      tabType: tab.type || 'ssh',
      typeFrom: 'remote',
      typeTo: 'local',
      fromPath: step.remotePath,
      toPath: step.localPath,
      fromFile: {
        host: tab.host,
        tabType: tab.type || 'ssh',
        tabId,
        title: tab.title
      },
      id: uid(),
      title: tab.title,
      tabId
    }

    store.addTransferList([transferItem])

    return {
      success: true,
      action: 'sftp_download',
      remotePath: step.remotePath,
      localPath: step.localPath,
      transferId: transferItem.id,
      tabId
    }
  }

  // Zmodem upload (trzsz/rzsz)
  Store.prototype.batchStepZmodemUpload = async function (step, previousResults) {
    const { store } = window
    const tabId = step.tabId || store.activeTabId

    if (!tabId) {
      throw new Error('No active tab. Please connect first.')
    }

    const files = step.files || []
    if (!files.length) {
      throw new Error('No files specified for upload')
    }

    const protocol = step.protocol || 'rzsz'
    const uploadCmd = protocol === 'trzsz' ? 'trz' : 'rz'

    // Set the control variable to bypass native file dialog
    window._apiControlSelectFile = files

    const term = refs.get('term-' + tabId)
    if (!term) {
      throw new Error('Terminal not found')
    }
    term.runQuickCommand(uploadCmd)

    return {
      success: true,
      action: 'zmodem_upload',
      protocol,
      command: uploadCmd,
      files,
      tabId
    }
  }

  // Zmodem download (trzsz/rzsz)
  Store.prototype.batchStepZmodemDownload = async function (step, previousResults) {
    const { store } = window
    const tabId = step.tabId || store.activeTabId

    if (!tabId) {
      throw new Error('No active tab. Please connect first.')
    }

    const saveFolder = step.saveFolder
    if (!saveFolder) {
      throw new Error('saveFolder is required')
    }

    const remoteFiles = step.remoteFiles || []
    if (!remoteFiles.length) {
      throw new Error('No remote files specified')
    }

    const protocol = step.protocol || 'rzsz'
    const downloadCmd = protocol === 'trzsz' ? 'tsz' : 'sz'

    // Set the control variable to bypass native folder dialog
    window._apiControlSelectFolder = saveFolder

    const term = refs.get('term-' + tabId)
    if (!term) {
      throw new Error('Terminal not found')
    }
    const quotedFiles = remoteFiles.map(f => `"${f}"`).join(' ')
    term.runQuickCommand(`${downloadCmd} ${quotedFiles}`)

    return {
      success: true,
      action: 'zmodem_download',
      protocol,
      command: downloadCmd,
      remoteFiles,
      saveFolder,
      tabId
    }
  }

  // Wait step
  Store.prototype.batchStepWait = async function (step) {
    const duration = step.duration || 1000
    await new Promise(resolve => setTimeout(resolve, duration))
    return {
      success: true,
      action: 'wait',
      duration
    }
  }
}
