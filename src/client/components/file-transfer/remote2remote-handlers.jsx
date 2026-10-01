import { Component } from 'react'
import safeJoin from '../../common/safe-join'
import { typeMap } from '../../common/constants'
import { refsStatic } from '../common/ref'
import Remote2RemoteHandler from './remote2remote-handler'

const handlerRefId = 'remote2remote-handlers'

export default class Remote2RemoteHandlers extends Component {
  constructor (props) {
    super(props)
    this.handlers = new Map()
  }

  componentDidMount () {
    refsStatic.add(handlerRefId, this)
  }

  componentWillUnmount () {
    refsStatic.remove(handlerRefId)
    this.handlers.forEach(handler => {
      handler.stop()
    })
    this.handlers.clear()
  }

  canHandle = ({ fromFile, targetHost }) => {
    return fromFile?.type === typeMap.remote &&
      fromFile?.host &&
      targetHost &&
      fromFile.host !== targetHost &&
      fromFile?.tabId
  }

  createHandler = ({ fromFile, targetPathBase, targetTab }) => {
    const handler = new Remote2RemoteHandler({
      fromFile,
      // `fromFile.name` comes straight off the source server's READDIR, so it
      // is attacker-controlled. It is written to the target host as the victim
      // below, so it must not be able to leave `targetPathBase`.
      toPath: safeJoin(targetPathBase, fromFile.name),
      sourceHost: fromFile.host,
      sourceTabId: fromFile.tabId,
      title: fromFile.title,
      tabType: fromFile.tabType,
      targetHost: targetTab.host,
      targetTabId: targetTab.id,
      targetTitle: targetTab.title || targetTab.host,
      targetTabType: targetTab.type,
      onDone: this.onDone
    })
    this.handlers.set(handler.id, handler)
    handler.start()
  }

  onDone = ({ id, error }) => {
    this.handlers.delete(id)
    if (error) {
      window.store.onError(new Error(error))
    }
  }

  onRemote2RemoteDrop = ({ fromFiles, toFile, targetTab }) => {
    // `toFile.name` is an entry from the target panel's listing. The victim
    // chose the panel, but the name is still server-supplied.
    const targetPathBase = safeJoin(toFile.path, toFile.name)
    const targetHost = targetTab?.host
    let handled = false
    for (const fromFile of fromFiles) {
      if (!this.canHandle({ fromFile, targetHost })) {
        continue
      }
      handled = true
      this.createHandler({
        fromFile,
        targetPathBase,
        targetTab
      })
    }
    return handled
  }

  render () {
    return null
  }
}
