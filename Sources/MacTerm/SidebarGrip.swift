import SwiftUI

struct SidebarGrip: NSViewRepresentable {
    let width: CGFloat, limit: CGFloat
    let changed: (CGFloat, Bool) -> Void
    func makeNSView(context: Context) -> Grip { Grip() }
    func updateNSView(_ view: Grip, context: Context) {
        view.width = width; view.limit = limit; view.changed = changed
    }

    final class Grip: NSView {
        var width: CGFloat = 0, limit: CGFloat = 0
        var changed: ((CGFloat, Bool) -> Void)?
        private var offset: CGFloat = 0
        override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
        override func resetCursorRects() { addCursorRect(bounds, cursor: .resizeLeftRight) }
        override func mouseDown(with event: NSEvent) { offset = width - event.locationInWindow.x }
        private func update(_ event: NSEvent, finished: Bool) {
            changed?(max(150, min(limit, event.locationInWindow.x + offset)), finished)
        }
        override func mouseDragged(with event: NSEvent) { update(event, finished: false) }
        override func mouseUp(with event: NSEvent) { update(event, finished: true) }
    }
}
