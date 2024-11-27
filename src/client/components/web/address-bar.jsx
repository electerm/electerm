import {
  Input,
  Tooltip
} from 'antd'
import { copy } from '../../common/clipboard'
import {
  ReloadOutlined,
  GlobalOutlined
} from '@ant-design/icons'

export default function AddressBar (props) {
  const {
    url,
    onReload,
    onOpen,
    title,
    description
  } = props
  const content = (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
  function handleClick () {
    copy(url)
  }
  return (
    <div className='web-address-bar pd1'>
      <Tooltip
        title={content}
      >
        <Input
          value={url}
          onClick={handleClick}
          addonBefore={
            <ReloadOutlined
              onClick={onReload}
            />
          }
          addonAfter={
            <GlobalOutlined
              onClick={onOpen}
            />
          }
        />
      </Tooltip>
    </div>
  )
}
