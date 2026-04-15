/**
 * Batch Operation Editor Component
 * Self-contained workflow editor: handles execute, external editors, and progress logs
 */
import React, { useCallback, useState, useEffect } from 'react'
import { Button, Flex, Alert, message } from 'antd'
import {
  PlayCircleOutlined
} from '@ant-design/icons'
import SimpleEditor from '../text-editor/simple-editor'
import EditWithCustomEditor from '../text-editor/edit-with-custom-editor'
import HelpIcon from '../common/help-icon'
import BatchOpLogs from './batch-op-logs'
import { refsStatic } from '../common/ref'
import generate from '../../common/uid'
import fs from '../../common/fs'

const sshTemplate = `{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "authType": "password|privateKey|profiles",
  "password": "string - password for authentication",
  "privateKey": "string - private key content or path",
  "passphrase": "string - passphrase for private key/certificate",
  "certificate": "string - certificate content",
  "profile": "string - profile id to reuse saved auth",
  "enableSftp": true,
  "enableSsh": true,
  "useSshAgent": true,
  "sshAgent": "string - ssh agent path",
  "term": "xterm-256color",
  "encode": "utf8",
  "envLang": "en_US.UTF-8",
  "setEnv": "KEY1=VALUE1 KEY2=VALUE2",
  "startDirectoryRemote": "string",
  "startDirectoryLocal": "string",
  "proxy": "socks5://...",
  "x11": false,
  "displayRaw": false,
  "color": "#000000",
  "sshTunnels": [
    {
      "sshTunnel": "forwardRemoteToLocal|forwardLocalToRemote|dynamicForward",
      "sshTunnelLocalHost": "string",
      "sshTunnelLocalPort": 0,
      "sshTunnelRemoteHost": "string",
      "sshTunnelRemotePort": 0,
      "name": "string"
    }
  ],
  "connectionHoppings": [
    {
      "host": "string",
      "port": 0,
      "username": "string",
      "password": "string",
      "privateKey": "string",
      "passphrase": "string",
      "certificate": "string",
      "authType": "string",
      "profile": "string"
    }
  ],
  "runScripts": [
    { "delay": 0, "script": "string" }
  ],
  "quickCommands": [
    { "name": "string", "command": "string" }
  ]
}`

const workflowExample = `[
  {
    "name": "Step 1: Connect to SSH",
    "action": "connect",
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "authType": "password",
    "password": "your_password",
    "enableSftp": true
  },
  {
    "name": "Step 2: Run command",
    "action": "command",
    "command": "ls -la /tmp"
  },
  {
    "name": "Step 3: Wait 2 seconds",
    "action": "delay",
    "duration": 2000
  },
  {
    "name": "Step 4: Download file",
    "action": "sftp_download",
    "remotePath": "/remote/result.log",
    "localPath": "/local/result.log"
  },
  {
    "name": "Step 5: Run command after transfer",
    "action": "command",
    "command": "cat /remote/result.log"
  }
]`

const batchOpWikiLink = 'https://github.com/electerm/electerm/wiki/batch-operation'

const stepsExample = `[
  { "action": "connect", "host": "...", "username": "...", "password": "..." },
  { "action": "command", "command": "ls -la" },
  { "action": "delay", "duration": 2000 },
  { "action": "sftp_upload", "localPath": "...", "remotePath": "..." },
  { "action": "sftp_download", "remotePath": "...", "localPath": "..." }
]`

const actionTypes = 'connect, command, sftp_upload, sftp_download, zmodem_upload, zmodem_download, delay'

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
  const [showFullAuth, setShowFullAuth] = useState(false)

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

  const title = (
    <>
      Workflow JSON
      <HelpIcon link={batchOpWikiLink} />
    </>
  )

  const authDesc = (
    <div>
      <div>Auth reference: <code>host, port, username, authType, password, privateKey, passphrase, certificate, profile</code></div>
      {!showFullAuth && (
        <Button onClick={() => setShowFullAuth(true)} className='mg1y'>Read more</Button>
      )}
      {showFullAuth && (
        <div className='mg1t'>
          <pre><code>{sshTemplate}</code></pre>
          <Button onClick={() => setShowFullAuth(false)} className='mg1y'>Show less</Button>
        </div>
      )}
    </div>
  )

  const desc = (
    <div>
      <div>Steps: <code>{actionTypes}</code></div>
      <div className='mg1t'>
        <pre><code>{stepsExample}</code></pre>
      </div>
      {authDesc}
    </div>
  )

  return (
    <div className='batch-op-editor'>
      <Alert
        title={title}
        description={desc}
        type='info'
        showIcon
        className='mg1b'
      />
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
