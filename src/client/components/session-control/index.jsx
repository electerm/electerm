/**
 * when exit not normally,
 * show last sessions for user to recover
 */

import { memo } from 'react'
import { Modal, Button, Checkbox } from 'antd'
import copy from 'json-deep-copy'
import _ from 'lodash'
import createName from '../../common/create-title'

const { prefix } = window
const c = prefix('common')

export default memo(props => {
  const {
    sessionModalVisible,
    storeAssign,
    addTab,
    selectedSessions
  } = props

  if (!sessionModalVisible) {
    return null
  }

  const onConfirmLoadSession = () => {
    storeAssign({
      sessionModalVisible: false,
      selectedSessions: []
    })
    const saved = copy(
      selectedSessions
        .filter(s => s.checked)
    )
      .map(s => s.tab)
    for (const s of saved) {
      setTimeout(() => {
        addTab(s)
      }, 100)
    }
    window.pre.runGlobalAsync('setExitStatus', 'ok')
  }

  const onCancelLoadSession = () => {
    storeAssign({
      sessionModalVisible: false
    })
    window.pre.runGlobalAsync('setExitStatus', 'ok')
  }

  const toggoleSelection = (e, id) => {
    const { checked } = e.target
    const ss = copy(selectedSessions)
    const s = _.find(ss, s => s.id === id)
    s.checked = checked
    storeAssign({
      selectedSessions: ss
    })
  }

  const content = (
    <div>
      {
        selectedSessions.map(s => {
          const { id, tab, checked } = s
          const title = createName(tab)
          return (
            <div key={id}>
              <Checkbox
                onChange={v => toggoleSelection(v, id)}
                checked={checked}
              >
                {title}
              </Checkbox>
            </div>
          )
        })
      }
    </div>
  )
  const footer = (
    <div>
      <Button
        type='primary'
        disabled={!selectedSessions.filter(s => s.checked).length}
        onClick={onConfirmLoadSession}
        className='mg1r'
      >
        {c('ok')}
      </Button>
      <Button
        disabled={!selectedSessions.length}
        onClick={onCancelLoadSession}
      >
        {c('cancel')}
      </Button>
    </div>
  )
  return (
    <Modal
      width={500}
      maskClosable={false}
      closable={false}
      title={c('restoreSessions')}
      visible={sessionModalVisible}
      footer={footer}
    >
      {content}
    </Modal>
  )
})
