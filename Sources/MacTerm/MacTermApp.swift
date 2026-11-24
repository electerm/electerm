import SwiftUI

@MainActor final class Workspace: ObservableObject {
    @Published var sessions: [Session] = []
    @Published var selected: UUID?
    @Published var secondary: UUID?
    @Published var sendToAll = false
    @Published var bookmarks: [Bookmark] {
        didSet { if let data = try? JSONEncoder().encode(bookmarks) { UserDefaults.standard.set(data, forKey: "bookmarks") } }
    }
    private var serial = 0
    var current: Session? { sessions.first { $0.id == selected } }
    init() {
        bookmarks = (UserDefaults.standard.data(forKey: "bookmarks").flatMap { try? JSONDecoder().decode([Bookmark].self, from: $0) }) ?? []
        add()
    }
    @discardableResult func add(_ address: String = "") -> Session? {
        let endpoint = Endpoint(address)
        guard address.isEmpty || endpoint != nil else { return nil }
        serial += 1
        let s = Session(serial, address, endpoint: endpoint)
        s.broadcast = { [weak self, weak s] input in
            guard let self, self.sendToAll else { return }
            for other in self.sessions where other.id != s?.id && other.live {
                switch input {
                case let .bytes(bytes): other.send(bytes, broadcast: false)
                case let .paste(text): other.paste(text, broadcast: false)
                }
            }
        }
        sessions.append(s); choose(s); s.start()
        return s
    }
    func choose(_ s: Session) {
        if selected == s.id { return }
        if secondary == s.id { secondary = selected }
        current?.select(false)
        selected = s.id; s.select(true)
    }
    func close(_ s: Session) {
        guard let index = sessions.firstIndex(where: { $0.id == s.id }) else { return }
        s.close()
        sessions.remove(at: index)
        if secondary == s.id { secondary = nil }
        if sessions.isEmpty { add() }
        else if selected == s.id {
            selected = nil
            choose(sessions[min(index, sessions.count - 1)])
        }
    }
    func split() {
        if secondary != nil { secondary = nil; return }
        let original = selected
        if let other = sessions.first(where: { $0.id != original }) { secondary = other.id }
        else { add(); secondary = original }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular); NSApp.activate(ignoringOtherApps: true)
    }
}

@main struct MacTermApp: App {
    init() {
        signal(SIGPIPE, SIG_IGN)
        if CommandLine.arguments.contains("--verify-terminal") {
            let engine = Screen()
            engine.receive(Data("SWIFTTERM_READY".utf8))
            let ok = engine.view.visibleRowsText(0..<engine.rows).contains("SWIFTTERM_READY")
            engine.close()
            exit(ok ? EXIT_SUCCESS : EXIT_FAILURE)
        }
    }
    @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var work = Workspace()
    var body: some Scene {
        Window("Electerm Terminal", id: "terminal") {
            MainPage(work: work)
                .frame(minWidth: 620, minHeight: 340)
                .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification)) { _ in
                    work.sessions.forEach { $0.close() }
                }
        }
        .defaultSize(width: 1120, height: 750)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Local Terminal") { work.add() }.keyboardShortcut("t")
                Button("Close Tab") { if let s = work.current { work.close(s) } }.keyboardShortcut("w", modifiers: [.command, .shift])
            }
        }
    }
}
