/**
 * settings page
 */

import { PureComponent } from 'react'
import {
  CloseCircleOutlined
} from '@ant-design/icons'
import {
  Upload,
  Input,
  Button,
  Table,
  Drawer,
  Tabs
} from 'antd'
import {
  sidebarWidth,
  statusMap,
  batchOpHelpLink,
  modals
} from '../../common/constants'
import HelpIcon from '../common/help-icon'
import download from '../../common/download'
import { autoRun } from 'manate'
import { pick } from 'lodash-es'
import { runCmd } from '../terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import uid from '../../common/uid'
import wait from '../../common/wait'
import { getFolderFromFilePath } from '../sftp/file-read'
import resolveFilePath from '../../common/resolve'
import { refsStatic } from '../common/ref'

const e = window.translate

export default class BatchOp extends PureComponent {
  state = {
    text: '',
    loading: false,
    tasks: [],
    errors: [],
    history: [],
    working: false,
    tab: 'tasks'
  }

  exampleColumns = [
    { title: e('host'), dataIndex: 'host', key: 'host' },
    { title: e('port'), dataIndex: 'port', key: 'port', responsive: ['md'] },
    { title: e('username'), dataIndex: 'username', key: 'username', responsive: ['lg'] },
    { title: e('password'), dataIndex: 'password', key: 'password', responsive: ['xl'] },
    { title: 'Command', dataIndex: 'command', key: 'command', responsive: ['lg'] },
    { title: e('localPath'), dataIndex: 'localPath', key: 'localPath', responsive: ['xl'] },
    { title: e('remotePath'), dataIndex: 'remotePath', key: 'remotePath', responsive: ['xl'] },
    { title: 'Action', dataIndex: 'action', key: 'action', responsive: ['md'] },
    { title: 'Command After', dataIndex: 'commandAfter', key: 'commandAfter', responsive: ['xl'] }
  ]

  exampleData = [
    {
      key: '1',
      host: '192.168.1.3',
      port: '22',
      username: 'username',
      password: 'password',
      command: 'touch yy.js && ls -al',
      localPath: '/home/user/some_local_file_or_folder_to_upload',
      remotePath: '/server/some_server_folder_for_upload',
      action: 'upload',
      commandAfter: 'touch yy1.js && ls -al'
    },
    {
      key: '2',
      host: '192.168.1.3',
      port: '22',
      username: 'username',
      password: 'password',
      command: 'ls -al',
      localPath: '/home/user/some_local_folder_for_download',
      remotePath: '/server/some_server_file_or_folder',
      action: 'download',
      commandAfter: 'ls'
    }
  ]

  componentDidMount () {
    this.id = 'batch-op'
    refsStatic.add(this.id, this)
  }

  handleDownloadExample = () => {
    const csvText = this.exampleData.map(d => {
      return Object.keys(d).filter(d => d !== 'key').map(k => {
        return d[k]
      }).join(',')
    }).join('\n')
    download('batch-op-example.csv', csvText)
  }

  handleCancel = () => {
    window.store.toggleBatchOp()
  }

  handleChangeTab = tab => {
    this.setState({
      tab
    })
  }

  handleDel = rec => {
    this.setState(old => {
      return {
        tasks: old.tasks.filter(t => {
          return t.id !== rec.id
        })
      }
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
      .catch(err => {
        console.log('create tab error', err)
        if (this.ref) {
          this.ref.stop()
          delete this.ref
        }
        return 'Error: ' + err.message
      })
    if (typeof tab === 'string') {
      return this.updateState(tab, index)
    }

    this.updateState('tab created', index)
    if (conf.cmd) {
      this.updateState('running cmd', index)
      await runCmd(tab.id, tab.sessionId, conf.cmd)
      this.updateState('running cmd done', index)
    }
    if (conf.remotePath) {
      this.updateState('creating sftp', index)
      tab = await this.createSftp(tab).catch(err => {
        console.log('create sftp error', err)
        if (this.ref2) {
          this.ref2.stop()
          delete this.ref2
        }
        return 'Error: ' + err.message
      })
      if (typeof tab === 'string') {
        return this.updateState(tab, index)
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
      await runCmd(tab.id, tab.sessionId, conf.cmdAfterTransfer)
      this.updateState('run cmd2 done', index)
    }
    this.updateState(e('finished'), index)
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
        skipExpand: true,
        zip: true,
        skipConfirm: true
      }
      const { store } = window
      store.addTransferList([obj])

      this.tm = setTimeout(() => {
        reject(new Error('timeout'))
      }, 1000 * 60 * 60)
      this.ref1 = autoRun(() => {
        const { transferHistory } = store
        const first = transferHistory.find(t => {
          return (t.id === obj.id || t.originalId === obj.id) && t.unzip
        })
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
      this.ref2 = autoRun(() => {
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
        ...pick(conf, [
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
        x11: false,
        batch: window.store.batch
      }
      const { store } = window
      store.addTab(tab)
      this.ref = autoRun(() => {
        const { tabs } = store
        const len = tabs.length
        const last = tabs[len - 1]
        if (
          last &&
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
          port: Number(port),
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
        res.id = uid()
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

  beforeUpload = async (file) => {
    const text = await window.fs.readFile(file.path)
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
        >{e('execute')}
        </Button>
      </div>
    )
  }

  translate = k => {
    if (k === 'index') {
      return 'NO.'
    }
    return e(k)
  }

  renderContent () {
    const {
      text,
      loading,
      tasks,
      working
    } = this.state
    const disabled = loading || working
    const exampleTableProps = {
      dataSource: this.exampleData,
      columns: this.exampleColumns,
      pagination: false,
      size: 'small',
      rowKey: 'key'
    }

    return (
      <div>
        <div className='pd1y'>
          <h2>
            {e('batchOperation')}
            <HelpIcon
              link={batchOpHelpLink}
            />
          </h2>
          <div className='pd1y'>{e('examples')}:</div>
          <Table
            {...exampleTableProps}
          />
          <div className='pd1t pd2b'>
            <Button
              onClick={this.handleDownloadExample}
              type='dashed'
            >
              Download example csv
            </Button>
          </div>
          <div className='pd2y'>
            <pre>
              <code>"192.168.1.3","22","username","password","touch yy.js && ls -al","/home/user/some_local_file_or_folder_to_upload","/server/some_server_folder_for_upload","upload","touch yy1.js && ls -al"</code>
            </pre>
            <pre>
              <code>"192.168.1.3","22","username","password","ls -al","/home/user/some_local_folder_for_download","/server/some_server_file_or_folder","download","ls"</code>
            </pre>
          </div>
        </div>
        {this.renderErrors()}
        <div className='pd1y'>
          <Upload
            beforeUpload={this.beforeUpload}
            fileList={[]}
            disabled={disabled}
          >
            <Button
              type='dashed'
              disabled={disabled}
            >
              {e('importFromCSV')}
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
            >{e('addToQueue')}
            </Button>
          </div>
          <div className='fright'>
            <Button
              onClick={this.handleExec}
              loading={loading}
              disabled={disabled || !tasks.length}
              type='primary'
              htmlType='button'
            >{e('execute')}
            </Button>
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
        items={this.renderItems()}
      />
    )
  }

  renderItems = () => {
    return ['tasks', 'history'].map(this.renderTab)
  }

  renderTab = (tab) => {
    const data = this.state[tab]
    const keeps = [
      'index',
      'host',
      'state'
    ]
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
        render: (k) => k || '',
        responsive: keeps.includes(k) ? undefined : ['md', 'lg', 'xl', 'xxl']
      }
    })
    if (tab === 'tasks') {
      columns.push({
        title: e('del'),
        dataIndex: 'op',
        key: 'op',
        render: (k, rec) => {
          if (this.state.loading || this.state.working) {
            return null
          }
          return (
            <span
              className='act-del pointer'
              onClick={() => this.handleDel(rec)}
            >
              {e('del')}
            </span>
          )
        }
      })
    }
    const src = data.map((t, i) => {
      return {
        index: i + 1,
        ...t
      }
    })
    const len = data.length
    const title = `${e(tab)}(${len})`
    return {
      key: tab,
      label: title,
      children: (
        <Table
          dataSource={src}
          columns={columns}
          bordered
          pagination={false}
          size='small'
          rowKey='id'
        />
      )
    }
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
        onClick={this.handleCancel}
      />
    )
  }

  render () {
    const {
      showModal,
      innerWidth
    } = this.props
    const showBatchOp = showModal === modals.batchOps
    const pops = {
      open: showBatchOp,
      onClose: this.handleCancel,
      className: 'setting-wrap',
      width: innerWidth - sidebarWidth,
      zIndex: 888,
      placement: 'left',
      styles: {
        header: {
          display: 'none'
        }
      }
    }
    return (
      <Drawer
        {...pops}
      >
        <div id='batch-op-wrap'>
          {this.renderClose()}
          <div className='setting-wrap-content'>
            <div className='pd3 setting-wrap-inner'>
              {showBatchOp ? this.renderContent() : null}
            </div>
          </div>
        </div>
      </Drawer>
    )
  }
}
