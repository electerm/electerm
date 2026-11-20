/**
 * The `a` renderer for Markdown that came from somewhere untrusted.
 *
 * react-markdown renders `[text](url)` as a bare anchor, and a click on one
 * navigates the window to the target. In the Electron app that is not just a
 * lost workspace: the navigated document keeps the preload bridge, so any page
 * that lands in the window can call the main process (GHSA-g83m-h25x-x2xf).
 * ./nav-guard.js stops that at the main process; this is the same rule where
 * the link is created, and it keeps the click useful.
 *
 * Only real external urls become clickable, and they go to the system browser.
 * Relative and anchor links have nothing to resolve against in these panes, and
 * file:// links belong in the file manager, not in a window that can run code.
 */

import Link from './external-link'

const externalUrlRe = /^(https?|mailto):/i

export default function MarkdownLink ({ node, href, children, ...rest }) {
  if (!externalUrlRe.test(href || '')) {
    return <span {...rest}>{children}</span>
  }
  return <Link to={href} {...rest}>{children}</Link>
}
