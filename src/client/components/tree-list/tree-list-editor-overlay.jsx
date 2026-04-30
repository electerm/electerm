import {
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import InputAutoFocus from '../common/input-auto-focus'
import { CategoryColorPicker } from './category-color-picker.jsx'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'
import { treeEditorRowHeight } from './tree-list-layout'

export default function TreeListEditorOverlay ({ editor }) {
  if (!editor) {
    return null
  }

  const confirm = (
    <span>
      <CheckOutlined className='pointer' onClick={editor.handleSubmit} />
      <CloseOutlined className='mg1l pointer' onClick={editor.handleCancel} />
    </span>
  )
  const colorPicker = (
    <CategoryColorPicker
      value={editor.color || getRandomDefaultColor()}
      onChange={editor.handleColorChange}
    />
  )

  return (
    <div
      className='tree-list-editor-overlay'
      style={{
        top: editor.top,
        left: editor.left,
        height: treeEditorRowHeight
      }}
    >
      <InputAutoFocus
        value={editor.title}
        onChange={editor.handleTitleChange}
        onPressEnter={editor.handleSubmit}
        prefix={colorPicker}
        suffix={confirm}
        selectall={editor.selectall}
      />
    </div>
  )
}
