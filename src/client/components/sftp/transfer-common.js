import { createTitleWithTag } from '../../common/create-title'

export function createTransferProps (props) {
  return {
    title: createTitleWithTag(props.tab),
    tabId: props.tab.id,
    sessionId: props.sessionId
  }
}
