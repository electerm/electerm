/**
 * Decide whether a dragged item should be inserted
 * AFTER the drop target, based on which half of the
 * target element the pointer is currently in.
 *
 * This is the fix for the "can not drag to the last
 * position" bug: splitting each item into a top/bottom
 * (or left/right) half gives a valid drop zone after the
 * last item, so the insertion index can reach `length`
 * (append) instead of being capped at `length - 1`.
 *
 * @param {Object} e         native drag event (needs clientX/clientY)
 * @param {HTMLElement} el   resolved drop target element
 * @param {boolean} horizontal  true for horizontal lists (e.g. tabs)
 * @returns {boolean} true => insert the dragged item after the target
 */
export function isDropAfterHalf (e, el, horizontal = false) {
  if (!el) {
    return false
  }
  const rect = el.getBoundingClientRect()
  if (!rect.height && !rect.width) {
    return false
  }
  if (horizontal) {
    return e.clientX > rect.left + rect.width / 2
  }
  return e.clientY > rect.top + rect.height / 2
}

const DROP_BEFORE_CLS = 'dnd-before'
const DROP_AFTER_CLS = 'dnd-after'

/**
 * Show a directional drop indicator on the target element.
 * first half  => top edge    (insert before)
 * second half => bottom edge (insert after)
 * Used together with the `.dnd-before` / `.dnd-after` CSS rules.
 *
 * @param {HTMLElement} el   resolved drop target element
 * @param {boolean} insertAfter  result of isDropAfterHalf()
 */
export function setDropIndicator (el, insertAfter) {
  if (!el) {
    return
  }
  el.classList.remove(DROP_BEFORE_CLS, DROP_AFTER_CLS)
  el.classList.add(insertAfter ? DROP_AFTER_CLS : DROP_BEFORE_CLS)
}

/**
 * Remove any directional drop indicator from the target element.
 */
export function clearDropIndicator (el) {
  if (!el) {
    return
  }
  el.classList.remove(DROP_BEFORE_CLS, DROP_AFTER_CLS)
}
