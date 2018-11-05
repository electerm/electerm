/**
 * when exit not normally,
 * show last sessions for user to recover
 */

import {memo} from 'react'
import {Modal, Button, Checkbox} from 'antd'
import copy from 'json-deep-copy'
import _ from 'lodash'
import createName from '../../common/create-title'

const {prefix} = window
const c = prefix('common')

export default memo(props => {
  let {
    sessionModalVisible,
    modifier,
    addTab,
    selectedSessions
  } = props

  if (!sessionModalVisible) {
    return null
  }

  let onConfirmLoadSession = () => {
    modifier({
      sessionModalVisible: false,
      selectedSessions: []
    })
    let saved = copy(
      selectedSessions
        .filter(s => s.checked)
    )
      .map(s => s.tab)
    for (let s of saved) {
      setTimeout(() => {
        addTab(s)
      }, 100)
    }
    window.getGlobal('setExitStatus')('ok')
  }

  let onCancelLoadSession = () => {
    modifier({
      sessionModalVisible: false
    })
    window.getGlobal('setExitStatus')('ok')
  }

  let toggoleSelection = (e, id) => {
    let {checked} = e.target
    let ss = copy(selectedSessions)
    let s = _.find(ss, s => s.id === id)
    s.checked = checked
    modifier({
      selectedSessions: ss
    })
  }

  let content = (
    <div>
      {
        selectedSessions.map(s => {
          let {id, tab, checked} = s
          let title = createName(tab)
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
  let footer = (
    <div>
      <Button
        type="primary"
        disabled={!selectedSessions.filter(s => s.checked).length}
        onClick={onConfirmLoadSession}
        className="mg1r"
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
