/**
 * Batch Operation Editor Component
 * Self-contained workflow editor: handles execute, external editors, and progress logs
 */
import React, { useCallback, useState, useEffect } from 'react'
import { Button, Flex } from 'antd'
import {
  PlayCircleOutlined
} from '@ant-design/icons'
import SimpleEditor from '../text-editor/simple-editor'
import EditWithCustomEditor from '../text-editor/edit-with-custom-editor'
import BatchOpAlert from './batch-op-alert'
import BatchOpLogs from './batch-op-logs'
import message from '../common/message'
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
      "password": "your_password"
    }
  },
  {
    "name": "Create 5M Test File",
    "action": "command",
    "afterDelay": 500,
    "prevDelay": 500,
    "command": "fallocate -l 5M /tmp/test_5m_file.bin && rm -f /tmp/test_log.log && echo '[LOG] Created 5M test file at $(date)' >> /tmp/test_log.log"
  },
  {
    "name": "Log creation",
    "action": "command",
    "command": "ls -la /tmp/test_5m_file.bin >> /tmp/test_log.log 2>&1 && echo '[LOG] File size logged at $(date)' >> /tmp/test_log.log"
  },
  {
    "name": "Download 5M File",
    "action": "sftp_download",
    "afterDelay": 200,
    "remotePath": "/tmp/test_5m_file.bin",
    "localPath": "/tmp/test_5m_file.bin"
  },
  {
    "name": "Log after download",
    "action": "command",
    "afterDelay": 200,
    "command": "echo '[LOG] Download complete at $(date)' >> /tmp/test_log.log"
  },
  {
    "name": "Delete Remote 5M File",
    "action": "command",
    "afterDelay": 200,
    "command": "rm /tmp/test_5m_file.bin && echo '[LOG] Deleted remote 5M file at $(date)' >> /tmp/test_log.log"
  },
  {
    "name": "Upload Downloaded File to Remote",
    "action": "sftp_upload",
    "afterDelay": 200,
    "localPath": "/tmp/test_5m_file.bin",
    "remotePath": "/tmp/test_5m_file_uploaded.bin"
  },
  {
    "name": "Log after upload",
    "action": "command",
    "afterDelay": 200,
    "command": "echo '[LOG] Upload complete at $(date)' >> /tmp/test_log.log"
  },
  {
    "name": "Verify and clean up",
    "action": "command",
    "command": "ls -la /tmp/test_5m_file_uploaded.bin >> /tmp/test_log.log 2>&1 && rm -f /tmp/test_5m_file*.bin && echo '[LOG] Cleaned up at $(date)' >> /tmp/test_log.log"
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
    const runner = refsStatic.get('batch-op-runner')
    runner?.reset()
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
      await runner.executeWorkflow(workflows)
      message.success('Workflow execution completed')
    } catch (err) {
      if (err.message !== 'Workflow aborted') {
        message.error('Workflow execution failed: ' + err.message)
      }
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
