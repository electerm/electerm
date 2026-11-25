import SwiftUI
import SwiftTerm

extension NSColor {
    convenience init(rgb: Int) {
        self.init(srgbRed: CGFloat((rgb >> 16) & 255) / 255, green: CGFloat((rgb >> 8) & 255) / 255,
                  blue: CGFloat(rgb & 255) / 255, alpha: 1)
    }
}

final class NativeTerminal: SwiftTerm.TerminalView {
    weak var session: Session?
    var typing = false

    override func mouseDown(with event: NSEvent) {
        if session?.isSelected == false { session?.activatePane?() }
        super.mouseDown(with: event)
    }

    override func keyDown(with event: NSEvent) {
        if let session, !session.live {
            let modifiers = event.modifierFlags.intersection([.command, .control, .option])
            if !event.isARepeat, modifiers.isEmpty, event.characters?.lowercased() == "r" { session.start() }
            return
        }
        typing = true
        defer { typing = false }
        super.keyDown(with: event)
    }

    override func paste(_ sender: Any) {
        guard let text = NSPasteboard.general.string(forType: .string) else { return }
        session?.paste(text, broadcast: true)
    }

    // Parser replies must never pass through the keyboard broadcast delegate.
    nonisolated let replies = ReplyRoute()
    nonisolated override func send(source: Terminal, data: ArraySlice<UInt8>) {
        replies.write(Data(data))
    }
}

// SwiftTerm can reply under its parser lock. Do not call into the view from this path.
final class ReplyRoute: @unchecked Sendable {
    private let lock = NSLock()
    private weak var target: PseudoTerminal?
    func bind(_ terminal: PseudoTerminal?) { lock.withLock { target = terminal } }
    func write(_ data: Data) { lock.withLock { target }?.write(data) }
}

final class TerminalHost: NSView {
    override func layout() {
        super.layout()
        guard bounds.width > 20, bounds.height > 20, let view = subviews.first, view.frame != bounds else { return }
        view.frame = bounds
    }
}

struct TerminalView: NSViewRepresentable {
    let session: Session

    func makeNSView(context: Context) -> TerminalHost { TerminalHost() }
    func updateNSView(_ host: TerminalHost, context: Context) {
        let view = session.screen.view
        guard view.superview !== host else { return }
        view.removeFromSuperview()
        host.addSubview(view)
        host.needsLayout = true
        DispatchQueue.main.async { [weak view, weak host, weak session] in
            guard let host, let view, view.superview === host, session?.isSelected == true else { return }
            view.window?.makeFirstResponder(view)
        }
    }
}
