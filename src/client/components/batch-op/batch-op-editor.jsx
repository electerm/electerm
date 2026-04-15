/**
 * Batch Operation Editor Component
 * Self-contained workflow editor: handles execute, external editors, and progress logs
 */
import React, { useCallback, useState, useEffect } from 'react'
import { Button, Flex, message } from 'antd'
import {
  PlayCircleOutlined
} from '@ant-design/icons'
import SimpleEditor from '../text-editor/simple-editor'
import EditWithCustomEditor from '../text-editor/edit-with-custom-editor'
import BatchOpAlert from './batch-op-alert'
import BatchOpLogs from './batch-op-logs'
import { refsStatic } from '../common/ref'
import generate from '../../common/uid'
import fs from '../../common/fs'

const workflowExample = `[
  {
    "name": "Connect SSH",
    "action": "connect",
    "params": {
      "host": "192.168.1.100",
      "port": 22,
      "username": "root",
      "authType": "password",
      "password": "your_password",
      "enableSftp": true
    }
  },
  {
    "name": "Create test file",
    "action": "command",
    "afterDelay": 500,
    "params": {
      "command": "echo 'hello batch-op' > /tmp/batch_test.txt && echo '[LOG] File created'"
    }
  },
  {
    "name": "Download test file",
    "action": "sftp_download",
    "afterDelay": 200,
    "params": {
      "remotePath": "/tmp/batch_test.txt",
      "localPath": "/tmp/batch_test_local.txt"
    }
  },
  {
    "name": "Upload file back",
    "action": "sftp_upload",
    "afterDelay": 200,
    "params": {
      "localPath": "/tmp/batch_test_local.txt",
      "remotePath": "/tmp/batch_test_uploaded.txt"
    }
  },
  {
    "name": "Verify and clean up",
    "action": "command",
    "params": {
      "command": "ls -la /tmp/batch_test*.txt && rm -f /tmp/batch_test*.txt && echo '[LOG] Done'"
    }
  }
]`

function getDefaultValue (widget) {
  if (widget?.info?.configs) {
    const config = widget.info.configs.find(c => c.name === 'workflowJson')
    if (config?.default) return config.default
  }
  return ''
}

export default function BatchOpEditor ({ widget }) {
  const [value, setValue] = useState(() => getDefaultValue(widget))
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    const v = getDefaultValue(widget)
    if (v) setValue(v)
  }, [widget?.id])

  const handleExecute = async () => {
    if (!value || executing) return
    setExecuting(true)
    refsStatic.get('batch-op-logs')?.setLogs({ steps: [], currentIndex: 0, status: 'running' })
    try {
      let workflows
      try {
        workflows = JSON.parse(value)
        if (!Array.isArray(workflows)) throw new Error('Workflow must be an array')
      } catch (e) {
        message.error('Invalid workflow JSON: ' + e.message)
        refsStatic.get('batch-op-logs')?.reset()
        return
      }
      let current = { steps: [], currentIndex: 0, status: 'running' }
      const results = []
      for (let i = 0; i < workflows.length; i++) {
        const step = workflows[i]
        current = { ...current, currentIndex: i, currentStep: step.name, status: 'running' }
        refsStatic.get('batch-op-logs')?.setLogs({ ...current })
        let result
        try {
          result = await window.store.executeBatchStep(step, results)
          current = { ...current, steps: [...current.steps, { name: step.name, status: 'success', result }] }
          refsStatic.get('batch-op-logs')?.setLogs({ ...current })
          results.push(result)
        } catch (e) {
          current = { ...current, steps: [...current.steps, { name: step.name, status: 'error', error: e.message }] }
          refsStatic.get('batch-op-logs')?.setLogs({ ...current })
          message.error(`Step "${step.name}" failed: ${e.message}`)
          break
        }
      }
      current = { ...current, status: 'completed', currentStep: null }
      refsStatic.get('batch-op-logs')?.setLogs({ ...current })
      message.success('Workflow execution completed')
    } catch (err) {
      message.error('Workflow execution failed: ' + err.message)
    } finally {
      setExecuting(false)
    }
  }

  const handleTemplate = useCallback(() => {
    setValue(workflowExample)
  }, [])

  const handleEditWithSystemEditor = useCallback(async () => {
    const id = generate()
    const tempPath = window.pre.resolve(window.pre.tempDir, `electerm-batch-op-${id}.json`)
    await fs.writeFile(tempPath, value)
    window.pre.runGlobalAsync('watchFile', tempPath)
    fs.openFile(tempPath).catch(window.store.onError)
    window.pre.showItemInFolder(tempPath)
    const onFileChange = (e, text) => {
      setValue(text)
      window.pre.ipcOffEvent('file-change', onFileChange)
      fs.unlink(tempPath).catch(console.log)
    }
    window.pre.ipcOnEvent('file-change', onFileChange)
  }, [value])

  const handleEditWithCustom = useCallback(async (editorCommand) => {
    const id = generate()
    const tempPath = window.pre.resolve(window.pre.tempDir, `electerm-batch-op-${id}.json`)
    await fs.writeFile(tempPath, value)
    window.pre.runGlobalAsync('watchFile', tempPath)
    await window.pre.runGlobalAsync('openFileWithEditor', tempPath, editorCommand)
    const onFileChange = (e, text) => {
      setValue(text)
      window.pre.ipcOffEvent('file-change', onFileChange)
      fs.unlink(tempPath).catch(console.log)
    }
    window.pre.ipcOnEvent('file-change', onFileChange)
  }, [value])

  function handleChange (e) {
    setValue(e.target.value)
  }

  return (
    <div className='batch-op-editor'>
      <BatchOpAlert />
      <Flex className='mg2y' gap='small'>
        <Button onClick={handleTemplate} type='dashed'>
          Load Template
        </Button>
        <Button
          onClick={handleExecute}
          type='primary'
          loading={executing}
          disabled={executing}
          icon={<PlayCircleOutlined />}
        >
          Execute Workflow
        </Button>
      </Flex>
      <SimpleEditor
        value={value}
        onChange={handleChange}
      />
      {!window.et.isWebApp && (
        <div className='pd1t pd2b'>
          <Button
            type='primary'
            className='mg1r mg1b'
            onClick={handleEditWithSystemEditor}
          >
            {window.translate('editWithSystemEditor')}
          </Button>
          <EditWithCustomEditor
            loading={executing}
            editWithCustom={handleEditWithCustom}
          />
        </div>
      )}
      <BatchOpLogs />
    </div>
  )
}
