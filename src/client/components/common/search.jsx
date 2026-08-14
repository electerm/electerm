/**
 * common search box
 *
 * Every consumer filters incrementally from onChange, so the submit button
 * antd's Input.Search renders could never trigger anything that had not
 * already happened -- pressing it was a no-op. The magnifier moves inside the
 * field, where it reads as a hint about what the box is for rather than as a
 * control that does something.
 */

import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'

export default function Search (props) {
  return (
    <Input
      allowClear
      prefix={<SearchOutlined className='search-icon-prefix' />}
      {...props}
    />
  )
}
