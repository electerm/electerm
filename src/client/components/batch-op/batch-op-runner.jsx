import { Component } from 'react'
import { refsStatic } from '../common/ref'
import { statusMap } from '../../common/constants'
import uid from '../../common/uid'

const STATIC_KEY = 'batch-op-runner'

export default class BatchOpRunner extends Component {
  constructor () {
    super()
    this.steps = []
    this.currentIndex = 0
    this.status = 'idle'
    this.currentTabId = null
    this.currentStep = null
  }

  componentDidMount () {
    refsStatic.add(STATIC_KEY, this)
  }

  getActiveTabId () {
    return window.store?.activeTabId
  }

  getState () {
    return {
      steps: this.steps,
      currentIndex: this.currentIndex,
      status: this.status,
      currentStep: this.currentStep
    }
  }

  reset () {
    this.steps = []
    this.currentIndex = 0
    this.status = 'idle'
    this.currentTabId = null
    this.currentStep = null
  }

  runBatchOpFromFile (filePath) {
    return this._runBatchOpFromFile(filePath)
  }

  executeWorkflow (workflows) {
    return this._executeWorkflow(workflows)
  }

  async _runBatchOpFromFile (filePath) {
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

      this.reset()
      await this._executeWorkflow(workflows)
      console.log('Batch operation completed from file')
    } catch (e) {
      console.error('Failed to run batch operation from file:', e.message)
    }
  }

  async _executeWorkflow (workflows) {
    if (!Array.isArray(workflows)) {
      throw new Error('Workflow must be an array')
    }

    this.steps = []
    this.currentIndex = 0
    this.status = 'running'

    const results = []
    const logsRef = refsStatic.get('batch-op-logs')

    for (let i = 0; i < workflows.length; i++) {
      const step = workflows[i]
      this.currentIndex = i
      this.currentStep = step.name

      logsRef?.setLogs(this.getState())

      let result
      try {
        result = await this._executeStep(step, results)
        this.steps.push({ name: step.name, status: 'success', result })
        results.push(result)
        console.log(`Batch op step ${i + 1} completed:`, step.name || 'unnamed')
      } catch (e) {
        this.steps.push({ name: step.name, status: 'error', error: e.message })
        logsRef?.setLogs(this.getState())
        console.error(`Batch op step ${i + 1} failed:`, step.name || 'unnamed', e.message)
        this.status = 'error'
        logsRef?.setLogs(this.getState())
        throw e
      }
    }

    this.status = 'completed'
    this.currentStep = null
    logsRef?.setLogs(this.getState())
  }

  async _executeStep (step, previousResults) {
    const { action, prevDelay, afterDelay } = step

    if (!action) {
      throw new Error('Step must have an "action" field')
    }

    if (prevDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, prevDelay))
    }

    const s = step.params ? { ...step, ...step.params } : step

    let result
    switch (action) {
      case 'connect':
        result = await this._batchStepConnect(s)
        this.currentTabId = result.tabId
        break
      case 'command':
        result = await this._batchStepCommand(s)
        break
      case 'sftp_upload':
        result = await this._batchStepSftpUpload(s)
        break
      case 'sftp_download':
        result = await this._batchStepSftpDownload(s)
        break
      case 'zmodem_upload':
        result = await this._batchStepZmodemUpload(s)
        break
      case 'zmodem_download':
        result = await this._batchStepZmodemDownload(s)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    if (afterDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, afterDelay))
    }

    return result
  }

  async _batchStepConnect (step) {
    const { store } = window
    const p = step.params || step

    const tabId = uid()
    const tab = {
      id: tabId,
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

    store.addTab(tab)
    await this._waitForConnection(tabId)

    return {
      success: true,
      action: 'connect',
      host: p.host,
      port: p.port,
      tabId
    }
  }

  async _waitForConnection (tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 30000)

      const checkConnection = () => {
        const { tabs } = window.store
        const tab = tabs.find(t => t.id === tabId)
        if (tab) {
          if (tab.status === statusMap.success) {
            clearTimeout(timeout)
            resolve(tab)
          } else if (tab.status === statusMap.error) {
            clearTimeout(timeout)
            reject(new Error('Connection failed: ' + (tab.errorMsg || 'unknown error')))
          } else {
            setTimeout(checkConnection, 200)
          }
        } else {
          setTimeout(checkConnection, 200)
        }
      }
      checkConnection()
    })
  }

  async _batchStepCommand (step) {
    const tabId = this.currentTabId || this.getActiveTabId?.()

    if (!tabId) {
      throw new Error('No active tab. Please connect first.')
    }

    const { refs } = await import('../common/ref')
    const term = refs.get('term-' + tabId)
    if (!term || !term.term) {
      throw new Error('Terminal not found')
    }

    let waited = 0
    while (!term.attachAddon && waited < 10000) {
      await new Promise(resolve => setTimeout(resolve, 200))
      waited += 200
    }
    if (!term.attachAddon) {
      throw new Error('Terminal not ready: attach addon not initialized')
    }

    term.runQuickCommand(step.command)

    return {
      success: true,
      action: 'command',
      command: step.command,
      tabId
    }
  }

  async _batchStepSftpUpload (step) {
    const tabId = this.currentTabId || this.getActiveTabId?.()
    const { store } = window
    const stepWithTabId = { ...step, tabId }
    const { transferId } = await store.mcpSftpUpload(stepWithTabId)
    await this._batchWaitForTransfer(transferId)
    return { success: true, action: 'sftp_upload', localPath: step.localPath, remotePath: step.remotePath, transferId, tabId }
  }

  async _batchStepSftpDownload (step) {
    const tabId = this.currentTabId || this.getActiveTabId?.()
    const { store } = window
    const stepWithTabId = { ...step, tabId }
    const { transferId } = await store.mcpSftpDownload(stepWithTabId)
    await this._batchWaitForTransfer(transferId)
    return { success: true, action: 'sftp_download', remotePath: step.remotePath, localPath: step.localPath, transferId, tabId }
  }

  async _batchStepZmodemUpload (step) {
    const tabId = this.currentTabId || this.getActiveTabId?.()
    const stepWithTabId = { ...step, tabId }
    return window.store.mcpZmodemUpload(stepWithTabId)
  }

  async _batchStepZmodemDownload (step) {
    const tabId = this.currentTabId || this.getActiveTabId?.()
    const stepWithTabId = { ...step, tabId }
    return window.store.mcpZmodemDownload(stepWithTabId)
  }

  async _batchWaitForTransfer (transferId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Transfer timeout (1 hour)'))
      }, 60 * 60 * 1000)

      const checkTransfer = () => {
        const { transferHistory } = window.store
        const item = transferHistory.find(t => t.id === transferId || t.originalId === transferId)
        if (item) {
          clearTimeout(timeout)
          if (item.error) {
            reject(new Error('Transfer failed: ' + item.error))
          } else {
            resolve(item)
          }
        } else {
          setTimeout(checkTransfer, 200)
        }
      }
      checkTransfer()
    })
  }

  render () {
    return null
  }
}
