import { useRef } from 'react'
import { Button, Input, message, Upload, Form } from 'antd'
import { convertTheme, convertThemeToText, exportTheme, validThemeProps, requiredThemeProps } from '../../common/terminal-theme'
import { defaultTheme, defaultThemeLight } from '../../common/constants'
import generate from '../../common/uid'
import Link from '../common/external-link'
import InputAutoFocus from '../common/input-auto-focus'

const { TextArea } = Input
const FormItem = Form.Item
const { prefix } = window
const e = prefix('form')
const s = prefix('setting')
const t = prefix('terminalThemes')

export default function ThemeForm (props) {
  const [form] = Form.useForm()
  const action = useRef('submit')
  function exporter () {
    exportTheme(props.formData.id)
  }
  function saveOnly () {
    action.current = 'saveOnly'
    form.submit()
  }
  // A function to validate the input text
  async function validateInput (_, value) {
    const input = value
      .split('\n')
      .reduce((p, line) => {
        const [name, value] = line.split('=')
        if (!name.trim() || !value.trim()) {
          return p
        }
        p[name.trim()] = value.trim()
        return p
      }, {})

    // A regex to test the hex color format
    const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

    // A regex to test the rgba color format
    const rgbaColorRegex = /^rgba\(\d{1,3}, +\d{1,3}, +\d{1,3}, +(0|0?\.\d+|1)\)$/

    // A message to store the error message
    let message = ''

    // Loop through the required props
    for (const prop of requiredThemeProps) {
    // Check if the input has the prop
      if (!input[prop]) {
      // If not, set the flag to false and append the message
        message += `Missing prop: ${prop}\n`
        // Skip the rest of the loop
        continue
      }

      // Check if the prop starts with terminal:
      if (prop.startsWith('terminal:')) {
      // If yes, check if the prop value is a valid rgba color format
        if (!rgbaColorRegex.test(input[prop]) && !hexColorRegex.test(input[prop])) {
        // If not, set the flag to false and append the message
          message += `Invalid color format for prop: ${prop}\n`
          // Skip the rest of the loop
          continue
        }
      } else {
      // If no, check if the prop value is a valid hex color format
        if (!hexColorRegex.test(input[prop])) {
        // If not, set the flag to false and append the message
          message += `Invalid hex color format for prop: ${prop}\n`
          // Skip the rest of the loop
          continue
        }
      }
    }

    const keys = Object.keys(input)
    for (const key of keys) {
      if (!validThemeProps.includes(key)) {
        message += `Not supported prop: ${key}\n`
      }
    }
    if (message) {
      return Promise.reject(message)
    }
    // Return an object with the flag and the message
    return Promise.resolve()
  }

  async function handleSubmit (res) {
    const { formData } = props
    const {
      themeName,
      themeText
    } = res
    const update = {
      name: themeName,
      ...convertTheme(themeText)
    }
    const update1 = {
      ...update,
      id: generate()
    }
    if (formData.id) {
      props.store.editTheme(formData.id, update)
    } else {
      props.store.addTheme(update1)
      props.store.storeAssign({
        item: update1
      })
    }
    if (action.current !== 'saveOnly') {
      props.store.setTheme(
        formData.id || update1.id
      )
    }
    message.success(s('saved'))
    action.current = 'submit'
  }

  function renderSrc (type) {
    if (type === 'iterm') {
      const url = `https://github.com/mbadolato/iTerm2-Color-Schemes/blob/master/electerm/${encodeURIComponent(themeName)}.txt`
      return (
        <FormItem>
          <span className='mg1r'>src:</span>
          <Link
            to={url}
          >{url}
          </Link>
        </FormItem>
      )
    }
    return null
  }

  async function beforeUpload (file) {
    const txt = await window.fs.readFile(file.path)
    const { name, themeConfig, uiThemeConfig } = convertTheme(txt)
    form.setFieldsValue({
      themeName: name,
      themeText: convertThemeToText({
        themeConfig, uiThemeConfig
      })
    })
    return false
  }

  function renderFuncs (id) {
    if (!id) {
      return null
    }
    return (
      <FormItem>
        <Button
          type='dashed'
          onClick={exporter}
        >
          {t('export')}
        </Button>
      </FormItem>
    )
  }

  const {
    readonly,
    id,
    type,
    name: themeName
  } = props.formData
  const initialValues = {
    themeName,
    themeText: convertThemeToText(props.formData)
  }
  const { autofocustrigger } = props.store
  const isDefaultTheme = id === defaultTheme.id || id === defaultThemeLight.id
  const disabled = readonly || isDefaultTheme
  return (
    <Form
      onFinish={handleSubmit}
      form={form}
      initialValues={initialValues}
      className='form-wrap'
      name='terminal-theme-form'
      layout='vertical'
    >
      {renderFuncs(id)}
      <FormItem
        label={t('themeName')}
        hasFeedback
        name='themeName'
        rules={[{
          max: 30, message: '30 chars max'
        }, {
          required: true, message: 'theme name required'
        }]}
      >
        <InputAutoFocus
          selectall='yes'
          disabled={disabled}
          autofocustrigger={autofocustrigger}
        />
      </FormItem>
      <FormItem
        label={t('themeConfig')}
      >
        <div className='pd1b'>
          <Upload
            beforeUpload={beforeUpload}
            fileList={[]}
            className='mg1b'
          >
            <Button
              type='dashed'
              disabled={disabled}
            >
              {e('importFromFile')}
            </Button>
          </Upload>
        </div>
        <FormItem
          noStyle
          name='themeText'
          hasFeedback
          rules={[{
            max: 1000, message: '1000 chars max'
          }, {
            required: true,
            message: 'theme config required'
          }, {
            validator: validateInput
          }]}
        >
          <TextArea rows={33} disabled={disabled} />
        </FormItem>
      </FormItem>
      {
        disabled
          ? null
          : (
            <FormItem>
              <p>
                <Button
                  type='primary'
                  htmlType='submit'
                  className='mg1r mg1b'
                >{t('saveAndApply')}
                </Button>
                <Button
                  type='dashed'
                  className='mg1r mg1b'
                  onClick={saveOnly}
                >{e('save')}
                </Button>
              </p>
            </FormItem>
            )
      }
      {
        renderSrc(type)
      }
    </Form>
  )
}
