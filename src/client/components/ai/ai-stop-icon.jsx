import { Loader2 } from 'lucide-react'

export default function AIStopIcon (props) {
  return (
    <div
      className='ai-stop-icon-square mg1l pointer'
      onClick={props.onClick}
      title={props.title || 'Stop AI request'}
    >
      <Loader2 spin />
    </div>
  )
}
