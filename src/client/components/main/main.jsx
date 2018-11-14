
import {Component} from '../common/react-subx'
import Wrapper from '../terminal'
import _ from 'lodash'
import copy from 'json-deep-copy'
import ContextMenu from '../common/context-menu'
import FileInfoModal from '../sftp/file-props-modal'
import FileModeModal from '../sftp/file-mode-modal'
import UpdateCheck from './update-check'
import TextEditor from '../text-editor'
import Control from '../control'
import SessionControl from '../session-control'
import store from '../../store'
import './wrapper.styl'

const {getGlobal} = window
const ls = getGlobal('ls')
let sessionsGlob = copy(ls.get('sessions'))

export default class Index extends Component {

  componentDidMount() {
    window.lang = copy(window.lang)
    window._config = copy(window._config)
    window.addEventListener('resize', this.onResize)
    this.onResize()
    window._require('electron')
      .ipcRenderer
      .on('checkupdate', this.props.store.onCheckUpdate)
      .on('open-about', this.props.store.openAbout)
      .on('toggle-control', this.toggleControl)
      .on('new-ssh', this.props.store.onNewSsh)
      .on('openSettings', this.props.store.openSetting)
    document.addEventListener('drop', function(e) {
      e.preventDefault()
      e.stopPropagation()
    })
    document.addEventListener('dragover', function(e) {
      e.preventDefault()
      e.stopPropagation()
    })
    this.checkLastSession()
    window.addEventListener('offline',  this.setOffline)
  }

  componentDidUpdate() {
    let {currentTabId} = this.props.store
    if (
      currentTabId
    ) {
      let term = _.get(this, `term_${currentTabId}.term`)
      term && term.focus()
    }
  }

  onResize = _.debounce(() => {
    let update = {
      height: window.innerHeight,
      width: window.innerWidth,
      isMaximized: window.getGlobal('isMaximized')()
    }
    this.props.store.setState(update)
    window
      .getGlobal('lastStateManager')
      .set('windowSize', update)
  }, 100)

  checkLastSession = () => {
    let status = window.getGlobal('getExitStatus')()
    if (status === 'ok') {
      return
    }
    this.showLastSessions(sessionsGlob)
  }

  showLastSessions = sessions => {
    if (!sessions) {
      return
    }
    this.props.store.setState({
      selectedSessions: copy(sessions).map(s => ({
        id: s.id,
        tab: s,
        checked: true
      })),
      sessionModalVisible: true
    })
  }

  toggleControl = () => {
    this.props.store.setState(old => {
      return {
        showControl: !old.showControl
      }
    })
  }

  render() {
    let {
      tabs,
      currentTabId,
      showControl
    } = store
    return (
      <div>
        <SessionControl store={store} />
        <TextEditor
          store={store}
        />
        <UpdateCheck
          store={store}
        />
        <ContextMenu
          store={store}
        />
        <FileInfoModal
          store={store}
        />
        <FileModeModal
          key={
            store.fileModeModalProps.file
              ? store.fileModeModalProps.file.id
              : ''
          }
          store={store}
        />
        <div
          id="outside-context"
          className={showControl ? 'show-control' : 'hide-control'}
        >
          <Control
            store={store}
          />
          <div className="ui-outer">
            {
              tabs.map((tab) => {
                let {id} = tab
                let cls = id !== currentTabId
                  ? 'hide'
                  : 'ssh-wrap-show'
                return (
                  <div className={cls} key={id}>
                    <Wrapper
                      store={store}
                      tab={tab}
                      ref={ref => this[`term_${id}`] = ref}
                    />
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    )
  }

}
