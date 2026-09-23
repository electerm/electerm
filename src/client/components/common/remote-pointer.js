/**
 * Pointer coordinate mapping for remote desktop surfaces.
 *
 * The remote surface is rendered with `object-fit: contain`, so the element
 * box and the drawn surface rarely match: one axis gets letterbox margins.
 * Deriving the scale from the element box alone therefore sends the pointer
 * to the wrong place (the classic "only the top-left region reacts" bug), and
 * each session used to re-implement that math. Shared here instead.
 */

function clamp (v, max) {
  return Math.max(0, Math.min(v, max))
}

/**
 * visible remote surface rect inside a `object-fit: contain` element
 */
export function containRect (el, sourceWidth, sourceHeight) {
  if (!el || !sourceWidth || !sourceHeight) {
    return null
  }
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) {
    return null
  }
  const scale = Math.min(
    rect.width / sourceWidth,
    rect.height / sourceHeight
  )
  return {
    scale,
    left: rect.left + (rect.width - sourceWidth * scale) / 2,
    top: rect.top + (rect.height - sourceHeight * scale) / 2
  }
}

/**
 * pointer event -> remote framebuffer pixel, clamped to the surface
 */
export function eventToRemotePos (e, el, sourceWidth, sourceHeight) {
  const rect = containRect(el, sourceWidth, sourceHeight)
  if (!rect || !rect.scale) {
    return { x: 0, y: 0 }
  }
  return {
    x: clamp(Math.round((e.clientX - rect.left) / rect.scale), sourceWidth - 1),
    y: clamp(Math.round((e.clientY - rect.top) / rect.scale), sourceHeight - 1)
  }
}
