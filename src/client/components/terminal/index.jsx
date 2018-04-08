
/**
 * terminal/sftp wrapper
 */
import React from 'react'
import Term from './terminal'
import Sftp from '../sftp'
import {Radio, Icon} from 'antd'
import _ from 'lodash'
import {generate} from 'shortid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {topMenuHeight, tabsHeight, sshTabHeight, terminalSplitDirectionMap} from '../../common/constants'

const RadioButton = Radio.Button
const RadioGroup = Radio.Group

const termControlHeight = 32
const getNextIndex = terminals => {
  let indexs = terminals.map(t => t.index)
  indexs.sort()
  return _.last(indexs) + 1
}

const rebuildIndex = terminals => {
  let indexs = terminals.map(t => t.index)
  let indexMap = indexs.reduce((prev, i, index) => {
    return {
      ...prev,
      i: index
    }
  }, {})
  return terminals.map(t => {
    return {
      ...t,
      index: indexMap[t.index]
    }
  })
}

const getPrevTerminal = terminals => {
  let indexs = terminals.map(t => t.index)
  let max = _.max(indexs)
  return _.find(terminals, t => t.index === max)
}


const {prefix} = window
const e = prefix('ssh')
const m = prefix('menu')

export default class WindowWrapper extends React.Component  {

  constructor(props) {
    super(props)
    let id = generate()
    this.state = {
      pane: 'ssh',
      splitDirection: terminalSplitDirectionMap.vertical,
      activeSplitId: id,
      terminals: [
        {
          id: generate(),
          index: 0
        }
      ]
    }
  }

  computeHeight = () => {
    let hasHost = _.get(this.props, 'tab.host')
    let {showControl} = this.props
    return this.props.height -
      (showControl ? topMenuHeight : 0) -
      tabsHeight -
      (hasHost ? sshTabHeight : 0)
  }

  onChange = e => {
    this.setState({
      pane: e.target.value
    })
  }

  doSplit = (e, id) => {
    let terminals = copy(this.state.terminals)
    let index = _.findIndex(terminals, t => t.id === id) || terminals.length - 1
    terminals.splice(index, 0, {
      id: generate(),
      index: getNextIndex(terminals)
    })
    terminals = rebuildIndex(terminals)
    this.setState({
      terminals
    })
  }

  delSplit = () => {
    let {activeSplitId, terminals} = this.state
    let newTerms = terminals.filter(t => t.id !== activeSplitId)
    if (!newTerms.length) {
      return this.props.delTab({
        id: this.props.tab.id
      })
    }
    let newActiveId = getPrevTerminal(newTerms).id
    this.setState({
      terminals: newTerms,
      activeSplitId: newActiveId
    })
  }

  changeDirection = () => {
    let {splitDirection} = this.state
    this.setState({
      splitDirection: splitDirection === terminalSplitDirectionMap.horizontal
        ? terminalSplitDirectionMap.vertical
        : terminalSplitDirectionMap.horizontal
    })
  }

  computePosition = (index) => {
    let len = this.state.terminals.length || 1
    let {width: windowWidth} = this.props
    let {splitDirection} = this.state
    let isHori = splitDirection === terminalSplitDirectionMap.horizontal
    let heightAll = this.computeHeight()
    let width = isHori
      ? windowWidth / len
      : windowWidth
    let height = isHori
      ? heightAll
      : heightAll / len
    let left = isHori
      ? index * width
      : 0
    let top = isHori
      ? 0
      : index * height
    return {
      height,
      width,
      left,
      top
    }
  }

  renderTerminals = () => {
    let {pane, terminals} = this.state
    let cls = pane === 'ssh'
      ? 'terms-box'
      : 'terms-box hide'
    let {props} = this
    let height = this.computeHeight()
    let {width} = props
    return (
      <div
        className={cls}
        style={{
          width,
          height: height - termControlHeight
        }}
      >
        {
          terminals.map((t, i) => {
            return (
              <Term
                {...props}
                {...t}
                {...this.computePosition(i)}
              />
            )
          })
        }
      </div>
    )
  }

  renderSftp = () => {
    let {pane} = this.state
    let height = this.computeHeight()
    let {props} = this
    let cls = pane === 'ssh'
      ? 'hide'
      : ''
    return (
      <div className={cls}>
        <Sftp
          {...props}
          height={height}
          pane={pane}
        />
      </div>
    )
  }

  render() {
    let {pane, splitDirection, terminals} = this.state
    let {props} = this
    let host = _.get(props, 'tab.host')
    let tabs = host
      ? (
        <div className="term-sftp-tabs sftp">
          <RadioGroup value={pane} onChange={this.onChange}>
            <RadioButton value="ssh">ssh</RadioButton>
            <RadioButton value="sftp">sftp</RadioButton>
          </RadioGroup>
        </div>
      )
      : null
    let cls1 = classnames(
      'mg1r icon-split pointer iblock',
      {
        'spin-90 mg-fix-2': splitDirection === terminalSplitDirectionMap.horizontal
      }
    )
    let cls2 = classnames(
      'icon-direction pointer iblock',
      {
        'spin-90 mg-fix-2': splitDirection === terminalSplitDirectionMap.vertical
      }
    )
    let hide = terminals.length < 2
    return (
      <div
        className={'term-sftp-box ' + pane}
      >
        <div
          className="terminal-control fix"
        >
          {tabs}
          <div className="fright term-controls">
            <Icon
              type="minus-square-o"
              className={cls1}
              onClick={this.doSplit}
              title={e('split')}
            />
            {
              hide
                ? null
                : (
                  <Icon
                    type="delete"
                    className="mg1r icon-trash iblock pointer"
                    onClick={this.delSplit}
                    title={m('delete')}
                  />
                )
            }
            <Icon
              type="minus-square-o"
              className={cls2}
              title={e('changeDirection')}
              onClick={this.changeDirection}
            />
          </div>
        </div>
        {
          this.renderTerminals()
        }
        {
          host
            ? this.renderSftp()
            : null
        }
      </div>
    )
  }

}
