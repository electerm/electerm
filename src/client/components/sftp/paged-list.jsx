/**
 * Virtual list for SFTP file list.
 *
 * Scroll state is owned by the parent (list-table-ui) via React's onScroll prop
 * on the scrollable container, and passed down as `scrollTop`. This avoids the
 * React lifecycle ordering bug where a child's componentDidMount fires before the
 * parent div's ref is assigned, making addEventListener attach to null.
 *
 * Uses spacers (top/bottom divs) so the container's scrollbar reflects the full
 * list height while only the visible window (± OVERSCAN) is in the DOM.
 *
 * offsetTop is read from rootRef.offsetTop at render time — the distance from the
 * scroll container's top edge to this list's top edge (accounts for the ".." parent
 * row above the list).
 */

import { Component, createRef } from 'react'

const ITEM_SIZE = 21 // 20px item height + 1px margin-bottom
const OVERSCAN = 5

export default class VirtualList extends Component {
  rootRef = createRef()

  render () {
    const { list, renderItem, containerHeight = 400, scrollTop = 0 } = this.props

    // offsetTop: distance from scroll container top to this list's top.
    // rootRef.offsetTop is relative to the nearest positioned ancestor, which is
    // .sftp-table-content (position: relative) — exactly the scroll container.
    // Returns 0 on first render (rootRef not yet set); harmless (renders a few extra items).
    const offsetTop = this.rootRef.current?.offsetTop ?? 0

    const startIndex = Math.max(
      0,
      Math.floor((scrollTop - offsetTop) / ITEM_SIZE) - OVERSCAN
    )
    const endIndex = Math.min(
      list.length - 1,
      Math.ceil((scrollTop + containerHeight - offsetTop) / ITEM_SIZE) + OVERSCAN
    )

    const topSpacerHeight = startIndex * ITEM_SIZE
    const bottomSpacerHeight = Math.max(0, (list.length - endIndex - 1) * ITEM_SIZE)

    return (
      <div ref={this.rootRef}>
        <div style={{ height: topSpacerHeight }} />
        {list.slice(startIndex, endIndex + 1).map((item, i) =>
          renderItem(item, startIndex + i)
        )}
        <div style={{ height: bottomSpacerHeight }} />
      </div>
    )
  }
}
