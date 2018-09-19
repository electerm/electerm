/**
 * file operation: cp/mv
 */
import React from 'react'
import _ from 'lodash'
import fs from '../../common/fs'
import {typeMap} from '../../common/constants'
import wait from '../../common/wait'

export default class Transports extends React.PureComponent {

  constructor(props) {
    super(props)
    this.state = {
      currentTransport: props.transports[0] || null,
      showList: false
    }
  }

  componentWillMount() {
    this.mvOrCp()
  }

  componentDidUpdate(prevProps) {
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
    let {transports} = props
    if (!transports.length) {
      return
    }
    for (let tr of transports) {
      let {
        srcTransferType,
        transferType,
        fromPath,
        toPath
      } = tr
      if (fromPath === toPath) {
        continue
      }
      let funcName = this.funcMap[transferType]
      let func = srcTransferType === typeMap.local
        ? fs[funcName]
        : props.sftp[funcName]
      await func(fromPath, toPath)
        .catch(
          this.props.onError
        )
    }
    let ids = transports.map(d => d.id)
    this.props.modifier(old => {
      old.transports = old.transports.filter(t => {
        return !ids.includes(t.id)
      })
      return old
    })
    await wait(500)
    this.props[transports[0].srcTransferType + 'List']()
  }

  render() {
    return null
  }
}
