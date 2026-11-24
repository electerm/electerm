#if os(macOS)
import AppKit

private let keywordGroups = [
    #"errors?|failed|failure|denied|refused|not (?:ok|allowed|permitted|implemented|supported)|invalid|unsupported|corrupt(?:ed|ion)?|overflow|underrun|false|ko"#,
    #"ok|true|yes|accepted|allowed|enabled|connected|success(?:ful(?:ly)?)?|succeeded"#,
    #"warn(?:ings?)?|alerts?|unexpected|unknown|closed|terminated|stopped|disconnected|disabled|deprecated|not found|out of (?:memory|space)|unable to|could not"#,
    #"localhost|null|none|(?:\d{1,3}\.){3}\d{1,3}"#,
    #"last (?:failed )?login|launching|checking|loading|creating|building|important|booting|starting|notice|info(?:rmation(?:al)?)?|note"#
]
private let keywords = try! NSRegularExpression(
    pattern: #"\b(?:"# + keywordGroups.map { "(\($0))" }.joined(separator: "|") + #")\b"#,
    options: .caseInsensitive)
private let inks: [NSColor] = [0xff6060, 0x0eb16c, 0xbebe12, 0xff4dff, 0x54ccef].map { (rgb: Int) -> NSColor in
    let red = CGFloat(rgb >> 16) / 255
    let green = CGFloat((rgb >> 8) & 255) / 255
    let blue = CGFloat(rgb & 255) / 255
    return NSColor(srgbRed: red, green: green, blue: blue, alpha: 1)
}

extension TerminalView.ViewLineSegmentBuilder {
    func tintKeywords(in text: String, at start: Int) {
        guard text.utf8.contains(where: { $0 > 32 }) else { return }
        for match in keywords.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let group = inks.indices.first(where: { match.range(at: $0 + 1).location != NSNotFound }) else { continue }
            attributedString.addAttribute(.foregroundColor, value: inks[group],
                range: NSRange(location: start + match.range.location, length: match.range.length))
        }
    }
}

extension TerminalView {
    public func finishShell() {
        let alternate = withTerminal { terminal in
            terminal.cancelIncompleteShellInput()
            return terminal.isCurrentBufferAlternate
        }
        if alternate { feed(text: "\u{1b}[?1049l") }
        withTerminal { terminal in
            terminal.options.cols = terminal.cols
            terminal.options.rows = terminal.rows
            terminal.setup(isReset: true, keepingNormalBuffer: true)
            terminal.sendFocus = false
            terminal.softReset()
        }
        scroll(toPosition: 1)
        // A program may leave its cursor above previous output. Append the notice below it.
        if let last = visibleRowsText(0..<terminalDimensions.rows).lastIndex(where: { !$0.isEmpty }) {
            feed(text: "\u{1b}[\(last + 1);1H")
        }
    }

    /// The app feeds on the main thread. Do not call back into the view while inside the parser lock.
    public func configureShellEvents(_ event: @escaping (Int, ArraySlice<UInt8>) -> Void) {
        withTerminal { terminal in
            for code in [7, 633, 777] {
                terminal.registerOscHandler(code: code) { event(code, $0) }
            }
            for code in [0, 1, 2, 6, 8, 9, 52, 133, 1337, 5522, 7501] {
                terminal.registerOscHandler(code: code) { _ in }
            }
        }
    }
}
#endif
