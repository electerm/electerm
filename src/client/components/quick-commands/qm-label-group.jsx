/**
 * a collapsible label heading with the quick commands under it, used by
 * the quick command panel and the settings list
 */
import { CaretRightOutlined, TagOutlined } from '@ant-design/icons'
import classNames from 'classnames'

const e = window.translate

export default function QmLabelGroup (props) {
  const { label, count, collapsed, className, children } = props
  function handleToggle () {
    window.store.toggleQmLabelCollapsed(label)
  }
  return (
    <div className={classNames('qm-label-group', className, { collapsed })}>
      <div
        className='qm-label-head pointer'
        onClick={handleToggle}
        role='button'
        aria-expanded={!collapsed}
      >
        <CaretRightOutlined className='qm-label-caret' />
        <TagOutlined className={classNames('qm-label-icon', { 'qm-no-label': !label })} />
        <span className='qm-label-name elli'>
          {label || e('default')}
        </span>
        <span className='qm-label-count'>{count}</span>
      </div>
      {collapsed ? null : <div className='qm-label-items'>{children}</div>}
    </div>
  )
}
