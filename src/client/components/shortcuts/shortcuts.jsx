import { PureComponent } from 'react'
import shortcutsDefaultsGen from './shortcuts-defaults'
import ShortcutEdit from './shortcut-editor'
import deepCopy from 'json-deep-copy'
import {
  Table,
  Button
} from 'antd'
import { isMacJs as isMac } from '../../common/constants.js'
import {
  getKeysTakenData
} from './shortcut-utils.js'

const e = window.translate

// translation when the key exists, else the English text from the default
function desc (key, text) {
  const lang = window.getLang ? window.getLang() : null
  return text && !(lang && lang[key]) ? text : e(key)
}
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
          desc: c.desc,
          // shortcuts that are unbound by default can be cleared again
          clearable: !c.readonly && !c[propName],
          shortcut: c.readonly ? c[propName] : (shortcuts[name] || c[propName])
        }
      })
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
        render: (name, inst) => {
          const [a, b] = name.split('_')
          const pre = a === 'terminal' ? `[${e('terminal')}] ` : ''
          return pre + desc(b, inst.desc)
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
              keysTaken={getKeysTakenData()}
              updateConfig={this.updateConfig}
              renderClear={inst.clearable}
              handleClear={() => this.updateConfig(inst.name, '')}
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
      <>
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
      </>
    )
  }
}
