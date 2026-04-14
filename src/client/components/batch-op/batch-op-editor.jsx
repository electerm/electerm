/**
 * Batch Operation Editor Component
 * Provides JSON editing for workflow definitions with template support
 */
import React, { useState, useCallback } from 'react'
import { Button, Flex, Alert } from 'antd'
import {
  PlayCircleOutlined
} from '@ant-design/icons'
import SimpleEditor from '../text-editor/simple-editor'
import HelpIcon from '../common/help-icon'

const batchOpWikiLink = 'https://github.com/electerm/electerm/wiki/batch-operation'

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
    "command": "ls -la /tmp",
    "wait": true
  },
  {
    "name": "Step 3: Upload file",
    "action": "sftp_upload",
    "localPath": "/local/file.txt",
    "remotePath": "/remote/file.txt"
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

export default function BatchOpEditor ({ value, onChange, onExecute, executing }) {
  const [showTemplate, setShowTemplate] = useState(false)

  const handleTemplate = useCallback(() => {
    onChange(workflowExample)
  }, [onChange])

  const handleShowSshTemplate = useCallback(() => {
    setShowTemplate(true)
  }, [])

  function handleChange (e) {
    onChange(e.target.value)
  }

  function renderTemplateModal () {
    if (!showTemplate) {
      return null
    }
    return (
      <div className='batch-op-template-modal'>
        <div className='batch-op-template-content'>
          <div className='batch-op-template-header'>
            <h4>SSH Auth Template</h4>
            <Button onClick={() => setShowTemplate(false)}>Close</Button>
          </div>
          <SimpleEditor
            value={sshTemplate}
            onChange={() => {}}
          />
        </div>
      </div>
    )
  }

  return (
    <div className='batch-op-editor'>
      <Alert
        message={
          <span>
            Workflow JSON
            <HelpIcon link={batchOpWikiLink} />
          </span>
        }
        description='Define steps: connect, command, sftp_upload, sftp_download, zmodem_upload, zmodem_download'
        type='info'
        showIcon
        className='mg1b'
      />
      <Flex className='mg1b' gap='small'>
        <Button onClick={handleTemplate} type='dashed'>
          Load Template
        </Button>
        <Button onClick={handleShowSshTemplate} type='dashed'>
          SSH Auth Reference
        </Button>
        <Button
          onClick={onExecute}
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
      {renderTemplateModal()}
    </div>
  )
}
