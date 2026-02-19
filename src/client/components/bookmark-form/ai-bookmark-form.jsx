/**
 * AI-powered bookmark generation form
 */
import { useState } from 'react'
import { Button, Input, Modal, message } from 'antd'
import {
  RobotOutlined,
  LoadingOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { connectionMap } from '../../common/constants'

const { TextArea } = Input
const e = window.translate

// Bookmark schema for AI to understand the format
const bookmarkSchema = {
  ssh: {
    type: 'ssh',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 22) - SSH port',
    username: 'string (required) - SSH username',
    password: 'string - password for authentication',
    privateKey: 'string - path to private key file for key-based auth',
    passphrase: 'string - passphrase for private key',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    authType: 'string - "password" or "privateKey"',
    startDirectory: 'string - remote starting directory',
    startDirectoryLocal: 'string - local starting directory'
  },
  telnet: {
    type: 'telnet',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 23) - Telnet port',
    username: 'string - username',
    password: 'string - password',
    title: 'string - bookmark title',
    description: 'string - bookmark description'
  },
  serial: {
    type: 'serial',
    port: 'string (required) - serial port path, e.g., /dev/ttyUSB0 or COM1',
    baudRate: 'number (default: 9600) - baud rate',
    dataBits: 'number (default: 8) - data bits',
    stopBits: 'number (default: 1) - stop bits',
    parity: 'string - "none", "even", "odd", "mark", "space"',
    title: 'string - bookmark title',
    description: 'string - bookmark description'
  },
  vnc: {
    type: 'vnc',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 5900) - VNC port',
    password: 'string - VNC password',
    title: 'string - bookmark title',
    description: 'string - bookmark description'
  },
  rdp: {
    type: 'rdp',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 3389) - RDP port',
    username: 'string - username',
    password: 'string - password',
    title: 'string - bookmark title',
    description: 'string - bookmark description'
  },
  ftp: {
    type: 'ftp',
    host: 'string (required) - hostname or IP address',
    port: 'number (default: 21) - FTP port',
    username: 'string - username',
    password: 'string - password',
    title: 'string - bookmark title',
    description: 'string - bookmark description'
  },
  web: {
    type: 'web',
    url: 'string (required) - website URL',
    title: 'string - bookmark title',
    description: 'string - bookmark description'
  },
  local: {
    type: 'local',
    title: 'string - bookmark title',
    description: 'string - bookmark description',
    startDirectoryLocal: 'string - local starting directory'
  }
}

function buildPrompt (description) {
  const lang = window.store.getLangName()
  const schemaDescription = Object.entries(bookmarkSchema)
    .map(([type, fields]) => {
      const fieldList = Object.entries(fields)
        .map(([key, desc]) => `    ${key}: ${desc}`)
        .join('\n')
      return `  ${type}:\n${fieldList}`
    })
    .join('\n\n')

  return `You are a bookmark configuration generator. Based on the user's natural language description, generate a bookmark configuration in JSON format.

Available bookmark types and their fields:
${schemaDescription}

Important rules:
1. Analyze the user's description to determine the most appropriate connection type
2. For SSH connections, use type "ssh" and default port 22 unless specified
3. For Telnet connections, use type "telnet" and default port 23 unless specified
4. For VNC connections, use type "vnc" and default port 5900 unless specified
5. For RDP connections, use type "rdp" and default port 3389 unless specified
6. For FTP connections, use type "ftp" and default port 21 unless specified
7. For Serial connections, use type "serial"
8. For Web/Browser connections, use type "web" with a URL field
9. For Local terminal, use type "local"
10. Only include fields that are relevant to the connection type
11. Always include a meaningful title if not specified
12. Respond ONLY with valid JSON, no markdown formatting or explanations
13. Reply in ${lang} language

User description: ${description}

Generate the bookmark JSON:`
}

export default function AIBookmarkForm (props) {
  const { onGenerated, onCancel } = props
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedData, setGeneratedData] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleGenerate = async () => {
    if (window.store.aiConfigMissing()) {
      window.store.toggleAIConfig()
      return
    }

    if (!description.trim()) {
      return message.warning(e('description') + ' required')
    }

    setLoading(true)

    try {
      const config = window.store.config
      const prompt = buildPrompt(description)

      const aiResponse = await window.pre.runGlobalAsync(
        'AIchat',
        prompt,
        config.modelAI,
        'You are a helpful assistant that generates bookmark configurations in JSON format.',
        config.baseURLAI,
        config.apiPathAI,
        config.apiKeyAI,
        config.proxyAI,
        false // Disable streaming for structured response
      )

      if (aiResponse && aiResponse.error) {
        throw new Error(aiResponse.error)
      }

      let bookmarkData
      if (aiResponse && aiResponse.response) {
        // Parse the JSON response
        let jsonStr = aiResponse.response.trim()
        // Remove markdown code blocks if present
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.slice(7)
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.slice(3)
        }
        if (jsonStr.endsWith('```')) {
          jsonStr = jsonStr.slice(0, -3)
        }
        jsonStr = jsonStr.trim()

        bookmarkData = JSON.parse(jsonStr)

        // Validate and set defaults
        if (!bookmarkData.type) {
          bookmarkData.type = connectionMap.ssh
        }

        // Ensure required fields have defaults
        if (bookmarkData.type === connectionMap.ssh && !bookmarkData.port) {
          bookmarkData.port = 22
        }

        setGeneratedData(bookmarkData)
        setShowConfirm(true)
      }
    } catch (error) {
      console.error('AI bookmark generation error:', error)
      message.error(e('aiGenerateError') || 'AI generation failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (onGenerated && generatedData) {
      onGenerated(generatedData)
    }
    setShowConfirm(false)
    setDescription('')
    setGeneratedData(null)
  }

  const handleCancelConfirm = () => {
    setShowConfirm(false)
  }

  const handleCancel = () => {
    setDescription('')
    setGeneratedData(null)
    if (onCancel) {
      onCancel()
    }
  }

  return (
    <div className='ai-bookmark-form pd2'>
      <div className='pd1b'>
        <RobotOutlined className='mg1r' />
        <span>{e('createBookmarkByAI') || 'Create Bookmark by AI'}</span>
      </div>
      <div className='pd1b'>
        <TextArea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={e('aiBookmarkPlaceholder') || 'Describe your bookmark in natural language, e.g., "SSH connection to my server at 192.168.1.100 with username admin"'}
          autoSize={{ minRows: 4, maxRows: 8 }}
          disabled={loading}
        />
      </div>
      <div className='pd1t'>
        <Button
          type='primary'
          onClick={handleGenerate}
          disabled={!description.trim()}
          icon={loading ? <LoadingOutlined /> : <RobotOutlined />}
          loading={loading}
        >
          {e('generate') || 'Generate'}
        </Button>
        <Button
          className='mg1l'
          onClick={handleCancel}
        >
          {e('cancel')}
        </Button>
      </div>

      <Modal
        title={e('confirmBookmarkData') || 'Confirm Bookmark Data'}
        open={showConfirm}
        onCancel={handleCancelConfirm}
        footer={[
          <Button key='cancel' onClick={handleCancelConfirm}>
            <CloseOutlined /> {e('cancel')}
          </Button>,
          <Button key='confirm' type='primary' onClick={handleConfirm}>
            <CheckOutlined /> {e('confirm')}
          </Button>
        ]}
        width={600}
      >
        <div className='pd1b'>
          {e('aiGeneratedBookmarkDesc') || 'AI has generated the following bookmark data. Please review and confirm:'}
        </div>
        <pre className='ai-bookmark-json-preview'>
          {generatedData ? JSON.stringify(generatedData, null, 2) : ''}
        </pre>
      </Modal>
    </div>
  )
}
