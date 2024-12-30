import React from 'react'
import { FrownOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import {
  logoPath1,
  packInfo,
  isMac,
  isWin
} from '../../common/constants'
import Link from '../common/external-link'
import fs from '../../common/fs'
import { copy } from '../../common/clipboard'

const e = window.translate
const os = isMac ? 'mac' : isWin ? 'windows' : 'linux'
const troubleshootContent = {
  runInCommandLine: {
    mac: '/Applications/electerm.app/Contents/MacOS/electerm',
    linux: 'path/to/electerm',
    windows: 'path\\to\\electerm.exe'
  },
  clearConfig: {
    mac: 'rm -rf ~/Library/Application\\ Support/electerm/users/default_user/electerm.data.nedb',
    linux: 'rm -rf ~/.config/electerm/users/default_user/electerm.data.nedb',
    windows: 'Delete C:\\Users\\your-user-name\\AppData\\Roaming\\electerm\\users\\default_user\\electerm.data.nedb'
  },
  clearData: {
    mac: 'rm -rf ~/Library/Application\\ Support/electerm*',
    linux: 'rm -rf ~/.config/electerm',
    windows: 'Delete C:\\Users\\your-user-name\\AppData\\Roaming\\electerm'
  }
}

export default class ErrorBoundary extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      hasError: false,
      error: {}
    }
  }

  componentDidCatch (error) {
    log.error(error)
    this.setState({
      hasError: true,
      error
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleClearData = async () => {
    await fs.rmrf(troubleshootContent.clearData[os])
      .then(
        () => {
          message.success('Data cleared')
        }
      )
  }

  handleClearConfig = async () => {
    await fs.rmrf(troubleshootContent.clearConfig[os])
      .then(
        () => {
          message.success('Config cleared')
        }
      )
  }

  handleCopy = () => {
    copy(troubleshootContent.runInCommandLine[os])
  }

  renderButton = type => {
    if (type === 'clearData') {
      return (
        <Button
          className='mg1l'
          onClick={this.handleClearData}
        >
          {e('clearData')}
        </Button>
      )
    }
    if (type === 'runInCommandLine') {
      return (
        <Button
          className='mg1l'
          onClick={this.handleCopy}
        >
          {e('copy')}
        </Button>
      )
    }
    return (
      <Button
        className='mg1l'
        onClick={this.handleClearConfig}
      >
        {e('clearConfig')}
      </Button>
    )
  }

  renderTroubleShoot = () => {
    const {
      bugs: {
        url: bugReportLink
      }
    } = packInfo
    const bugUrl = `${bugReportLink}/new/choose`
    return (
      <div className='pd1y wordbreak'>
        <h2>{e('troubleShoot')}</h2>
        <p>Electerm Version: {packInfo.version}, OS: {os}</p>
        {
          Object.keys(troubleshootContent).map((k, i) => {
            const v = troubleshootContent[k]
            const cmd = v[os]
            return (
              <div className='pd1b' key={k}>
                <h3>{e(k)} {this.renderButton(k)}</h3>
                <p><code>{cmd}</code></p>
              </div>
            )
          })
        }
        <div className='pd1b'>
          <Link to={bugUrl}>{e('bugReport')}</Link>
        </div>
        <div className='pd3y'>
          <img
            src='https://electerm.html5beta.com/electerm-wechat-group-qr.jpg'
            className='mwm-100'
          />
        </div>
      </div>
    )
  }

  render () {
    if (this.state.hasError) {
      const { stack, message } = this.state.error
      return (
        <div className='pd3 error-wrapper'>
          <div className='pd2y'>
            <img src={logoPath1} className='iblock mwm-100' />
          </div>
          <h1>
            <FrownOutlined className='mg1r iblock' />
            <span className='iblock mg1r'>{e('error')}</span>
            <Button
              onClick={this.handleReload}
              icon={<ReloadOutlined />}
            >
              {e('reload')}
            </Button>
          </h1>
          <div className='pd1y'>{message}</div>
          <div className='pd1y'>{stack}</div>
          {
            this.renderTroubleShoot()
          }
        </div>
      )
    }
    return this.props.children
  }
}
