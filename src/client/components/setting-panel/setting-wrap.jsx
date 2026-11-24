/**
 * settings page
 */

import Drawer from '../common/drawer'
import { CloseOutlined } from '@ant-design/icons'
import './setting-wrap.styl'

export default function SettingWrap ({ visible, onCancel, children }) {
  const close = window.translate('close')
  return (
    <Drawer
      open={visible}
      onClose={onCancel}
      className='setting-wrap'
      size='100%'
      zIndex={888}
    >
      <button
        type='button'
        className='close-setting-wrap'
        aria-label={close}
        title={close}
        onClick={onCancel}
      >
        <CloseOutlined />
      </button>
      {children}
    </Drawer>
  )
}
