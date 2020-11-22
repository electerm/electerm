/**
 * btns
 */

import { Component } from '../common/react-subx'

import {
  BarsOutlined,
  BookOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  CodeFilled,
  InfoCircleOutlined,
  LayoutFilled,
  LeftSquareFilled,
  MinusCircleOutlined,
  PlusCircleOutlined,
  RedoOutlined,
  ReloadOutlined,
  RightOutlined,
  RightSquareFilled,
  SettingOutlined,
  SwitcherFilled,
  UpCircleOutlined
} from '@ant-design/icons'

import { Button } from 'antd'
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
              key={item.id}
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
              key={item.id}
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
        <CodeFilled /> {e('newSsh')}
        <span className='context-sub-text'>{ctrlOrCmd}+N</span>
      </div>
      <div
        className={cls}
        onClick={() => store.addTab()}
      >
        <RightSquareFilled /> {t('newTab')}
      </div>
      <hr />
      <div
        className={cls1 + ' no-auto-close-context'}
      >
        <BookOutlined /> {c('bookmarks')}
        <span className='context-sub-text'>
          <RightOutlined />
        </span>
        {renderBookmarks(store)}
      </div>
      <div
        className={cls1}
      >
        <ClockCircleOutlined /> {c('history')}
        <span className='context-sub-text'>
          <RightOutlined />
        </span>
        {renderHistory(store)}
      </div>
      <div
        className={cls1}
      >
        <BarsOutlined /> {t('sessions')}
        <span className='context-sub-text'>
          <RightOutlined />
        </span>
        {renderTabs(store)}
      </div>
      <hr />
      <div
        className={cls}
        onClick={store.openAbout}
      >
        <InfoCircleOutlined /> {m('about')}
      </div>
      <div
        className={cls}
        onClick={store.openSetting}
      >
        <SettingOutlined /> {s('settings')}
      </div>
      <div
        className={cls}
        onClick={() => window.pre.runGlobalAsync('openDevTools')}
      >
        <LeftSquareFilled /> {m('toggledevtools')}
      </div>
      <hr />
      <div
        className={cls + ' no-auto-close-context'}
      >
        <Group size='small'>
          <span className='mg1r iblock'>
            {store.config.zoom * 100}
          </span>
          <Button onClick={() => store.zoom(0.25, true)}>
            <PlusCircleOutlined />
          </Button>
          <Button onClick={() => store.zoom(-0.25, true)}>
            <MinusCircleOutlined />
          </Button>
          <Button onClick={() => store.zoom()}>
            100%
          </Button>
        </Group>
      </div>
      <div
        className={cls}
        onClick={() => window.pre.runGlobalAsync('minimize')}
      >
        <SwitcherFilled /> {m('minimize')}
      </div>
      <div
        className={cls}
        onClick={() => window.pre.runGlobalAsync('maximize')}
      >
        <LayoutFilled /> {m('maximize')}
      </div>
      <div
        className={cls}
        onClick={() => window.location.reload()}
      >
        <ReloadOutlined /> {m('reload')}
      </div>
      <hr />
      <div
        className={cls}
        onClick={store.onCheckUpdate}
      >
        <UpCircleOutlined /> {e('checkForUpdate')}
      </div>
      <hr />
      <div
        className={cls}
        onClick={store.restart}
      >
        <RedoOutlined /> {m('restart')}
      </div>
      <div
        className={cls}
        onClick={store.exit}
      >
        <CloseOutlined /> {m('close')}
      </div>
    </div>
  )
}

export default class SystemMenu extends Component {
  render () {
    const { store } = this.props
    const ext = {
      pos: {
        left: 40,
        top: 10
      },
      content: renderContext(store)
    }
    return (
      <Context
        visible={store.menuOpened}
        className='context-menu system-menu'
        closeContextMenu={store.closeMenu}
        key='menu-item-wrap'
        count={15}
        {...ext}
      />
    )
  }
}
