import { Component } from '../common/react-subx'
import shortcutsDefaultsGen from './shortcuts-defaults'
import ShortcutEdit from './shortcut-editor'
import deepCopy from 'json-deep-copy'
import {
  Table,
  Button
} from 'antd'
import {
  isMacJs as isMac
} from '../../common/constants.js'

const { prefix } = window
const e = prefix('form')
const c = prefix('control')
const m = prefix('menu')
const ss = prefix('ssh')
const s = prefix('setting')
const shortcutsDefaults = shortcutsDefaultsGen()

export default class Shortcuts extends Component {
  handleResetAll = () => {
    this.props.store.updateConfig({
      shortcuts: {}
    })
  }

  updateConfig = (name, value) => {
    const { store } = this.props
    const shortcuts = deepCopy(store.config.shortcuts || {})
    shortcuts[name] = value
    this.props.store.updateConfig({
      shortcuts
    })
  }

  getData () {
    const { shortcuts = {} } = this.props.store.config
    return shortcutsDefaults
      .filter(g => !g.readonly)
      .map((c, i) => {
        const propName = isMac ? 'shortcutMac' : 'shortcut'
        const name = c.name + '_' + propName
        return {
          index: i + 1,
          name,
          readonly: c.readonly,
          shortcut: c.readonly ? c[propName] : (shortcuts[name] || c[propName])
        }
      })
  }

  getKeysTakenData = () => {
    const { shortcuts = {} } = this.props.store.config
    return shortcutsDefaults
      .reduce((p, k) => {
        const propName = isMac ? 'shortcutMac' : 'shortcut'
        const name = k.name + '_' + propName
        const vv = k.readonly ? k[propName] : (shortcuts[name] || k[propName])
        const v = vv
          .split(',')
          .map(f => f.trim())
          .reduce((p, k, i) => {
            return {
              ...p,
              [k]: true
            }
          }, {})
        return {
          ...p,
          ...v
        }
      }, {})
  }

  render () {
    const { store } = this.props
    const columns = [
      {
        title: 'NO.',
        dataIndex: 'index',
        key: 'index',
        render: (index) => {
          return index
        }
      },
      {
        title: e('description'),
        dataIndex: 'name',
        key: 'name',
        render: (name) => {
          const [a, b] = name.split('_')
          const pre = a === 'terminal' ? `[${ss('terminal')}] ` : ''
          if (
            [
              'clear', 'selectAll', 'search', 'split'
            ].includes(b)
          ) {
            return pre + ss(b)
          } else if (b === 'copy') {
            return pre + m(b)
          } else if (b === 'newBookmark') {
            return pre + c(b)
          } else if (b.includes('zoomin')) {
            return pre + m('zoomin')
          } else if (b.includes('zoomout')) {
            return pre + m('zoomout')
          } else if (['togglefullscreen'].includes(b)) {
            return pre + m(b)
          } else {
            return pre + s(b)
          }
        }
      },
      {
        title: s('shortcut'),
        dataIndex: 'shortcut',
        key: 'shortcut',
        render: (shortcut, inst) => {
          const { readonly } = inst
          if (readonly) {
            return (
              <span className='readonly'>
                {
                  shortcut.split(',').map(s => {
                    return (
                      <span className='shortcut-unit' key={s}>{s}</span>
                    )
                  })
                }
              </span>
            )
          }
          return (
            <ShortcutEdit
              data={inst}
              keysTaken={this.getKeysTakenData()}
              store={store}
              updateConfig={this.updateConfig}
            />
          )
        }
      }
    ]
    const props = {
      dataSource: this.getData(),
      columns,
      bordered: true,
      pagination: false,
      size: 'small',
      rowKey: 'id'
    }
    return (
      <div>
        <Table
          {...props}
        />
        <div className='pd1y'>
          <Button
            onClick={this.handleResetAll}
          >
            {s('resetAllToDefault')}
          </Button>
        </div>
      </div>
    )
  }
}
