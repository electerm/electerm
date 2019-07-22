/**
 * file operation: cp/mv
 */
import React from 'react'
import _ from 'lodash'
import fs from '../../common/fs'
import { typeMap } from '../../common/constants'
import wait from '../../common/wait'

export default class Transports extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      currentTransport: props.transports[0] || null,
      showList: false
    }
  }

  componentWillMount () {
    this.mvOrCp()
  }

  componentDidUpdate (prevProps) {
    if (
      !_.isEqual(this.props.transports, prevProps.transports)
    ) {
      this.mvOrCp()
    }
  }

  funcMap = {
    copy: 'cp',
    mv: 'mv'
  }

  mvOrCp = async (props = this.props) => {
    const { transports } = props
    if (!transports.length) {
      return
    }
    for (const tr of transports) {
      const {
        srcTransferType,
        transferType,
        fromPath,
        toPath
      } = tr
      if (fromPath === toPath) {
        continue
      }
      const funcName = this.funcMap[transferType]
      const func = srcTransferType === typeMap.local
        ? fs[funcName]
        : props.sftp[funcName]
      await func(fromPath, toPath)
        .catch(
          this.props.store.onError
        )
    }
    const ids = transports.map(d => d.id)
    this.props.modifier(old => {
      const trans1 = old.transports.filter(t => {
        return !ids.includes(t.id)
      })
      if (!trans1.length) {
        this.props.store.editTab(this.props.tab.id, {
          isTransporting: false
        })
      }
      return {
        transports: trans1
      }
    })
    await wait(500)
    this.props[transports[0].srcTransferType + 'List']()
  }

  render () {
    return null
  }
}
