/**
 * settings page
 */

import { Component } from '../common/react-subx'
import {
  CloseCircleOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons'
import {
  Upload,
  Input,
  Button,
  Table,
  Tabs,
  Tooltip
} from 'antd'
import {
  sidebarWidth,
  statusMap,
  commonActions,
  batchOpHelpLink
} from '../../common/constants'
import { autoRun } from 'manate'
import _ from 'lodash'
import Link from '../common/external-link'
import { runCmd } from '../terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import postMsg from '../../common/post-msg'
import uid from '../../common/uid'
import wait from '../../common/wait'
import { getFolderFromFilePath } from '../sftp/file-read'
import resolveFilePath from '../../common/resolve'

const { prefix } = window
const f = prefix('form')
const t = prefix('transferHistory')
const c = prefix('common')
const { TabPane } = Tabs

export default class BatchOp extends Component {
  state = {
    text: '',
    loading: false,
    tasks: [],
    errors: [],
    history: [],
    working: false,
    tab: 'tasks'
  }

  onCancel = () => {
    this.props.store.toggleBatchOp()
  }

  handleChangeTab = tab => {
    this.setState({
      tab
    })
  }

  handleExec = async () => {
    this.setState({
      working: true
    })
    const { tasks } = this.state
    const len = tasks.length
    for (let i = 0; i < len; i++) {
      await this.run(tasks[i], i)
    }
    this.setState(old => {
      return {
        working: false,
        history: [
          ...old.history,
          ...old.tasks
        ],
        tasks: []
      }
    })
  }

  updateState = (str, index) => {
    // console.log(str, index)
    this.setState(old => {
      const arr = deepCopy(old.tasks)
      arr[index].state = str
      return {
        tasks: arr
      }
    })
  }

  run = async (conf, index) => {
    this.updateState('working', index)
    let tab = await this.createTab(conf)
      .then(r => r)
      .catch(err => {
        return 'Error: ' + err.message
      })
    if (!tab || !tab.pid) {
      return this.updateState(tab, index)
    }

    this.updateState('tab created', index)
    if (conf.cmd) {
      this.updateState('running cmd', index)
      await runCmd(tab.pid, tab.sessionId, conf.cmd)
      this.updateState('running cmd done', index)
    }
    if (conf.remotePath) {
      this.updateState('creating sftp', index)
      tab = await this.createSftp(tab)
      if (!tab || !tab.pid) {
        return this.updateState('Error: ' + tab, index)
      }
      this.updateState('sftp created', index)
      this.updateState('transferring file', index)
      await this.doTransfer(tab, conf)
      this.updateState('done: transferring file', index)
    }
    if (conf.cmdAfterTransfer) {
      this.updateState('run cmd2', index)
      document.querySelector('.session-current .type-tab.ssh').click()
      await wait(200)
      await runCmd(tab.pid, tab.sessionId, conf.cmdAfterTransfer)
      this.updateState('run cmd2 done', index)
    }
    this.updateState(c('finished'), index)
    document.querySelector('.tabs .tab.active .tab-close .anticon').click()
  }

  doTransfer = (tab, conf) => {
    return new Promise((resolve, reject) => {
      const isDown = conf.action === 'download'
      const fp = isDown ? conf.remotePath : conf.localPath
      const {
        name
      } = getFolderFromFilePath(fp)
      const obj = {
        fromPath: fp,
        id: uid(),
        operation: '',
        sessionId: tab.sessionId,
        tabId: tab.id,
        title: 'batch operation',
        toPath: resolveFilePath(isDown ? conf.localPath : conf.remotePath, name),
        typeFrom: isDown ? 'remote' : 'local',
        typeTo: isDown ? 'local' : 'remote',
        skipConfirm: true
      }
      postMsg({
        list: [obj],
        action: commonActions.addTransfer,
        sessionId: tab.sessionId
      })
      const { store } = window
      this.tm = setTimeout(() => {
        reject(new Error('timeout'))
      }, 1000 * 60 * 60)
      this.ref1 = autoRun(store, () => {
        const { transferHistory } = store
        const first = transferHistory.find(t => t.id === obj.id)
        if (first && first.sessionId === tab.sessionId) {
          this.ref1 && this.ref1.stop()
          delete this.ref1
          clearTimeout(this.tm)
          resolve()
        }
        return store.transferHistory
      })
      this.ref1.start()
    })
  }

  createSftp = (tab) => {
    return new Promise((resolve, reject) => {
      document.querySelector('.session-current .type-tab.sftp').click()
      const { store } = window
      this.ref2 = autoRun(store, () => {
        const { tabs } = store
        const last = tabs.find(t => t.id === tab.id)
        if (
          last &&
          last.id === tab.id &&
          last.sftpCreated === true
        ) {
          this.ref2 && this.ref2.stop()
          delete this.ref2
          resolve(last)
        } else if (
          last &&
          last.id === tab.id &&
          last.sftpCreated === false
        ) {
          reject(new Error('failed to create sftp connection'))
        }
        return store.tabs
      })
      this.ref2.start()
    })
  }

  createTab = conf => {
    return new Promise((resolve, reject) => {
      const tab = {
        ..._.pick(conf, [
          'host',
          'port',
          'username',
          'password'
        ]),
        authType: 'password',
        enableSftp: true,
        enableSsh: true,
        encode: 'utf-8',
        envLang: 'en_US.UTF-8',
        id: uid(),
        title: 'batch operation',
        pane: 'terminal',
        status: 'processing',
        term: 'xterm-256color',
        x11: false
      }
      const { store } = window
      store.addTab(tab)
      this.ref = autoRun(store, () => {
        const { tabs } = store
        const len = tabs.length
        const last = tabs[len - 1]
        if (
          last &&
          last.pid &&
          last.id === tab.id &&
          last.status === statusMap.success
        ) {
          this.ref && this.ref.stop()
          delete this.ref
          resolve(last)
        } else if (last.status === statusMap.error) {
          reject(new Error('failed to create connection'))
        }
        return store.tabs
      })
      this.ref.start()
    })
  }

  handleClick = () => {
    this.setState({
      errors: [],
      working: false,
      loading: true
    })
    const reg = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/g
    const errors = []
    const tasks = this.state.text
      .split('\n')
      .filter(d => d)
      .map(r => {
        const [
          host,
          port,
          username,
          password,
          cmd,
          localPath,
          remotePath,
          action,
          cmdAfterTransfer
        ] = r.split(reg).map(g => {
          return g.trim().replace(/^["](.*)["]$/, '$1')
        })
        if (!host || !port || !username || !password) {
          errors.push({
            text: r,
            msg: 'host, port, username, password required'
          })
          return ''
        }
        const res = {
          host,
          port,
          username,
          password
        }
        if (cmd) {
          res.cmd = cmd
        }
        if (cmdAfterTransfer) {
          res.cmdAfterTransfer = cmdAfterTransfer
        }
        if (
          localPath &&
          remotePath &&
          action
        ) {
          Object.assign(res, {
            localPath,
            remotePath,
            action
          })
        }
        if (action && !['upload', 'download'].includes(action)) {
          errors.push({
            text: r,
            msg: 'action can only be download or upload'
          })
          return ''
        } else if (!res.cmd && !res.transfer && !res.cmdAfterTransfer) {
          errors.push({
            text: r,
            msg: 'must have cmd or transfer'
          })
          return ''
        }
        return res
      })
      .filter(d => d)
    this.setState(old => {
      return {
        errors,
        tasks: [
          ...old.tasks,
          ...tasks
        ],
        loading: false,
        text: errors.length ? this.state.text : ''
      }
    })
  }

  handleChange = (e) => {
    this.setState({
      text: e.target.value
    })
  }

  beforeUpload = (file) => {
    const text = window.pre
      .readFileSync(file.path).toString()
    this.setState({
      text
    })
  }

  renderError (err, i) {
    return (
      <div key={'batch-txt' + i}>
        <pre><code>{err.text}</code></pre>
        <div>{err.msg}</div>
      </div>
    )
  }

  renderErrors () {
    const {
      errors
    } = this.state
    if (!errors.length) {
      return null
    }
    return (
      <div className='pd1y'>
        {
          errors.map(this.renderError)
        }
      </div>
    )
  }

  renderExec () {
    const { length } = this.state.tasks
    if (!length) {
      return null
    }
    return (
      <div className='pd1b'>
        <Button
          onClick={this.handleExec}
          loading={this.state.working}
        >{c('execute')}</Button>
      </div>
    )
  }

  translate = k => {
    if (k === 'index') {
      return 'NO.'
    } else if (
      [
        'host',
        'port',
        'username',
        'password'
      ].includes(k)
    ) {
      return f(k)
    } else if (
      k.includes('Path')
    ) {
      return t(k)
    } else {
      return c(k)
    }
  }

  renderContent () {
    const {
      text,
      loading,
      tasks,
      working
    } = this.state
    const disabled = loading || working
    return (
      <div>
        <div className='pd1y'>
          <h2>
            {c('batchOperation')}
            <Tooltip
              title={
                <span>
                  <Link to={batchOpHelpLink}>{batchOpHelpLink}</Link>
                </span>
              }
            >
              <span className='mg1l'>
                <QuestionCircleOutlined />
              </span>
            </Tooltip>
          </h2>
          <div className='pd1y'>{c('examples')}:</div>
          <pre>
            <code>"192.168.1.3","22","username","password","touch yy.js && ls -al","/home/user/some_local_file_or_folder_to_upload","/server/some_server_folder_for_upload","upload","touch yy1.js && ls -al"</code>
          </pre>
          <pre>
            <code>"192.168.1.3","22","username","password","ls -al","/home/user/some_local_folder_for_download","/server/some_server_file_or_folder","download","ls"</code>
          </pre>
        </div>
        {this.renderErrors()}
        <div className='pd1y'>
          <Upload
            beforeUpload={this.beforeUpload}
            fileList={[]}
            disabled={disabled}
          >
            <Button
              type='ghost'
              disabled={disabled}
            >
              {c('importFromCSV')}
            </Button>
          </Upload>
        </div>
        <div className='pd1y'>
          <Input.TextArea
            value={text}
            disabled={disabled}
            rows={10}
            onChange={this.handleChange}
          />
        </div>
        <div className='pd1b fix'>
          <div className='fleft'>
            <Button
              onClick={this.handleClick}
              loading={loading}
              disabled={disabled}
              htmlType='button'
            >{c('addToQueue')}</Button>
          </div>
          <div className='fright'>
            <Button
              onClick={this.handleExec}
              loading={loading}
              disabled={disabled || !tasks.length}
              type='primary'
              htmlType='button'
            >{c('execute')}</Button>
          </div>
        </div>
        <div className='pd1y'>
          {this.renderTables()}
        </div>
      </div>
    )
  }

  renderTables () {
    const {
      tab
    } = this.state
    return (
      <Tabs
        activeKey={tab}
        onChange={this.handleChangeTab}
      >
        {
          ['tasks', 'history'].map(this.renderTab)
        }
      </Tabs>
    )
  }

  renderTab = (tab) => {
    const data = this.state[tab]
    const columns = [
      'index',
      'host',
      'port',
      'username',
      'password',
      'cmd',
      'localPath',
      'remotePath',
      'cmdAfterTransfer',
      'state'
    ].map(k => {
      return {
        title: this.translate(k),
        dataIndex: k,
        key: k,
        render: (k) => k || ''
      }
    })
    const src = data.map((t, i) => {
      return {
        index: i + 1,
        ...t
      }
    })
    const len = data.length
    const title = `${c(tab)}(${len})`
    return (
      <TabPane
        tab={title}
        key={tab}
      >
        <Table
          dataSource={src}
          columns={columns}
          bordered
          pagination={false}
          size='small'
          rowKey='index'
        />
      </TabPane>
    )
  }

  renderClose () {
    const {
      loading,
      working
    } = this.state
    if (loading || working) {
      return null
    }
    return (
      <CloseCircleOutlined
        className='close-setting-wrap'
        onClick={this.onCancel}
      />
    )
  }

  render () {
    const {
      showBatchOp
    } = this.props.store
    const cls = showBatchOp
      ? 'setting-wrap'
      : 'setting-wrap setting-wrap-hide'
    const pops = {
      id: 'batch-op-wrap',
      className: cls,
      style: {
        left: sidebarWidth + 'px'
      }
    }
    return (
      <div {...pops}>
        {this.renderClose()}
        <div className='setting-wrap-content'>
          <div className='pd2b pd2x setting-wrap-inner'>
            {showBatchOp ? this.renderContent() : null}
          </div>
        </div>
      </div>
    )
  }
}
