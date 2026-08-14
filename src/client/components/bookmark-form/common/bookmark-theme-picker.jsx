import { Form, Input } from 'antd'
import classnames from 'classnames'
import { CheckOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { settingMap } from '../../../common/constants'
import isColorDark from '../../../common/is-color-dark'

const FormItem = Form.Item

export default function BookmarkThemePicker ({ name, form, store }) {
  const selected = Form.useWatch(name, form)
  const themes = store.getSidebarList(settingMap.terminalThemes)

  function pick (id) {
    form.setFieldsValue({ [name]: id })
  }

  return (
    <div className='bookmark-theme-picker'>
      <FormItem name={name} noStyle>
        <Input type='hidden' />
      </FormItem>
      <div
        className={classnames('bookmark-theme-picker-item', 'bookmark-theme-picker-global', { 'is-selected': !selected })}
        onClick={() => pick('')}
      >
        <span>Use global theme</span>
        {!selected ? <CheckOutlined /> : null}
      </div>
      <div className='bookmark-theme-picker-grid'>
        {
          themes.map(t => {
            const dark = isColorDark(t.uiThemeConfig?.main)
            return (
              <div
                key={t.id}
                className={classnames('bookmark-theme-picker-item', { 'is-selected': selected === t.id })}
                onClick={() => pick(t.id)}
              >
                <span className='bookmark-theme-picker-swatches'>
                  <span style={{ background: t.themeConfig?.background }} />
                  <span style={{ background: t.themeConfig?.red }} />
                  <span style={{ background: t.themeConfig?.green }} />
                  <span style={{ background: t.themeConfig?.blue }} />
                  <span style={{ background: t.themeConfig?.yellow }} />
                </span>
                {
                  dark
                    ? <MoonOutlined className='bookmark-theme-picker-mode' title='Dark theme' />
                    : <SunOutlined className='bookmark-theme-picker-mode' title='Light theme' />
                }
                <span className='bookmark-theme-picker-name elli'>{t.name}</span>
                {selected === t.id ? <CheckOutlined className='bookmark-theme-picker-check' /> : null}
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
