import createTitle from '../../common/create-title'

export function createTransferProps (props) {
  return {
    title: createTitle(props.tab),
    tabId: props.tab.id,
    sessionId: props.sessionId
  }
}
