/**
 * AI-powered bookmark generation form
 */
import { useState, useEffect } from 'react'
import { Button, Input, Space, Alert, Progress } from 'antd'
import message from '../common/message'
import {
  RobotOutlined,
  LoadingOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import SimpleEditor from '../text-editor/simple-editor'
import { copy } from '../../common/clipboard'
import download from '../../common/download'
import AICategorySelect from './common/ai-category-select.jsx'
import HelpIcon from '../common/help-icon'
import Modal from '../common/modal.jsx'
import { buildPrompt } from './bookmark-schema.js'
import { fixBookmarkData } from './fix-bookmark-default.js'
import generate from '../../common/id-with-stamp'
import AiHistory, { addHistoryItem } from '../ai/ai-history.jsx'
import { getItem, setItem } from '../../common/safe-local-storage'

const STORAGE_KEY_DESC = 'ai_bookmark_description'
const STORAGE_KEY_HISTORY = 'ai_bookmark_history'
const EVENT_NAME_HISTORY = 'ai-bookmark-history-update'
const { TextArea } = Input
const e = window.translate

function yieldToUI () {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

export default function AIBookmarkForm (props) {
  const { onCancel } = props
  const [description, setDescription] = useState(() => getItem(STORAGE_KEY_DESC) || '')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editorText, setEditorText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('default')
  const [confirmProgress, setConfirmProgress] = useState(null)

  useEffect(() => {
    setItem(STORAGE_KEY_DESC, description)
  }, [description])

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
        // Normalize response payload to string before JSON extraction.
        const rawResponse = aiResponse.response
        let jsonStr = ''
        if (typeof rawResponse === 'string') {
          jsonStr = rawResponse
        } else if (typeof rawResponse === 'object') {
          jsonStr = JSON.stringify(rawResponse)
        } else {
          jsonStr = String(rawResponse)
        }
        // Parse the JSON response
        jsonStr = jsonStr.trim()
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

        bookmarkData = getGeneratedData(jsonStr)
        const pretty = JSON.stringify(bookmarkData, null, 2)
        setEditorText(pretty)
        // set default category when preview opens
        setSelectedCategory('default')
        setShowConfirm(true)
        addHistoryItem(STORAGE_KEY_HISTORY, description, EVENT_NAME_HISTORY)
      }
    } catch (error) {
      console.error('AI bookmark generation error:', error)
      message.error('Can not generate bookmarks from AI response: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function getGeneratedData (txt = editorText) {
    if (!txt) return []
    let parsed = null
    try {
      parsed = JSON.parse(txt)
    } catch (err) {
      return []
    }
    if (!parsed) return []
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr.map(d => fixBookmarkData(d))
  }

  const createBookmark = (bm) => {
    const { store } = window
    const { addItem } = store
    const fixedBm = fixBookmarkData(bm)
    if (!fixedBm.id) {
      fixedBm.id = generate()
    }
    if (fixedBm.connectionHoppings?.length) {
      fixedBm.hasHopping = true
    }

    // Add bookmark
    addItem(fixedBm, 'bookmarks')

    // Ensure the bookmark id is registered in its group
    try {
      const groupId = fixedBm.category || selectedCategory || 'default'
      const group = window.store.bookmarkGroups.find(g => g.id === groupId)
      if (group) {
        group.bookmarkIds = [
          ...new Set([...(group.bookmarkIds || []), fixedBm.id])
        ]
        fixedBm.color = group.color
      }
    } catch (err) {
      console.error('Failed to update bookmark group:', err)
    }
  }

  const handleConfirm = async () => {
    const parsed = getGeneratedData()
    if (!parsed.length || confirmProgress) {
      return
    }

    setConfirmProgress({ current: 0, total: parsed.length })

    try {
      for (let i = 0; i < parsed.length; i++) {
        // Yield between synchronous store mutations so large imports stay responsive.
        await yieldToUI()
        createBookmark(parsed[i])
        setConfirmProgress({ current: i + 1, total: parsed.length })
      }

      setShowConfirm(false)
      setDescription('') // Clear description only on successful creation
      message.success(e('Done'))
    } catch (error) {
      console.error('AI bookmark creation error:', error)
      message.error('Can not create bookmarks from AI response: ' + error.message)
    } finally {
      setConfirmProgress(null)
    }
  }

  const handleCancelConfirm = () => {
    if (confirmProgress) {
      return
    }
    setShowConfirm(false)
  }

  const handleQuickConnect = () => {
    const parsed = getGeneratedData()
    if (!parsed.length || !parsed[0]) {
      return
    }
    const bm = parsed[0]
    // Create a new tab with quick connect options
    const { store } = window

    // Close the setting panel first
    store.hideSettingModal()

    const tabOptions = {
      ...bm,
      from: 'quickConnect'
    }

    store.addTab(tabOptions)
    setShowConfirm(false)
    setDescription('')
    message.success(e('Done'))
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  const handleToggleEdit = () => {
    if (confirmProgress) {
      return
    }
    setEditMode(!editMode)
  }

  const handleEditorChange = (e) => {
    // SimpleEditor passes event-like or value via onChange
    const val = e && e.target ? e.target.value : e
    setEditorText(val)
  }

  const handleCopy = () => {
    if (confirmProgress) {
      return
    }
    copy(editorText)
  }

  const handleSaveToFile = async () => {
    if (confirmProgress) {
      return
    }
    const parsed = getGeneratedData()
    if (!parsed.length) {
      return
    }
    const date = new Date().toISOString().slice(0, 10)
    const fileName = `bookmarks-${date}.json`
    await download(fileName, editorText)
  }

  const renderEditor = () => {
    const editorProps = {
      value: editorText,
      onChange: handleEditorChange
    }
    return (
      <SimpleEditor
        key='editor'
        {...editorProps}
      />
    )
  }

  const renderPreview = () => {
    if (editMode) {
      return renderEditor()
    }
    return (
      <pre key='preview' className='ai-bookmark-json-preview'>
        {editorText}
      </pre>
    )
  }

  const renderCategorySelect = () => {
    return (
      <AICategorySelect
        bookmarkGroups={window.store.bookmarkGroups}
        value={selectedCategory}
        disabled={!!confirmProgress}
        onChange={setSelectedCategory}
      />
    )
  }

  const renderConfirmProgress = () => {
    if (!confirmProgress) {
      return null
    }
    const { current, total } = confirmProgress
    const percent = Math.floor(current * 100 / (total || 1))
    return (
      <div className='pd1y'>
        <Progress
          percent={percent}
          status='active'
          format={() => `${current}/${total}`}
        />
      </div>
    )
  }

  const textAreaProps = {
    value: description,
    onChange: e => setDescription(e.target.value),
    placeholder: e('createBookmarkByAI'),
    autoSize: { minRows: 4, maxRows: 8 },
    disabled: loading
  }

  const generateBtnProps = {
    type: 'primary',
    onClick: handleGenerate,
    disabled: !description.trim(),
    icon: loading ? <LoadingOutlined /> : <RobotOutlined />,
    loading
  }

  function renderQuickConnectBtn () {
    const parsed = getGeneratedData()
    if (!parsed.length || !parsed[0] || parsed.length > 1 || confirmProgress) {
      return null
    }
    return (
      <Button onClick={handleQuickConnect} icon={<ThunderboltOutlined />}>
        {e('quickConnect')}
      </Button>
    )
  }

  const modalProps = {
    title: e('bookmarks') + ' ' + e('preview'),
    open: showConfirm,
    onCancel: handleCancelConfirm,
    footer: (
      <div className='custom-modal-footer-buttons'>
        <Button onClick={handleCancelConfirm}>
          <CloseOutlined /> {e('cancel')}
        </Button>
        {renderQuickConnectBtn()}
        <Button
          type='primary'
          onClick={handleConfirm}
          loading={!!confirmProgress}
          disabled={!!confirmProgress}
        >
          <CheckOutlined /> {e('confirm')}
        </Button>
      </div>
    ),
    width: '80%'
  }

  const editBtnProps = {
    icon: editMode ? <EyeOutlined /> : <EditOutlined />,
    title: editMode ? e('preview') : e('edit'),
    onClick: handleToggleEdit,
    disabled: !!confirmProgress
  }

  const copyBtnProps = {
    icon: <CopyOutlined />,
    title: e('copy'),
    onClick: handleCopy,
    disabled: !!confirmProgress
  }

  const downloadBtnProps = {
    icon: <DownloadOutlined />,
    title: e('download'),
    onClick: handleSaveToFile,
    disabled: !!confirmProgress
  }

  const cancelProps = {
    onClick: handleCancel,
    title: e('cancel'),
    icon: <CloseOutlined />,
    className: 'mg1l'
  }

  return (
    <div className='ai-bookmark-form pd2'>
      <div className='pd1b ai-bookmark-header'>
        <span className='ai-title'>
          <RobotOutlined className='mg1r' />
          {e('createBookmarkByAI')}
        </span>
        <HelpIcon link='https://github.com/electerm/electerm/wiki/Create-bookmark-by-AI' />
      </div>
      <div className='pd1b'>
        <Alert
          type='info'
          showIcon
          title={e('aiSecurityNotice')}
        />
      </div>
      <div className='pd1b'>
        <TextArea {...textAreaProps} />
      </div>
      <AiHistory
        storageKey={STORAGE_KEY_HISTORY}
        eventName={EVENT_NAME_HISTORY}
        onSelect={setDescription}
      />
      <div className='pd1t'>
        <Button {...generateBtnProps}>
          {e('submit')}
        </Button>
        <Button {...cancelProps}>
          {e('cancel')}
        </Button>
      </div>

      <Modal {...modalProps}>
        <div className='pd1y'>
          <Space.Compact className='ai-action-buttons'>
            <Button {...editBtnProps} />
            <Button {...copyBtnProps} />
            <Button {...downloadBtnProps} />
          </Space.Compact>
        </div>
        {renderConfirmProgress()}
        <div className='pd1y'>
          {renderCategorySelect()}
        </div>
        {renderPreview()}
      </Modal>
    </div>
  )
}
