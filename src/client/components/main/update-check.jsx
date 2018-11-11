import {Component} from 'react-subx'
import {notification} from 'antd'
import {getLatestReleaseInfo} from '../../common/update-check'
import compare from '../../common/version-compare'
import Link from '../common/external-link'

const {getGlobal, prefix} = window
let {
  homepage
} = getGlobal('packInfo')
const e = prefix('updater')

export default class UpdateCheck extends Component {

  componentDidMount() {
    this.getLatestReleaseInfo(true)
    window.addEventListener('message', e => {
      if (e.data && e.data.type && e.data.type === 'check-update') {
        this.getLatestReleaseInfo()
      }
    })
  }

  getLatestReleaseInfo = async (autoCheck) => {
    this.props.store.modifier({
      onCheckUpdating: true
    })
    let releaseInfo = await getLatestReleaseInfo()
    this.props.store.modifier({
      onCheckUpdating: false
    })
    if (!releaseInfo) {
      return this.notifyUpdateFail()
    }
    let currentVer = 'v' + window.getGlobal('version').split('-')[0]
    let latestVer = releaseInfo.tag_name
    if (compare(currentVer, latestVer) < 0) {
      this.showUpdateInfo(releaseInfo)
    } else if (!autoCheck) {
      notification.info({
        message: e('noNeed'),
        description: e('noNeedDesc'),
        duration: 5
      })
    }
  }

  notifyUpdateFail() {
    notification.info({
      message: e('fail'),
      description: (
        <div>
          you can visit
          <Link
            to={homepage}
            className="mg1x"
          >{homepage}</Link>
          {e('fail')}
        </div>
      ),
      duration: 10
    })
  }

  showUpdateInfo = (releaseInfo) => {
    let {tag_name} = releaseInfo
    let description = (
      <div>
        <p className="pd1b wordbreak">
          {e('goGetIt')}
          <Link to={homepage} className="mg1l">{homepage}</Link>
        </p>
      </div>
    )
    notification.info({
      message: (
        <p className="pd1b">{e('newVersion')} <b>{tag_name}</b></p>
      ),
      description,
      duration: 15
    })
  }

  render() {
    return null
  }

}
