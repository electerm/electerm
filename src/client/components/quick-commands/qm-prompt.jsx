/**
 * asks for the value of a prompt step while a quick command runs. The
 * answer goes to the terminal and is not saved.
 */
import { useState } from 'react'
import { auto } from 'manate/react'
import { Input, Button } from 'antd'
import Modal from '../common/modal'
import translateOr from '../../common/translate-fallback'

const e = window.translate

function PromptForm ({ prompt }) {
  const [value, setValue] = useState('')
  const InputElem = prompt.hidden ? Input.Password : Input
  function handleSubmit () {
    window.store.answerQmPrompt(prompt.id, value)
  }
  function handleCancel () {
    window.store.answerQmPrompt(prompt.id, null)
  }
  return (
    <Modal
      open
      title={prompt.name}
      width={400}
      maskClosable={false}
      onCancel={handleCancel}
      footer={null}
    >
      <div className='pd1y'>
        <div className='pd1b'>
          {prompt.label || translateOr('enterValue', 'Enter a value')}
        </div>
        <InputElem
          value={value}
          onChange={ev => setValue(ev.target.value)}
          onPressEnter={handleSubmit}
          autoFocus
          spellCheck={false}
          autoComplete='off'
          className='qm-prompt-input'
        />
        <div className='pd1t alignright'>
          <Button
            className='mg1r'
            onClick={handleCancel}
          >
            {e('cancel')}
          </Button>
          <Button
            type='primary'
            onClick={handleSubmit}
          >
            {e('ok')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default auto(function QmPrompt ({ store }) {
  const prompt = store.qmPrompts[0]
  if (!prompt) {
    return null
  }
  // a new form for each question, so no answer carries over
  return <PromptForm key={prompt.id} prompt={prompt} />
})
