import { notification } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { copy } from '../../common/clipboard'

export function showMsg (message, type = 'success', serverInfo = null, duration = 10, description = '') {
  const handleCopy = () => {
    if (serverInfo && serverInfo.url) {
      copy(serverInfo.url)
    }
  }

  let desc = description
  if (serverInfo) {
    desc = (
      <div>
        {description && <div>{description}</div>}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>URL: <b>{serverInfo.url}</b></span>
          <CopyOutlined
            className='pointer mg1l'
            onClick={handleCopy}
          />
        </div>
        <div>Path: <b>{serverInfo.path}</b></div>
      </div>
    )
  }

  notification[type]({
    message,
    description: desc,
    duration
  })
}
