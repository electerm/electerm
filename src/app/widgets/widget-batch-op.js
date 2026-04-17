/**
 * Batch Operation Widget
 * Allows users to define multi-step workflows in JSON format
 * Runs entirely in the frontend, uses MCP tools for execution
 */

const uid = require('../common/uid')

const widgetInfo = {
  name: 'Batch Operation',
  description: 'Define and execute multi-step SSH/SFTP workflows with progress tracking.',
  version: '1.0.0',
  type: 'frontend',
  builtin: true,
  singleInstance: false,
  configs: []
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
