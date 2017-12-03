import React from 'react'
import {notification} from 'antd'
import {getLatestReleaseInfo} from '../../common/update-check'
import compare from '../../common/version-compare'
import Link from '../common/external-link'

export default class FileMode extends React.Component {

  componentDidMount() {
    this.getLatestReleaseInfo()
  }

  getLatestReleaseInfo = async () => {
    let releaseInfo = await getLatestReleaseInfo()
    if (!releaseInfo) {
      return this.notifyUpdateFail()
    }
    let currentVer = 'v' + window.getGlobal('version').split('-')[0]
    let latestVer = releaseInfo.tag_name
    if (compare(currentVer, latestVer) < 0) {
      this.showUpdateInfo(releaseInfo)
    }
  }

  notifyUpdateFail() {
    let releaseUrl = 'https://github.com/electerm/electerm/releases'
    notification.info({
      message: 'check update fails',
      description: (
        <div>
          you can visit
          <Link
            to={releaseUrl}
            className="mg1x"
          >{releaseUrl}</Link>
          to check latest release
        </div>
      ),
      duration: 10
    })
  }

  showUpdateInfo = (releaseInfo) => {
    let {html_url, tag_name} = releaseInfo
    let description = (
      <div>
        <p className="pd1b wordbreak">
          go get it!
          <Link to={html_url} className="mg1l">{html_url}</Link>
        </p>
      </div>
    )
    notification.info({
      message: (
        <p className="pd1b">new version found <b>{tag_name}</b></p>
      ),
      description,
      duration: 15
    })
  }

  render() {
    return null
  }

}
