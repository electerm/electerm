
/**
 * terminal/sftp wrapper
 */
import React from 'react'
import Term from './terminal'
import Sftp from '../sftp'
import {Tabs, Radio, Icon} from 'antd'
import _ from 'lodash'
import {generate} from 'shortid'
import copy from 'json-deep-copy'
import classnames from 'classnames'
import {topMenuHeight, tabsHeight, sshTabHeight, terminalSplitDirectionMap} from '../../common/constants'

const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const {TabPane} = Tabs

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

export default class WindowWrapper extends React.Component  {

  constructor(props) {
    super(props)
    let id = generate()
    this.state = {
      pane: 'ssh',
      splitDirection: terminalSplitDirectionMap.horizontal,
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
    return window.innerHeight - topMenuHeight - tabsHeight - (hasHost ? sshTabHeight : 0)
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

  render() {
    let {pane, splitDirection} = this.state
    let {props} = this
    let height = this.computeHeight()
    let host = _.get(props, 'tab.host')
    let propsAll = {
      ...props,
      height
    }
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
      'mg1r icon-split pointer',
      {
        'spin-90': splitDirection === terminalSplitDirectionMap.horizontal
      }
    )
    let cls2 = classnames(
      'icon-direction pointer',
      {
        'spin-90': splitDirection === terminalSplitDirectionMap.vertical
      }
    )
    return (
      <div className={'term-sftp-box ' + pane}>
        <div className="terminal-control fix">
          {tabs}
          <div className="fright term-controls">
            <Icon
              type="minus-square-o"
              className={cls1}
              onClick={this.doSplit}
            />
            <Icon
              type="trash"
              className="mg1r icon-trash pointer"
              onClick={this.delSplit}
            />
            <Icon
              type="minus-square-o"
              className={cls2}
              onClick={this.changeDirection}
            />
          </div>
        </div>
        {
          host
            ? (
              <Tabs
                activeKey={pane}
              >
                <TabPane
                  tab="ssh"
                  key="ssh"
                >
                  <Term {...propsAll} />
                </TabPane>
                <TabPane
                  tab="sftp"
                  key="sftp"
                >
                  <Sftp
                    {...props}
                    height={height}
                    pane={pane}
                  />
                </TabPane>
              </Tabs>
            )
            : <Term {...propsAll} />
        }
      </div>
    )
  }

}
