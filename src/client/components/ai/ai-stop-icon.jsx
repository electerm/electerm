import { LoadingOutlined } from '@ant-design/icons'

export default function AIStopIcon ({ onClick, title }) {
  return (
    <button type='button' className='ai-stop-icon-square ai-transcript-button' onClick={onClick} title={title}>
      <LoadingOutlined /> {window.translate('stop')}
    </button>
  )
}
