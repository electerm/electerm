import {
  Form,
  InputNumber,
  Space,
  Button,
  Input,
  Tag
} from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { formItemLayout } from '../../common/form-layout'
import HelpIcon from '../common/help-icon'
import { copy } from '../../common/clipboard'
import { useRef } from 'react'

const FormItem = Form.Item
const FormList = Form.List
const e = window.translate

export default function renderQm () {
  const focused = useRef(0)
  function renderItem (field, i, add, remove) {
    return (
      <Space
        align='center'
        key={field.key}
      >
        <FormItem
          label=''
          name={[field.name, 'delay']}
          required
        >
          <InputNumber
            min={1}
            step={1}
            max={65535}
            addonBefore={e('delay')}
            placeholder={100}
            className='compact-input'
          />
        </FormItem>
        <FormItem
          label=''
          name={[field.name, 'command']}
          required
          className='mg2x'
        >
          <Input.TextArea
            autoSize={{ minRows: 1 }}
            placeholder={e('quickCommand')}
            className='compact-input qm-input'
            onFocus={() => {
              focused.current = i
            }}
          />
        </FormItem>
        <Button
          icon={<MinusCircleOutlined />}
          onClick={() => remove(field.name)}
          className='mg24b'
        />
      </Space>
    )
  }
  const commonCmds = [
    { cmd: 'ls', desc: 'List directory contents' },
    { cmd: 'cd', desc: 'Change the current directory' },
    { cmd: 'pwd', desc: 'Print the current working directory' },
    { cmd: 'cp', desc: 'Copy files and directories' },
    { cmd: 'mv', desc: 'Move/rename files and directories' },
    { cmd: 'rm', desc: 'Remove files or directories' },
    { cmd: 'mkdir', desc: 'Create new directories' },
    { cmd: 'rmdir', desc: 'Remove empty directories' },
    { cmd: 'touch', desc: 'Create empty files or update file timestamps' },
    { cmd: 'chmod', desc: 'Change file modes or Access Control Lists' },
    { cmd: 'chown', desc: 'Change file owner and group' },
    { cmd: 'cat', desc: 'Concatenate and display file content' },
    { cmd: 'echo', desc: 'Display message or variable value' },
    { cmd: 'grep', desc: 'Search text using patterns' },
    { cmd: 'find', desc: 'Search for files in a directory hierarchy' },
    { cmd: 'df', desc: 'Report file system disk space usage' },
    { cmd: 'du', desc: 'Estimate file space usage' },
    { cmd: 'top', desc: 'Display Linux tasks' },
    { cmd: 'ps', desc: 'Report a snapshot of current processes' },
    { cmd: 'kill', desc: 'Send a signal to a process' }
  ]

  const cmds = commonCmds.map(c => {
    return (
      <Tag
        title={c.desc}
        key={c.cmd}
        onClick={() => {
          copy(c.cmd)
        }}
      >
        <b className='pointer'>{c.cmd}</b>
      </Tag>
    )
  })
  const label = (
    <div>
      {e('commonCommands')}
      <HelpIcon
        title={cmds}
      />
    </div>
  )
  return (
    <FormItem {...formItemLayout} label={label}>
      <FormList
        name='commands'
      >
        {
          (fields, { add, remove }, { errors }) => {
            return (
              <div>
                {
                  fields.map((field, i) => {
                    return renderItem(field, i, add, remove)
                  })
                }
                <FormItem>
                  <Button
                    type='dashed'
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    {e('quickCommand')}
                  </Button>
                </FormItem>
              </div>
            )
          }
        }
      </FormList>
    </FormItem>
  )
}
