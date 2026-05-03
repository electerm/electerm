import Modal from '../common/modal'
import { auto } from 'manate/react'
import AIConfigForm from './ai-config'
import message from '../common/message'
import { aiConfigsArr } from './ai-config-props'
import { pick } from 'lodash-es'

const e = window.translate

export default auto(function AIConfigModal ({ store }) {
  const { showAIConfigModal } = store

  if (!showAIConfigModal) {
    return null
  }

  function getInitialValues () {
    const res = pick(store.config, aiConfigsArr)
    if (!res.languageAI) {
      res.languageAI = window.store.getLangName()
    }
    return res
  }

  function handleSubmit (values) {
    window.store.updateConfig(values)
    message.success(e('saved') || 'Saved')
    window.store.showAIConfigModal = false
  }

  function handleClose () {
    window.store.showAIConfigModal = false
  }

  return (
    <Modal
      open={showAIConfigModal}
      onCancel={handleClose}
      footer={null}
      title='AI Config'
      width='80%'
      destroyOnClose
    >
      <AIConfigForm
        initialValues={getInitialValues()}
        onSubmit={handleSubmit}
        showAIConfig
      />
    </Modal>
  )
})
