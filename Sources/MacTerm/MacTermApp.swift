import SwiftUI
import TerminalPTY

@MainActor final class Workspace: ObservableObject {
    @Published var sessions: [Session] = []
    @Published var selected: UUID?
    @Published private(set) var splitIDs: [UUID] = []
    // Each open tab belongs to one pane; switching tabs only changes that pane's visible ID.
    private var group: [UUID: UUID] = [:]
    func tabs(in pane: UUID) -> [Session] {
        splitIDs.isEmpty ? sessions : sessions.filter { group[$0.id] == group[pane] }
    }
    var visibleSessions: [Session] {
        splitIDs.isEmpty ? [current].compactMap { $0 } : splitIDs.compactMap { id in sessions.first { $0.id == id } }
    }
    @Published var sendToAll = false
    @Published var bookmarks: [Bookmark] {
        didSet { if let data = try? JSONEncoder().encode(bookmarks) { Preferences.shared.set(data, forKey: "bookmarks") } }
    }
    private var serial = 0
    var current: Session? { sessions.first { $0.id == selected } }
    init() {
        bookmarks = (Preferences.shared.data(forKey: "bookmarks").flatMap { try? JSONDecoder().decode([Bookmark].self, from: $0) }) ?? []
        add()
    }
    @discardableResult func add(_ address: String = "", bookmark: Bookmark? = nil) -> Session? {
        let endpoint = Endpoint(address)
        guard address.isEmpty || endpoint != nil else { return nil }
        serial += 1
        let s = Session(serial, address, endpoint: endpoint, bookmark: bookmark)
        s.activatePane = { [weak self, weak s] in if let s { self?.choose(s) } }
        s.broadcast = { [weak self, weak s] input in
            guard let self, self.sendToAll else { return }
            for other in self.sessions where other.id != s?.id && other.live {
                switch input {
                case let .bytes(bytes): other.send(bytes, broadcast: false)
                case let .paste(text): other.paste(text, broadcast: false)
                }
            }
        }
        if let selected, let owner = group[selected] { group[s.id] = owner }
        sessions.append(s); choose(s); s.start()
        return s
    }
    func choose(_ s: Session) {
        if selected == s.id { return }
        if !splitIDs.contains(s.id), let index = splitIDs.firstIndex(where: { group[$0] == group[s.id] }) {
            splitIDs[index] = s.id
        }
        current?.select(false)
        selected = s.id; s.select(true)
        let view = s.screen.view
        view.window?.makeFirstResponder(view)
    }
    @discardableResult func moveTab(_ id: UUID, to target: UUID) -> Bool {
        guard group[id] == group[target], let from = sessions.firstIndex(where: { $0.id == id }),
              let to = sessions.firstIndex(where: { $0.id == target }) else { return false }
        if from != to { sessions.move(fromOffsets: IndexSet(integer: from), toOffset: to > from ? to + 1 : to) }
        return true
    }
    func close(_ s: Session) {
        guard let index = sessions.firstIndex(where: { $0.id == s.id }) else { return }
        s.close()
        sessions.remove(at: index)
        let owner = group.removeValue(forKey: s.id)
        var next: UUID?
        if let slot = splitIDs.firstIndex(of: s.id) {
            if let sibling = sessions.first(where: { group[$0.id] == owner }) {
                splitIDs[slot] = sibling.id; next = sibling.id
            } else { splitIDs.remove(at: slot); next = splitIDs.first }
            if splitIDs.count < 2 { cancelSplit() }
        }
        if sessions.isEmpty { add() }
        else if selected == s.id {
            selected = nil
            choose(sessions.first { $0.id == next } ?? sessions[min(index, sessions.count - 1)])
        }
    }
    func cancelSplit() {
        group.removeAll()
        splitIDs = []
    }
    @discardableResult func setPanes(_ ids: [UUID]) -> Bool {
        guard (1...4).contains(ids.count), Set(ids).count == ids.count,
              ids.allSatisfy({ id in sessions.contains { $0.id == id } }),
              let first = sessions.first(where: { $0.id == ids[0] }) else { return false }
        if ids.count == 1 { cancelSplit() }
        else if ids != splitIDs {
            let old = group
            group = Dictionary(uniqueKeysWithValues: sessions.map { tab in
                let owner = ids.contains(tab.id) ? tab.id : ids.first { old[$0] != nil && old[$0] == old[tab.id] } ?? ids[0]
                return (tab.id, owner)
            })
            splitIDs = ids
        }
        if !ids.contains(where: { $0 == selected }) { choose(first) }
        return true
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func application(_ sender: NSApplication, shouldSaveSecureApplicationState coder: NSCoder) -> Bool { false }
    func application(_ sender: NSApplication, shouldRestoreSecureApplicationState coder: NSCoder) -> Bool { false }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    weak var workspace: Workspace?
    func applicationWillTerminate(_ notification: Notification) { workspace?.sessions.forEach { $0.close() } }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular); NSApp.activate(ignoringOtherApps: true)
    }
}

@main struct MacTermApp: App {
    init() {
        signal(SIGPIPE, SIG_IGN)
        let env = ProcessInfo.processInfo.environment
        if CommandLine.arguments.count == 2, let socket = env["ELECTERM_ASKPASS_SOCKET"],
           let prompt = env["ELECTERM_ASKPASS_PROMPT"] {
            exit(term_askpass(socket, prompt, CommandLine.arguments[1]))
        }
        if CommandLine.arguments.contains("--verify-terminal") {
            let engine = Screen()
            engine.receive(Data("SWIFTTERM_READY".utf8))
            let ok = engine.view.visibleRowsText(0..<engine.rows).contains("SWIFTTERM_READY")
            engine.close()
            exit(ok ? EXIT_SUCCESS : EXIT_FAILURE)
        }
        do { try PortableData.prepare() }
        catch {
            let alert = NSAlert(error: error)
            alert.informativeText += "\n请将整个 Electerm Terminal 文件夹移到可写位置。"
            alert.runModal(); exit(EXIT_FAILURE)
        }
    }
    @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var work = Workspace()
    var body: some Scene {
        Window("Electerm Terminal", id: "terminal") {
            MainPage(work: work)
                .frame(minWidth: 620, minHeight: 340)
                .onAppear { delegate.workspace = work }
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
