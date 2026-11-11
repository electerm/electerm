import {
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { lazy, Suspense } from 'react'
import InputAutoFocus from '../common/input-auto-focus'
import { getRandomDefaultColor } from '../../common/rand-hex-color.js'
import { treeEditorRowHeight } from './tree-list-layout'

// antd ColorPicker (~52 kB minified) is only reachable from this inline row
// editor, which mounts when the user renames a bookmark. Keep it out of the
// startup bundle; the overlay renders nothing until then.
const AppearancePicker = lazy(() => import('../common/appearance-picker'))

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
  // the same appearance control as the bookmark form, driven by the editor
  // state here instead of an antd Form
  const appearancePicker = (
    <Suspense fallback={null}>
      <AppearancePicker
        color={editor.color || getRandomDefaultColor()}
        icon={editor.icon}
        onColorChange={editor.handleColorChange}
        onIconChange={editor.handleIconChange}
      />
    </Suspense>
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
        prefix={appearancePicker}
        suffix={confirm}
        selectall={editor.selectall}
      />
    </div>
  )
}
