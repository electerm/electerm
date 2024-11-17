import { PureComponent } from 'react'
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

const e = window.translate
const shortcutsDefaults = shortcutsDefaultsGen()

export default class Shortcuts extends PureComponent {
  handleResetAll = () => {
    window.store.updateConfig({
      shortcuts: {}
    })
  }

  updateConfig = (name, value) => {
    const { config } = this.props
    const shortcuts = deepCopy(config.shortcuts || {})
    shortcuts[name] = value
    window.store.updateConfig({
      shortcuts
    })
  }

  getData () {
    const { shortcuts = {} } = this.props.config
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
    const { config, quickCommands = [] } = this.props
    const { shortcuts = {} } = config

    // Gather system shortcuts
    const systemShortcuts = shortcutsDefaults.reduce((p, k) => {
      const propName = isMac ? 'shortcutMac' : 'shortcut'
      const name = k.name + '_' + propName
      const vv = k.readonly ? k[propName] : (shortcuts[name] || k[propName])
      const v = vv
        .split(',')
        .map(f => f.trim())
        .reduce((p, k) => ({
          ...p,
          [k]: true
        }), {})
      return {
        ...p,
        ...v
      }
    }, {})

    // Gather quick command shortcuts
    const quickCommandShortcuts = quickCommands.reduce((acc, command) => {
      if (command.shortcut) {
        acc[command.shortcut] = true
      }
      return acc
    }, {})

    // Combine system shortcuts and quick command shortcuts
    return {
      ...systemShortcuts,
      ...quickCommandShortcuts
    }
  }

  render () {
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
          const pre = a === 'terminal' ? `[${e('terminal')}] ` : ''
          return pre + e(b)
        }
      },
      {
        title: e('settingShortcuts'),
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
            {e('resetAllToDefault')}
          </Button>
        </div>
      </div>
    )
  }
}
