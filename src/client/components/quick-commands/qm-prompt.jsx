/**
 * asks for the value of a prompt step while a quick command runs. The
 * answer goes to the terminal and is not saved. Run in several terminals,
 * "send to all terminals" picks one dialog for all of them or one each.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { auto } from 'manate/react'
import { Input, Button, Checkbox } from 'antd'
import Modal from '../common/modal'

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
        {
          prompt.tabTitle
            ? <div className='pd1b qm-prompt-tab'>{prompt.tabTitle}</div>
            : null
        }
        <div className='pd1b'>
          {prompt.label || e('askForInput')}
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
        <div className='pd1t qm-prompt-footer'>
          {
            prompt.multi
              ? (
                <Checkbox
                  checked={prompt.shared}
                  onChange={ev => window.store.setQmPromptShared(prompt.id, ev.target.checked)}
                  className='qm-prompt-shared'
                >
                  {e('broadcastInput')}
                </Checkbox>
                )
              : null
          }
          <Button
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
  // one at a time: with a question per terminal they queue up here
  const prompt = store.qmPrompts[0]
  if (!prompt) {
    return null
  }
  // a new form for each question, so no answer carries over. The footer
  // has its own z-index, so render in the body to show above settings.
  return createPortal(
    <PromptForm key={prompt.id} prompt={prompt} />,
    document.body
  )
})
