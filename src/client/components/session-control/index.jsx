/**
 * when exit not normally,
 * show last sessions for user to recover
 */

import {Modal, Button, Checkbox} from 'antd'
import _ from 'lodash'

const {prefix} = window
const c = prefix('common')

export default (props) => {
  let {
    onConfirmLoadSession,
    onCancelLoadSession,
    sessionModalVisible,
    sessions,
    selectedSessions
  } = props

  if (!sessionModalVisible) {
    return null
  }

  let content = (
    <div>
      {
        sessions.map(s => {
          let {id} = s
          return (
            <div key={id}>
              <Checkbox
                onChange={this.onCheckAllChange}
                checked={this.state.checkAll}
              >
                Check all
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
        disabled={!selectedSessions.length}
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
      visible={sessionModalVisible}
      footer={footer}
    >
      <div>
        {content}
      </div>
    </Modal>
  )
}
