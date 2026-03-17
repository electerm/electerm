import { LoadingOutlined } from '@ant-design/icons'

export default function AIStopIcon (props) {
  return (
    <div
      className='ai-stop-icon-square mg1l pointer'
      onClick={props.onClick}
      title={props.title || 'Stop AI request'}
    >
      <LoadingOutlined spin />
    </div>
  )
}
