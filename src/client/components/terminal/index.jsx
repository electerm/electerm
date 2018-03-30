
/**
 * terminal/sftp wrapper
 */
import React from 'react'
import Term from './terminal'
import Sftp from '../sftp'
import {Tabs, Radio, Icon} from 'antd'
import _ from 'lodash'
import {generate} from 'shortid'
import {topMenuHeight, tabsHeight, sshTabHeight} from '../../common/constants'

const RadioButton = Radio.Button
const RadioGroup = Radio.Group
const {TabPane} = Tabs

export default class WindowWrapper extends React.Component  {

  constructor(props) {
    super(props)
    let id = generate()
    this.state = {
      pane: 'ssh',
      splitDirection: 'horizontal',
      activeSplitId:id,
      terminals: [
        {
          id: generate()
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

  doSplit = (e, index) => {

  }

  delSplit = () => {

  }

  changeDirection = () => {

  }

  render() {
    let {pane} = this.state
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
    return (
      <div className={'term-sftp-box ' + pane}>
        <div className="terminal-control fix">
          {tabs}
          <div className="fright term-controls">
            <Icon
              type="minus-square-o"
              className="mg1r spin-90 icon-split pointer"
              onClick={this.doSplit}
            />
            <Icon
              type="trash"
              className="mg1r icon-trash pointer"
              onClick={this.delSplit}
            />
            <Icon
              type="minus-square-o"
              className="icon-direction pointer"
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
