import {
  Input,
  Tooltip,
  Dropdown,
  Space
} from 'antd'
import { copy } from '../../common/clipboard'
import {
  ReloadOutlined,
  GlobalOutlined,
  EllipsisOutlined
} from '@ant-design/icons'
import ZoomControl from '../common/zoom-control'

export default function AddressBar (props) {
  const {
    url,
    onReload,
    onOpen,
    title,
    description,
    zoom,
    onZoom
  } = props
  const content = (
    <>
      <h1>{title}</h1>
      <p>{description}</p>
    </>
  )
  function handleClick () {
    copy(url)
  }
  const items = [
    {
      key: 'zoom',
      label: (
        <div onClick={e => e.stopPropagation()}>
          <ZoomControl
            value={zoom}
            onChange={onZoom}
          />
        </div>
      )
    }
  ]
  return (
    <div className='web-address-bar pd1'>
      <Tooltip
        title={content}
      >
        <Input
          value={url}
          onClick={handleClick}
          prefix={
            <ReloadOutlined
              onClick={onReload}
            />
          }
          suffix={
            <Space>
              <GlobalOutlined
                className='pointer'
                onClick={onOpen}
                title={window.translate('openInDefaultBrowser')}
              />
              <Dropdown
                menu={{ items }}
                trigger={['click']}
              >
                <EllipsisOutlined className='pointer' />
              </Dropdown>
            </Space>
          }
        />
      </Tooltip>
    </div>
  )
}
