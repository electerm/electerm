/**
 * btns
 */

import {Icon} from 'antd'
import {ctrlOrCmd} from '../../common/constants'
import createTitle from '../../common/create-title'
import './menu.styl'

const {prefix} = window
const e = prefix('control')
const m = prefix('menu')
const c = prefix('common')
const t = prefix('tabs')
const s = prefix('setting')

// const onOpenMenu = (e) => {
//   let {right: x, bottom: y} = e.currentTarget.getBoundingClientRect()
//   x = Math.ceil(x - 15)
//   y = Math.ceil(x - 12)
//   window.getGlobal('popup')({
//     x,
//     y
//   })
// }

const logo = require('node_modules/@electerm/electerm-resource/res/imgs/electerm.svg').replace(/^\//, '')

function renderTabs(props) {
  return (
    <div className="sub-context-menu">
      {
        props.tabs.map(item => {
          let title = createTitle(item)
          return (
            <div
              className="sub-context-menu-item"
              title={title}
              onClick={() => props.onChangeTabId(item.id)}
            >
              {title}
            </div>
          )
        })
      }
    </div>
  )
}

function renderHistory(props) {
  return (
    <div className="sub-context-menu">
      {
        props.history.map(item => {
          let title = createTitle(item)
          return (
            <div
              className="sub-context-menu-item"
              title={title}
              onClick={() => props.onSelectHistory(item.id)}
            >
              {title}
            </div>
          )
        })
      }
    </div>
  )
}

function renderContext(props) {
  let cls = 'pd2x pd1y context-item pointer'
  let cls1 = cls + ' with-sub-menu'
  return (
    <div className="menus">
      <div
        className={cls}
        onClick={props.onNewSsh}
      >
        <Icon type="code" theme="filled" /> {e('newSsh')}
        <span className="context-sub-text">{ctrlOrCmd}+N</span>
      </div>
      <div
        className={cls}
        onClick={() => props.addTab()}
      >
        <Icon type="right-square" theme="filled" /> {t('newTab')}
      </div>
      <hr />
      <div
        className={cls1}
      >
        <Icon type="clock-circle" /> {c('history')}
        <span className="context-sub-text">
          <Icon type="right" />
        </span>
        {renderHistory(props)}
      </div>
      <div
        className={cls1}
      >
        <Icon type="bars" /> {t('sessions')}
        <span className="context-sub-text">
          <Icon type="right" />
        </span>
        {renderTabs(props)}
      </div>
      <hr />
      <div
        className={cls}
        onClick={props.openAbout}
      >
        <Icon type="info-circle" /> {m('about')}
      </div>
      <div
        className={cls}
        onClick={props.openSetting}
      >
        <Icon type="setting" /> {s('settings')}
      </div>
      <div
        className={cls}
        onClick={() => window.getGlobal('openDevTools')()}
      >
        <Icon type="left-square" theme="filled" /> {m('toggledevtools')}
      </div>
      <hr />
      <div
        className={cls}
        onClick={() => window.getGlobal('minimize')()}
      >
        <Icon type="switcher" theme="filled" /> {m('minimize')}
      </div>
      <div
        className={cls}
        onClick={() => window.getGlobal('maximize')()}
      >
        <Icon type="layout" theme="filled" /> {m('maximize')}
      </div>
      <div
        className={cls}
        onClick={() => window.location.reload()}
      >
        <Icon type="reload" /> {m('reload')}
      </div>
      <hr />
      <div
        className={cls}
        onClick={props.onCheckUpdate}
      >
        <Icon type="up-circle" /> {e('checkForUpdate')}
      </div>
      <hr />
      <div
        className={cls}
        onClick={() => window.getGlobal('restart')()}
      >
        <Icon type="redo" /> {m('restart')}
      </div>
      <div
        className={cls}
        onClick={() => window.getGlobal('closeApp')()}
      >
        <Icon type="close" /> {m('close')}
      </div>
    </div>
  )
}

function onContextMenu (props) {
  let content = renderContext(props)
  props.openContextMenu({
    content,
    pos: {
      left: 40,
      top: 10
    }
  })
}

export default (props) => {
  return (
    <div
      className="menu-control"
      onMouseDown={evt => evt.preventDefault()}
      onClick={() => onContextMenu(props)}
      title={e('menu')}
    >
      <img src={logo} width={28} height={28} />
    </div>
  )
}
/*
new ssh
new terminal
---
history =>
sessions =>
---
about
settings
toggole dev tools
---
minimize
maxmize
reload
---
check updates
more => all other options
---
restart
exit
*/
