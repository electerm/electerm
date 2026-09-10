/**
 * Reusable filter control: a filter icon button that opens a checkbox list.
 * Shared by the terminal info panel and the remote monitor bar.
 */
import { Popover } from 'antd'
import { CheckOutlined, FilterOutlined } from '@ant-design/icons'
import './item-filter.styl'

const e = window.translate

export default function ItemFilter (props) {
  const {
    ids = [],
    selected,
    onToggle,
    onOpenChange,
    placement = 'bottomRight',
    className = ''
  } = props
  const chosen = selected instanceof Set
    ? selected
    : new Set(selected || [])
  const title = e('filter')
  const total = ids.length
  const count = ids.filter(id => chosen.has(id)).length
  const content = (
    <div className='item-filter-list' role='menu'>
      {
        ids.map(id => {
          const active = chosen.has(id)
          return (
            <div
              aria-checked={active}
              className={'item-filter-item' + (active ? ' item-filter-item-on' : '')}
              data-filter-item={id}
              key={id}
              onClick={() => onToggle(id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onToggle(id)
                }
              }}
              role='menuitemcheckbox'
              tabIndex={0}
            >
              <span className='item-filter-check'>
                {active ? <CheckOutlined /> : null}
              </span>
              <span className='item-filter-label'>{e(id)}</span>
            </div>
          )
        })
      }
    </div>
  )
  return (
    <Popover
      content={content}
      onOpenChange={onOpenChange}
      placement={placement}
      title={title}
      trigger='click'
    >
      <button
        aria-label={`${title} (${count}/${total})`}
        className={'item-filter' + (className ? ` ${className}` : '')}
        title={title}
        type='button'
      >
        <FilterOutlined />
        <span className='item-filter-count'>({count}/{total})</span>
      </button>
    </Popover>
  )
}
