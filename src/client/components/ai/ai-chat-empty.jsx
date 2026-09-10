import { logoPath3 } from '../../common/constants'
import { refsStatic } from '../common/ref'

const examples = [
  'Explain current terminal output',
  'Why did this command fail?',
  'Write a script to clean up old log files'
]

function useExample (text) {
  const inst = refsStatic.get('AIChat')
  if (inst) {
    inst.setPrompt(text)
  }
}

export default function AiChatEmpty () {
  return (
    <div className='ai-chat-empty'>
      <div className='ai-chat-empty-inner'>
        <div
          className='ai-chat-watermark'
          style={{ '--ai-watermark': `url(${logoPath3})` }}
        />
        <div className='ai-chat-empty-title'>Ask AI about your terminal</div>
        <div className='ai-chat-empty-hint'>
          Explain output, debug errors, or switch to Agent to let AI run commands
        </div>
        <div className='ai-chat-empty-examples'>
          {examples.map(t => (
            <div
              key={t}
              className='ai-chat-empty-example'
              onClick={() => useExample(t)}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
