/**
 * AI-powered bookmark generation form
 */
import { useState, useEffect } from 'react'
import { Button, Input, message, Space, Alert } from 'antd'
import {
  RobotOutlined,
  LoadingOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined
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
import AIBookmarkHistory, { addHistoryItem } from './ai-bookmark-history.jsx'
import { getItem, setItem } from '../../common/safe-local-storage'

const STORAGE_KEY_DESC = 'ai_bookmark_description'
const { TextArea } = Input
const e = window.translate

export default function AIBookmarkForm (props) {
  const { onCancel } = props
  const [description, setDescription] = useState(() => getItem(STORAGE_KEY_DESC) || '')
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editorText, setEditorText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('default')

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
        const pretty = JSON.stringify(bookmarkData, null, 2)
        setEditorText(pretty)
        // set default category when preview opens
        setSelectedCategory('default')
        setShowConfirm(true)
        addHistoryItem(description)
      }
    } catch (error) {
      console.error('AI bookmark generation error:', error)
      message.error(e('aiGenerateError') || 'AI generation failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  function getGeneratedData () {
    if (!editorText) return message.warning(e('noData') || 'No data')
    let parsed = null
    try {
      parsed = fixBookmarkData(JSON.parse(editorText))
    } catch (err) {
      return message.error(e('invalidJson') || 'Invalid JSON')
    }
    if (!parsed) return []
    return Array.isArray(parsed) ? parsed : [parsed]
  }

  const createBookmark = async (bm) => {
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
    if (!parsed.length) {
      return
    }
    for (const item of parsed) {
      // set defaults like mcpAddBookmark would
      await createBookmark(item)
    }
    setShowConfirm(false)
    setDescription('') // Clear description only on successful creation
    message.success(e('Done'))
  }

  const handleCancelConfirm = () => {
    setShowConfirm(false)
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  const handleToggleEdit = () => {
    setEditMode(!editMode)
  }

  const handleEditorChange = (e) => {
    // SimpleEditor passes event-like or value via onChange
    const val = e && e.target ? e.target.value : e
    setEditorText(val)
  }

  const handleCopy = () => {
    copy(editorText)
  }

  const handleSaveToFile = async () => {
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
        {...editorProps}
      />
    )
  }

  const renderPreview = () => {
    if (editMode) {
      return renderEditor()
    }
    return (
      <pre className='ai-bookmark-json-preview'>
        {editorText}
      </pre>
    )
  }

  const renderCategorySelect = () => {
    return (
      <AICategorySelect
        bookmarkGroups={window.store.bookmarkGroups}
        value={selectedCategory}
        onChange={setSelectedCategory}
      />
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

  const modalProps = {
    title: e('confirmBookmarkData') || 'Confirm Bookmark Data',
    open: showConfirm,
    onCancel: handleCancelConfirm,
    footer: (
      <div className='custom-modal-footer-buttons'>
        <Button onClick={handleCancelConfirm}>
          <CloseOutlined /> {e('cancel')}
        </Button>
        <Button type='primary' onClick={handleConfirm}>
          <CheckOutlined /> {e('confirm')}
        </Button>
      </div>
    ),
    width: '80%'
  }

  const editBtnProps = {
    icon: editMode ? <EyeOutlined /> : <EditOutlined />,
    title: editMode ? e('preview') : e('edit'),
    onClick: handleToggleEdit
  }

  const copyBtnProps = {
    icon: <CopyOutlined />,
    title: e('copy'),
    onClick: handleCopy
  }

  const downloadBtnProps = {
    icon: <DownloadOutlined />,
    title: e('download'),
    onClick: handleSaveToFile
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
      <AIBookmarkHistory onSelect={setDescription} />
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
        <div className='pd1y'>
          {renderCategorySelect()}
        </div>
        {renderPreview()}
      </Modal>
    </div>
  )
}
