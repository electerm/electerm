import { Select } from 'antd'
import { auto } from 'manate/react'
import { getAIConfigName, getAIConfigsLabel } from '../../common/ai-feature'
import './ai-config.styl'

export default auto(function ActiveAIConfigSelect (props) {
  const { store } = window
  const label = getAIConfigsLabel()
  const options = store.aiConfigs.map(config => ({
    value: config.id,
    label: getAIConfigName(config)
  }))

  return (
    <Select
      {...props}
      aria-label={label}
      placeholder={label}
      classNames={{ root: 'ai-config-select', popup: { root: 'ai-chat-config-popup' } }}
      value={store.activeAIConfig?.id}
      options={options}
      disabled={!options.length}
      onChange={id => store.applyAIConfig(id)}
      popupMatchSelectWidth={false}
      popupAlign={{ overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true } }}
    />
  )
})
