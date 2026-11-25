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

    private static let lightANSI = [
        0x25282d, 0xa52432, 0x146238, 0x806000, 0x175ca4, 0x872782, 0x076777, 0xd5d8dc,
        0x56616c, 0xbf3040, 0x197744, 0x846400, 0x206baf, 0x933596, 0x00778c, 0xffffff
    ]
    static func font(_ size: CGFloat, family: String = "自动") -> NSFont {
        if family == "系统等宽" { return .monospacedSystemFont(ofSize: size, weight: .regular) }
        if family != "自动", let font = NSFont(name: family, size: size) { return font }
        return NSFont(name: "Maple Mono", size: size) ?? .monospacedSystemFont(ofSize: size, weight: .regular)
    }
    init() {
        var options = TerminalOptions.default
        options.cursorStyle = CursorStyle(tagName: Preferences.shared.string(forKey: "cursorStyle") ?? "") ?? options.cursorStyle
        options.scrollback = min(20000, max(500, Preferences.shared.object(forKey: "scrollback") as? Int ?? 3000))
        options.maximumOscBytes = 8192
        options.kittyGraphics.storageLimitBytesPerScreen = 0
        options.enableSixelReported = false
        options.enableOsc8Hyperlinks = false
        options.ansi256PaletteStrategy = .xterm
        view = NativeTerminal(frame: NSRect(x: 0, y: 0, width: 640, height: 400),
                              font: Self.font(Preferences.shared.object(forKey: "fontSize") as? Double ?? 13,
                                              family: Preferences.shared.string(forKey: "fontFamily") ?? "自动"), options: options)
        view.collapseBrightColorsToBase = false
        view.linkReporting = .none
        setTheme(light: InterfaceTheme.initiallyLight)
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
    private var lightPalette: Bool?
    func setTheme(light: Bool) {
        guard lightPalette != light else { return }; lightPalette = light
        view.appearance = NSAppearance(named: light ? .aqua : .darkAqua)
        view.nativeForegroundColor = NSColor(rgb: light ? 0x22262b : 0xececec)
        view.nativeBackgroundColor = NSColor(rgb: light ? 0xf8f9fa : 0x1e1e1e)
        view.caretColor = NSColor(rgb: light ? 0x344859 : 0xb4b4c0)
        view.installColors((light ? Self.lightANSI : Self.ansi).map {
            SwiftTerm.Color(red8: UInt16($0 >> 16), green8: UInt16(($0 >> 8) & 255), blue8: UInt16($0 & 255))
        })
        view.updateColorScheme(light ? .light : .dark)
        view.needsDisplay = true
    }
    func setCursor(_ name: String) {
        if let style = CursorStyle(tagName: name) { view.setCursorStyle(style) }
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
    func setWrap(_ enabled: Bool) { view.setShellWrap(enabled) }
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
