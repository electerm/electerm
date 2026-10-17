import {
  Form,
  InputNumber,
  Select,
  Checkbox,
  Button,
  Input,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  HolderOutlined,
  DeleteOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined
} from '@ant-design/icons'
import HelpIcon from '../common/help-icon'
import { copy } from '../../common/clipboard'
import { isDropAfterHalf, setDropIndicator, clearDropIndicator } from '../../common/drop-position'
import { keyOptions } from '../terminal/automation/key-sequences'
import translateOr from '../../common/translate-fallback'
import generate from '../../common/uid'
import { defaultWaitTimeout } from '../../common/quick-command-steps'
import { useRef } from 'react'

const FormItem = Form.Item
const FormList = Form.List
const e = window.translate

const keySelectOptions = keyOptions.map(k => ({ value: k, label: k }))

export function newStep (type = 'command') {
  if (type === 'key') {
    return { id: generate(), type: 'key', key: 'Enter', repeat: 1, delay: 0 }
  }
  if (type === 'wait') {
    return { id: generate(), type: 'wait', text: '', timeout: defaultWaitTimeout, delay: 0 }
  }
  return { id: generate(), type: 'command', command: '', enter: true, delay: 0 }
}

const waitForTextLabel = () => translateOr('waitForText', 'Wait for text')

// One step per row: type, name, command, key or text to wait for, then
// Enter, repeat or timeout, and the delay before the step. Rows are dragged by the handle only, so text in
// the inputs can still be selected with the mouse.
function StepRow (props) {
  const { field, index, form, remove, add, drag, focused } = props
  const type = Form.useWatch(['commands', field.name, 'type'], form)
  const isKey = type === 'key'
  const isWait = type === 'wait'
  const typeOptions = [
    { value: 'command', label: e('command') },
    { value: 'key', label: translateOr('key', 'Key') },
    { value: 'wait', label: waitForTextLabel() }
  ]
  function onTypeChange (v) {
    const step = form.getFieldValue(['commands', field.name]) || {}
    const next = newStep(v)
    form.setFieldValue(['commands', field.name], {
      ...next,
      id: step.id || next.id,
      name: step.name,
      delay: step.delay
    })
  }
  function renderValue () {
    if (isKey) {
      return (
        <FormItem name={[field.name, 'key']} noStyle>
          <Select
            showSearch
            options={keySelectOptions}
            className='width-100'
          />
        </FormItem>
      )
    }
    if (isWait) {
      return (
        <FormItem name={[field.name, 'text']} noStyle>
          <Input
            placeholder={translateOr('textToWaitFor', 'Text to wait for, such as Password:')}
            className='qm-input'
            spellCheck={false}
          />
        </FormItem>
      )
    }
    return (
      <FormItem name={[field.name, 'command']} noStyle>
        <Input.TextArea
          autoSize={{ minRows: 1 }}
          placeholder={e('command')}
          className='qm-input'
          spellCheck={false}
          onFocus={() => {
            focused.current = index
          }}
        />
      </FormItem>
    )
  }
  function renderOption () {
    if (isKey) {
      return (
        <Tooltip title={translateOr('repeat', 'Repeat')}>
          <FormItem name={[field.name, 'repeat']} noStyle>
            <InputNumber
              min={1}
              max={100}
              prefix='×'
              className='width-100'
            />
          </FormItem>
        </Tooltip>
      )
    }
    if (isWait) {
      return (
        <Tooltip title={translateOr('waitTimeout', 'Timeout in seconds, 0 waits with no limit')}>
          <FormItem name={[field.name, 'timeout']} noStyle>
            <InputNumber
              min={0}
              max={86400}
              placeholder={defaultWaitTimeout}
              suffix='s'
              className='width-100'
            />
          </FormItem>
        </Tooltip>
      )
    }
    return (
      <FormItem
        name={[field.name, 'enter']}
        valuePropName='checked'
        noStyle
      >
        <Checkbox>{e('enter')}</Checkbox>
      </FormItem>
    )
  }
  return (
    <div
      className='qm-step-row'
      onDragOver={ev => drag.over(ev)}
      onDragLeave={ev => drag.leave(ev)}
      onDrop={ev => drag.drop(ev, index)}
      onDragEnd={ev => drag.end(ev)}
    >
      <span
        className='qm-step-drag drag'
        draggable
        onDragStart={ev => drag.start(ev, index)}
      >
        <HolderOutlined />
      </span>
      <span className='qm-step-index'>{index + 1}</span>
      <FormItem name={[field.name, 'type']} noStyle>
        <Select
          className='qm-step-type'
          options={typeOptions}
          onChange={onTypeChange}
          popupMatchSelectWidth={false}
        />
      </FormItem>
      <FormItem
        name={[field.name, 'name']}
        noStyle
        rules={[{ max: 100, message: '100 chars max' }]}
      >
        <Input
          placeholder={e('name')}
          className='qm-step-name'
          maxLength={100}
        />
      </FormItem>
      <div className='qm-step-value'>
        {renderValue()}
      </div>
      <div className='qm-step-option'>
        {renderOption()}
      </div>
      <Tooltip title={translateOr('delayBeforeStep', 'Wait before this step')}>
        <FormItem name={[field.name, 'delay']} noStyle>
          <InputNumber
            min={0}
            max={3600000}
            step={100}
            placeholder={100}
            suffix='ms'
            className='qm-step-delay'
          />
        </FormItem>
      </Tooltip>
      <span className='qm-step-ops'>
        <Button
          size='small'
          type='text'
          icon={<VerticalAlignTopOutlined />}
          title={translateOr('insertAbove', 'Insert above')}
          onClick={() => add(newStep(), index)}
        />
        <Button
          size='small'
          type='text'
          icon={<VerticalAlignBottomOutlined />}
          title={translateOr('insertBelow', 'Insert below')}
          onClick={() => add(newStep(), index + 1)}
        />
        <Button
          size='small'
          type='text'
          danger
          icon={<DeleteOutlined />}
          title={e('del')}
          onClick={() => remove(field.name)}
        />
      </span>
    </div>
  )
}

export default function renderQm (form) {
  const focused = useRef(0)
  const dragIndexRef = useRef(null)

  const drag = {
    start (ev, index) {
      dragIndexRef.current = index
      ev.dataTransfer.effectAllowed = 'move'
      ev.dataTransfer.setData('text/plain', String(index))
      const row = ev.currentTarget.closest('.qm-step-row')
      if (row) {
        ev.dataTransfer.setDragImage(row, 10, 10)
        row.classList.add('qm-field-dragging')
      }
    },
    over (ev) {
      if (dragIndexRef.current === null) {
        return
      }
      ev.preventDefault()
      ev.dataTransfer.dropEffect = 'move'
      setDropIndicator(ev.currentTarget, isDropAfterHalf(ev, ev.currentTarget))
    },
    leave (ev) {
      clearDropIndicator(ev.currentTarget)
    },
    drop (ev, index) {
      ev.preventDefault()
      const row = ev.currentTarget
      clearDropIndicator(row)
      const dragIndex = dragIndexRef.current
      dragIndexRef.current = null
      if (dragIndex === null || dragIndex === index) {
        return
      }
      // bottom half of the row => insert after it, so the last
      // step can receive a drop (append to the end).
      const commands = [...(form.getFieldValue('commands') || [])]
      const [item] = commands.splice(dragIndex, 1)
      let insertIndex = isDropAfterHalf(ev, row) ? index + 1 : index
      if (dragIndex < insertIndex) {
        insertIndex = insertIndex - 1
      }
      commands.splice(insertIndex, 0, item)
      form.setFieldValue('commands', commands)
    },
    end (ev) {
      dragIndexRef.current = null
      ev.currentTarget.closest('.qm-step-row')?.classList.remove('qm-field-dragging')
    }
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
      <Button
        title={c.desc}
        type='text'
        key={c.cmd}
        size='small'
        onClick={() => {
          copy(c.cmd)
        }}
      >
        <b className='pointer'>{c.cmd}</b>
      </Button>
    )
  })
  const label = (
    <div>
      {translateOr('steps', 'Steps')}
      <HelpIcon
        title={cmds}
      />
    </div>
  )
  return (
    <FormItem label={label}>
      <FormList
        name='commands'
      >
        {
          (fields, { add, remove }) => {
            return (
              <div className='qm-steps'>
                {
                  fields.length
                    ? (
                      <div className='qm-step-row qm-step-head'>
                        <span className='qm-step-drag' />
                        <span className='qm-step-index'>#</span>
                        <span className='qm-step-type'>{e('type')}</span>
                        <span className='qm-step-name'>{e('name')}</span>
                        <span className='qm-step-value'>{e('command')} / {translateOr('key', 'Key')}</span>
                        <span className='qm-step-option' />
                        <span className='qm-step-delay'>{translateOr('delay', 'Delay')}</span>
                        <span className='qm-step-ops' />
                      </div>
                      )
                    : null
                }
                {
                  fields.map((field, i) => (
                    <StepRow
                      key={field.key}
                      field={field}
                      index={i}
                      form={form}
                      remove={remove}
                      add={add}
                      drag={drag}
                      focused={focused}
                    />
                  ))
                }
                <FormItem className='mg1t'>
                  <Button
                    type='dashed'
                    onClick={() => add(newStep())}
                    icon={<PlusOutlined />}
                    className='mg1r'
                  >
                    {e('command')}
                  </Button>
                  <Button
                    type='dashed'
                    onClick={() => add(newStep('key'))}
                    icon={<PlusOutlined />}
                    className='mg1r'
                  >
                    {translateOr('key', 'Key')}
                  </Button>
                  <Button
                    type='dashed'
                    onClick={() => add(newStep('wait'))}
                    icon={<PlusOutlined />}
                  >
                    {waitForTextLabel()}
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
