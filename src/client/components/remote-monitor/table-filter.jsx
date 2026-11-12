/**
 * One filter control per monitor section (see buildTableFilters for the column
 * opt-in). It sits right beside the section title instead of in the column
 * headers: these tables live in a 488px popover and their columns are 52-96px
 * wide, so a per-column funnel would fight the column title for space.
 *
 * The control is the app's existing ItemFilter look — `.item-filter` for the
 * funnel and `.item-filter-item` for a checkable row — with one group per
 * filterable column stacked on top of each other.
 */
import { Button, Popover } from 'antd'
import { CheckOutlined, FilterOutlined } from '@ant-design/icons'
import { countTableFilters } from './monitor-model'
import '../common/item-filter.styl'
import './table-filter.styl'

const e = window.translate

function toggled (selected, key, value) {
  const current = selected[key] || []
  const next = current.includes(value)
    ? current.filter(item => item !== value)
    : [...current, value]
  const result = { ...selected }
  if (next.length) {
    result[key] = next
  } else {
    delete result[key]
  }
  return result
}

export default function TableFilter (props) {
  const {
    groups,
    selected,
    onChange,
    onOpenChange
  } = props
  const count = countTableFilters(selected)
  const title = e('filter')
  const content = (
    <div className='table-filter-panel'>
      {
        groups.map(group => (
          <div className='table-filter-group' key={group.key}>
            <div className='table-filter-group-title'>{group.title}</div>
            <div className='item-filter-list' role='menu'>
              {
                group.values.map(value => {
                  const active = (selected[group.key] || []).includes(value)
                  return (
                    <div
                      aria-checked={active}
                      className={'item-filter-item' + (active ? ' item-filter-item-on' : '')}
                      data-filter-value={value}
                      key={value}
                      onClick={() => onChange(toggled(selected, group.key, value))}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onChange(toggled(selected, group.key, value))
                        }
                      }}
                      role='menuitemcheckbox'
                      tabIndex={0}
                      title={value}
                    >
                      <span className='item-filter-check'>
                        {active ? <CheckOutlined /> : null}
                      </span>
                      <span className='item-filter-label'>{value}</span>
                    </div>
                  )
                })
              }
            </div>
          </div>
        ))
      }
    </div>
  )
  return (
    <Popover
      content={content}
      onOpenChange={onOpenChange}
      placement='bottomRight'
      // Reset lives in the title, not under the list: the list is capped at 320px
      // and a `ps` output can push a bottom reset out of sight
      title={(
        <div className='table-filter-title'>
          <span>{title}</span>
          {count ? <Button onClick={() => onChange({})} size='small' type='link'>{e('reset')}</Button> : null}
        </div>
      )}
      trigger='click'
    >
      <button
        aria-label={count ? `${title} (${count})` : title}
        className={'item-filter table-filter' + (count ? ' table-filter-on' : '')}
        data-table-filter=''
        // keep the focus where it was: the monitor bar opens its popover on
        // focus as well as hover, so stealing focus here would blur the trigger
        // and close the very popover this button lives in
        onMouseDown={event => event.preventDefault()}
        title={title}
        type='button'
      >
        <FilterOutlined />
        {count ? <span className='item-filter-count'>{count}</span> : null}
      </button>
    </Popover>
  )
}
