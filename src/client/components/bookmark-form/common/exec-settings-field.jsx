/**
 * bookmark form - exec settings field
 * Renders exec path and arguments fields for Windows/Mac/Linux
 */
import React from 'react'
import { Form, Input, Select, Space } from 'antd'
import { formItemLayout } from '../../../common/form-layout'

const FormItem = Form.Item

export default function ExecSettingsField () {
  const platforms = ['linux', 'mac', 'windows']
  return platforms.map((platform) => {
    const platformCapitalized = platform.charAt(0).toUpperCase() + platform.slice(1)
    const label = `exec${platformCapitalized}`
    return (
      <React.Fragment key={platform}>
        <FormItem
          {...formItemLayout}
          label={label}
        >
          <Space.Compact className='width-100'>
            <FormItem noStyle name={label}>
              <Input
                placeholder={`${platformCapitalized} exec path`}
                maxLength={500}
              />
            </FormItem>
            <FormItem
              noStyle
              name={`exec${platformCapitalized}Args`}
            >
              <Select
                mode='tags'
                placeholder={`${platformCapitalized} exec arguments`}
                tokenSeparators={['\n']}
              />
            </FormItem>
          </Space.Compact>
        </FormItem>
      </React.Fragment>
    )
  })
}
