/**
 * btns
 */

import { Component } from '../common/react-subx'
import { Icon, Button } from 'antd'
import { ctrlOrCmd } from '../../common/constants'
import createTitle from '../../common/create-title'
import Context from '../common/context-menu'
import BookmarksList from '../sidebar/bookmark-select'
import './system-menu.styl'

const { prefix } = window
const e = prefix('control')
const m = prefix('menu')
const c = prefix('common')
const t = prefix('tabs')
const s = prefix('setting')
const { Group } = Button

function renderBookmarks (store) {
  return (
    <div className='sub-context-menu bookmarks-sub-context-menu'>
      <BookmarksList
        store={store}
      />
    </div>
  )
}

function renderTabs (store) {
  return (
    <div className='sub-context-menu'>
      {
        store.tabs.map(item => {
          const title = createTitle(item)
          return (
            <div
              className='sub-context-menu-item'
              title={title}
              onClick={() => store.onChangeTabId(item.id)}
            >
              {title}
            </div>
          )
        })
      }
    </div>
  )
}

function renderHistory (store) {
  return (
    <div className='sub-context-menu'>
      {
        store.history.map(item => {
          const title = createTitle(item)
          return (
            <div
              className='sub-context-menu-item'
              title={title}
              onClick={() => store.onSelectHistory(item.id)}
            >
              {title}
            </div>
          )
        })
      }
    </div>
  )
}

function renderContext (store) {
  const cls = 'pd2x pd1y context-item pointer'
  const cls1 = cls + ' with-sub-menu'
  return (
    <div className='menus'>
      <div
        className={cls}
        onClick={store.onNewSsh}
      >
        <Icon type='code' theme='filled' /> {e('newSsh')}
        <span className='context-sub-text'>{ctrlOrCmd}+N</span>
      </div>
      <div
        className={cls}
        onClick={() => store.addTab()}
      >
        <Icon type='right-square' theme='filled' /> {t('newTab')}
      </div>
      <hr />
      <div
        className={cls1 + ' no-auto-close-context'}
      >
        <Icon type='book' /> {c('bookmarks')}
        <span className='context-sub-text'>
          <Icon type='right' />
        </span>
        {renderBookmarks(store)}
      </div>
      <div
        className={cls1}
      >
        <Icon type='clock-circle' /> {c('history')}
        <span className='context-sub-text'>
          <Icon type='right' />
        </span>
        {renderHistory(store)}
      </div>
      <div
        className={cls1}
      >
        <Icon type='bars' /> {t('sessions')}
        <span className='context-sub-text'>
          <Icon type='right' />
        </span>
        {renderTabs(store)}
      </div>
      <hr />
      <div
        className={cls}
        onClick={store.openAbout}
      >
        <Icon type='info-circle' /> {m('about')}
      </div>
      <div
        className={cls}
        onClick={store.openSetting}
      >
        <Icon type='setting' /> {s('settings')}
      </div>
      <div
        className={cls}
        onClick={() => window.getGlobal('openDevTools')()}
      >
        <Icon type='left-square' theme='filled' /> {m('toggledevtools')}
      </div>
      <hr />
      <div
        className={cls + ' no-auto-close-context'}
      >
        <Group size='small'>
          <span className='mg1r iblock'>
            {store.config.zoom * 100}
          </span>
          <Button onClick={() => store.zoom(0.5, true)}>
            <Icon type='plus-circle' />
          </Button>
          <Button onClick={() => store.zoom(-0.5, true)}>
            <Icon type='minus-circle' />
          </Button>
          <Button onClick={() => store.zoom()}>
            100%
          </Button>
        </Group>
      </div>
      <div
        className={cls}
        onClick={() => window.getGlobal('minimize')()}
      >
        <Icon type='switcher' theme='filled' /> {m('minimize')}
      </div>
      <div
        className={cls}
        onClick={() => window.getGlobal('maximize')()}
      >
        <Icon type='layout' theme='filled' /> {m('maximize')}
      </div>
      <div
        className={cls}
        onClick={() => window.location.reload()}
      >
        <Icon type='reload' /> {m('reload')}
      </div>
      <hr />
      <div
        className={cls}
        onClick={store.onCheckUpdate}
      >
        <Icon type='up-circle' /> {e('checkForUpdate')}
      </div>
      <hr />
      <div
        className={cls}
        onClick={store.restart}
      >
        <Icon type='redo' /> {m('restart')}
      </div>
      <div
        className={cls}
        onClick={store.exit}
      >
        <Icon type='close' /> {m('close')}
      </div>
    </div>
  )
}

export default class SystemMenu extends Component {
  render () {
    const { store } = this.props
    return (
      <Context
        content={renderContext(store)}
        visible={store.menuOpened}
        className='context-menu system-menu'
        closeContextMenu={store.closeMenu}
        pos={{
          left: 40,
          top: 10
        }}
        key='menu-item-wrap'
      />
    )
  }
}
