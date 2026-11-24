import AppKit
import SwiftTerm

@MainActor final class Screen: TerminalViewDelegate {
    let view: NativeTerminal
    var cols: Int { view.terminalDimensions.cols }
    var rows: Int { view.terminalDimensions.rows }
    private var nextDirectory: String?, nextPID: Int?
    var directory: ((String) -> Void)?
    var shellReady: ((Int) -> Void)?
    private static let ansi = [
        0x1e1e1e, 0xff6060, 0x0eb16c, 0xbebe12, 0x1296be, 0xff4dff, 0x54ccef, 0xcccccc,
        0x808080, 0xff8080, 0x18ed93, 0xdedc12, 0x1bbae9, 0xff7dff, 0x8eddf4, 0xcccccc
    ]

    static func font(_ size: CGFloat) -> NSFont {
        NSFont(name: "Maple Mono", size: size) ?? .monospacedSystemFont(ofSize: size, weight: .regular)
    }
    init() {
        var options = TerminalOptions.default
        options.scrollback = min(20000, max(500, UserDefaults.standard.object(forKey: "scrollback") as? Int ?? 3000))
        options.maximumOscBytes = 8192
        options.kittyGraphics.storageLimitBytesPerScreen = 0
        options.enableSixelReported = false
        options.enableOsc8Hyperlinks = false
        options.ansi256PaletteStrategy = .xterm
        view = NativeTerminal(frame: NSRect(x: 0, y: 0, width: 640, height: 400),
                              font: Self.font(13), options: options)
        view.nativeForegroundColor = NSColor(rgb: 0xececec)
        view.nativeBackgroundColor = NSColor(rgb: 0x1e1e1e)
        view.caretColor = NSColor(rgb: 0xb4b4c0)
        view.collapseBrightColorsToBase = false
        view.linkReporting = .none
        view.installColors(Self.ansi.map {
            SwiftTerm.Color(red8: UInt16($0 >> 16), green8: UInt16(($0 >> 8) & 255), blue8: UInt16($0 & 255))
        })
        view.terminalDelegate = self
        view.configureShellEvents { [weak self] code, bytes in
            guard let self, let text = String(bytes: bytes, encoding: .utf8) else { return }
            switch code {
            case 7:
                guard text.hasPrefix("file://"), let slash = text.dropFirst(7).firstIndex(of: "/"),
                      let path = text[slash...].removingPercentEncoding else { return }
                record(path)
            case 633:
                guard text.hasPrefix("P;Cwd=/") else { return }
                var rest = text.dropFirst(6), path = ""
                while !rest.isEmpty {
                    if rest.hasPrefix("\\\\") { path.append("\\"); rest = rest.dropFirst(2) }
                    else if rest.hasPrefix("\\x3b") { path.append(";"); rest = rest.dropFirst(4) }
                    else { path.append(rest.removeFirst()) }
                }
                record(path)
            case 777:
                guard text.hasPrefix("electerm-shell;") else { return }
                let number = text.dropFirst("electerm-shell;".count), digits = number.utf8
                if (1...9).contains(digits.count), digits.first != 48, digits.allSatisfy({ (48...57).contains($0) }) {
                    nextPID = Int(number)
                }
            default: break
            }
        }
    }
    private func record(_ path: String) {
        if path.hasPrefix("/"), path.rangeOfCharacter(from: .controlCharacters) == nil { nextDirectory = path }
    }
    func receive(_ data: Data) {
        view.feed(byteArray: Array(data)[...])
        if let pid = nextPID { nextPID = nil; shellReady?(pid) }
        if let path = nextDirectory { nextDirectory = nil; directory?(path) }
    }
    func ended(_ reason: String) {
        view.finishShell()
        view.feed(text: "\r\n[Session ended: \(reason). Press R to reconnect.]\r\n")
    }
    func setWrap(_ enabled: Bool) { view.feed(text: enabled ? "\u{1b}[?7h" : "\u{1b}[?7l") }
    func find(_ text: String) -> Bool {
        !text.isEmpty && view.findPrevious(text, options: SearchOptions(caseSensitive: true))
    }
    func close() { view.terminalDelegate = nil; view.updateUiClosed() }

    func sizeChanged(source: SwiftTerm.TerminalView, newCols: Int, newRows: Int) {
        view.session?.resize(newCols, newRows)
    }
    func send(source: SwiftTerm.TerminalView, data: ArraySlice<UInt8>) {
        view.session?.send(Data(data), broadcast: view.typing)
    }
    func setTerminalTitle(source: SwiftTerm.TerminalView, title: String) {}
    func hostCurrentDirectoryUpdate(source: SwiftTerm.TerminalView, directory: String?) {}
    func scrolled(source: SwiftTerm.TerminalView, position: Double) {}
    func rangeChanged(source: SwiftTerm.TerminalView, startY: Int, endY: Int) {}
    func requestOpenLink(source: SwiftTerm.TerminalView, request: TerminalLinkRequest) {}
    func clipboardCopy(source: SwiftTerm.TerminalView, content: Data) {}
    func clipboardRead(source: SwiftTerm.TerminalView) -> Data? { nil }
}
