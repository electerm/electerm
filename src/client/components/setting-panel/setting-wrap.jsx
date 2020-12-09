/**
 * settings page
 */

import { CloseCircleOutlined } from '@ant-design/icons'
import { sidebarWidth } from '../../common/constants'
import './setting-wrap.styl'

export default function SettingWrap (props) {
  const cls = props.visible
    ? 'setting-wrap'
    : 'setting-wrap setting-wrap-hide'
  const pops = {
    className: cls,
    style: {
      left: sidebarWidth + 'px'
    }
  }
  return (
    <div {...pops}>
      <CloseCircleOutlined
        className='close-setting-wrap'
        onClick={props.onCancel}
      />
      <div className='setting-wrap-content'>
        <div className='pd2b pd2x setting-wrap-inner'>
          {props.visible ? props.children : null}
        </div>
      </div>
    </div>
  )
}
