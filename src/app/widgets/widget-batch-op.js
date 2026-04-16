/**
 * Batch Operation Widget
 * Allows users to define multi-step workflows in JSON format
 * Runs entirely in the frontend, uses MCP tools for execution
 */

const uid = require('../common/uid')

const workflowTemplate = `[
  {
    "name": "Connect SSH",
    "action": "connect",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "authType": "password",
    "password": "your_password",
    "enableSftp": true
  },
  {
    "name": "Run Command",
    "action": "command",
    "command": "ls -la /tmp",
    "wait": true
  },
  {
    "name": "Upload File",
    "action": "sftp_upload",
    "localPath": "/local/path/file.txt",
    "remotePath": "/remote/path/file.txt"
  },
  {
    "name": "Download File",
    "action": "sftp_download",
    "remotePath": "/remote/path/result.log",
    "localPath": "/local/path/result.log"
  },
  {
    "name": "Run Command After Transfer",
    "action": "command",
    "command": "cat /remote/path/result.log",
    "wait": true
  }
]`

const widgetInfo = {
  name: 'Batch Operation',
  description: 'Define and execute multi-step SSH/SFTP workflows with progress tracking.',
  version: '1.0.0',
  author: 'electerm',
  type: 'frontend',
  builtin: true,
  singleInstance: false,
  configs: [
    {
      name: 'workflowJson',
      type: 'string',
      default: workflowTemplate,
      description: 'Workflow definition in JSON array format'
    }
  ]
}

function getDefaultConfig () {
  return widgetInfo.configs.reduce((acc, config) => {
    acc[config.name] = config.default
    return acc
  }, {})
}

async function widgetRun (config) {
  const instanceId = uid()
  return {
    instanceId,
    widgetId: 'batch-op',
    success: true,
    msg: 'Batch operation workflow started',
    serverInfo: null,
    config
  }
}

module.exports = {
  widgetInfo,
  getDefaultConfig,
  widgetRun
}
