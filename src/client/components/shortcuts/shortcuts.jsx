import { Component } from '../common/react-subx'
import { isMac } from '../../common/constants'
import shortcutsDefaults from '../../common/shortcuts-defaults'
import {
  Table
} from 'antd'

const { prefix } = window
const e = prefix('form')
const s = prefix('shortcuts')

export default class Shortcuts extends Component {
  getConfig () {
    const { config } = window
    return shortcutsDefaults.reduce((c, prev) => {
      const keys = Object.keys(c).filter(d => d.startsWith('shortcut'))
      for (const k of keys) {
        const key = `${c.name}.${k}`
        prev[key] = c.readonly ? c[k] : (config[key] || c[k])
      }
      return prev
    }, {})
  }

  render () {
    const st = isMac ? 'shortcutMac' : 'shortcut'
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
          return name
        }
      },
      {
        title: s('shortcut'),
        dataIndex: st,
        key: st,
        render: (shortcut) => {
          return shortcut
        }
      }
    ]
    const props = {
      dataSource: src,
      columns,
      bordered: true,
      pagination: false,
      size: 'small',
      rowKey: 'id'
    }
    return (
      <Table
        {...props}
      />
    )
  }
}
