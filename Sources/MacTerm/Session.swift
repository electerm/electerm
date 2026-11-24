import SwiftUI
import UniformTypeIdentifiers

enum Pane { case bookmarks, files, hidden }

enum TerminalInput { case bytes(Data), paste(String) }

@MainActor final class Session: ObservableObject, Identifiable {
    let id = UUID(), screen = Screen()
    let number: Int, address: String
    let endpoint: Endpoint?
    var title: String { endpoint == nil ? "Local" : address }
    @Published var pane: Pane
    @Published private(set) var live = false
    @Published private(set) var follow = UserDefaults.standard.object(forKey: "defaultFollow") as? Bool ?? true
    @Published var wrap = UserDefaults.standard.object(forKey: "defaultWrap") as? Bool ?? true
    @Published var path = "."
    @Published var entries: [RemoteFile] = []
    @Published var message = ""
    @Published var working = false
    @Published var monitor = false
    @Published var cpu: [Double] = []
    @Published var memory = ""
    var broadcast: ((TerminalInput) -> Void)?
    var isSelected: Bool { active }
    private var terminal: PseudoTerminal?, remote: Remote?, generation = UUID()
    private var browser: DirectoryChannel?
    private var hasListing = false
    private var followingRequest = false
    @Published private(set) var loadingDirectory = false
    private var listing = UUID(), cwd: String?, requestedDirectory: String?, shellPID: Int?, pending: DispatchWorkItem?
    private var active = true, authenticated = false, probePending = false, probing = false
    private var watchCommandOutput = false
    private var lastOutput = TimeInterval.zero
    private var trackShellPID = false
    private var prevCPU: (Double, Double)?, sampling = false
    init(_ number: Int, _ address: String = "", endpoint: Endpoint? = nil) {
        self.number = number; self.address = address; self.endpoint = endpoint
        monitor = endpoint != nil && UserDefaults.standard.bool(forKey: "defaultMonitor")
        pane = endpoint == nil ? .bookmarks : .files
        screen.view.session = self
        screen.directory = { [weak self] dir in
            guard let self, self.endpoint != nil else { return }
            self.cwd = dir
            self.probePending = false; self.watchCommandOutput = false
            self.listing = UUID()
            self.pending?.cancel(); self.pending = nil
            if self.follow && self.active && self.pane == .files && (self.requestedDirectory ?? self.path) != dir {
                self.refresh(dir, following: true)
            }
        }
        screen.shellReady = { [weak self] pid in
            if let self, self.trackShellPID, self.shellPID == nil {
                self.shellPID = pid
                if self.probePending { self.scheduleProbe(immediate: true) }
            }
        }
    }
    func start() {
        stop()
        let token = generation
        message = ""; cwd = nil; shellPID = nil; path = "."; entries = []; prevCPU = nil; cpu = []; memory = ""
        do {
            let cmd: String, args: [String]
            if let endpoint {
                let link = try Remote(endpoint)
                remote = link
                browser = DirectoryChannel { try SFTP(link) }
                cmd = "/usr/bin/ssh"
                let prefs = UserDefaults.standard
                trackShellPID = prefs.object(forKey: "shellTracking") as? Bool ?? true
                args = link.login(keepalive: prefs.object(forKey: "keepalive") as? Bool ?? true,
                                  track: trackShellPID)
            } else {
                let shell = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
                cmd = shell.hasPrefix("/") ? shell : "/bin/zsh"; args = ["-l"]
            }
            terminal = try PseudoTerminal(path: cmd, arguments: args, cols: screen.cols, rows: screen.rows,
                                          output: { [weak self] data in
                guard let self, self.generation == token else { return }
                self.screen.receive(data)
                if self.watchCommandOutput && self.active && self.follow && self.pane == .files {
                    self.lastOutput = ProcessInfo.processInfo.systemUptime
                    self.probePending = true
                }
                if self.probePending { self.scheduleProbe() }
            }, ended: { [weak self] in
                guard let self, self.generation == token else { return }
                self.stop()
                self.screen.ended("disconnected")
            })
            screen.view.replies.bind(terminal)
            screen.setWrap(wrap)
            live = true
            if remote != nil { waitForMaster(token) }
        } catch {
            stop(); message = error.localizedDescription; screen.ended("launch failed")
        }
    }
    private func waitForMaster(_ token: UUID) {
        guard token == generation, let remote else { return }
        if FileManager.default.fileExists(atPath: remote.socket) {
            authenticated = true; resumePane()
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.waitForMaster(token) }
        }
    }
    func stop() {
        generation = UUID(); listing = UUID(); requestedDirectory = nil; loadingDirectory = false; hasListing = false
        live = false; authenticated = false; trackShellPID = false
        pending?.cancel(); pending = nil; probePending = false; probing = false; watchCommandOutput = false; lastOutput = 0
        sampling = false; working = false
        screen.view.replies.bind(nil)
        terminal?.stop(); terminal = nil; remote?.dispose(); remote = nil
        browser = nil
    }
    func close() { stop(); screen.close() }
    func resize(_ w: Int, _ h: Int) {
        terminal?.resize(w, h)
    }
    func send(_ data: Data, broadcast enabled: Bool) {
        guard live else { return }
        terminal?.write(data)
        if enabled { broadcast?(.bytes(data)) }
        if shellPID != nil && follow && pane == .files && (data.contains(13) || data.contains(10)) {
            watchCommandOutput = true; probePending = true; scheduleProbe()
        }
    }
    func paste(_ text: String, broadcast enabled: Bool) {
        guard live else { return }
        // Strip terminal controls, including pasted bracketed-paste delimiters.
        let clean = text.replacingOccurrences(of: "\r\n", with: "\r").replacingOccurrences(of: "\n", with: "\r")
            .unicodeScalars.filter { $0 == "\r" || $0 == "\t" || ($0.value >= 32 && !(127...159).contains($0.value)) }
        let body = String(String.UnicodeScalarView(clean))
        let bracketed = screen.view.terminalInputStateSnapshot()?.bracketedPasteMode == true
        send(Data((bracketed ? "\u{1b}[200~\(body)\u{1b}[201~" : body).utf8), broadcast: false)
        if enabled { broadcast?(.paste(body)) }
    }
    func select(_ value: Bool) { active = value; if value { resumePane() } }
    func setFollow(_ enabled: Bool) {
        guard endpoint != nil else { return }
        follow = enabled
        if enabled {
            pane = .files
            resumePane()
        } else {
            pending?.cancel(); pending = nil; probePending = false; watchCommandOutput = false
            listing = UUID()
            if followingRequest { requestedDirectory = nil }
            if !hasListing && pane == .files { refresh(path) }
        }
    }
    func toggle(_ choice: Pane) {
        guard choice != .files || endpoint != nil else { return }
        pane = pane == choice ? .hidden : choice
        if pane == .files { resumePane() } else { listing = UUID(); requestedDirectory = nil }
    }
    func resumePane() {
        guard authenticated, active, pane == .files else { return }
        if follow, let cwd, cwd != path { refresh(cwd, following: true) }
        else if !hasListing { refresh(path) }
        if follow { probePending = true; scheduleProbe(immediate: true) }
    }
    private func scheduleProbe(immediate: Bool = false) {
        guard active, follow, authenticated, pane == .files, let pid = shellPID,
              let browser, !probing, pending == nil else { return }
        let token = generation, previousList = listing
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.generation == token else { return }
            self.pending = nil
            guard self.active, self.follow, self.pane == .files else { return }
            if !immediate, self.watchCommandOutput, ProcessInfo.processInfo.systemUptime - self.lastOutput < 0.15 {
                self.scheduleProbe()
                return
            }
            self.probePending = false; self.probing = true
            DispatchQueue.global(qos: .utility).async { [weak self] in
                let next = try? browser.withClient { try $0.resolve("/proc/\(pid)/cwd") }
                DispatchQueue.main.async {
                    guard let self, self.generation == token else { return }
                    self.probing = false
                    if let next, previousList == self.listing {
                        if next != self.cwd { self.watchCommandOutput = false }
                        self.cwd = next
                        if self.active && self.follow && self.pane == .files && self.path != next { self.refresh(next, following: true) }
                    }
                    if self.probePending { self.scheduleProbe() }
                }
            }
        }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + (immediate ? 0 : 0.15), execute: work)
    }
    func refresh(_ next: String, following: Bool = false) {
        guard let browser, authenticated else { return }
        followingRequest = following
        guard requestedDirectory != next else { return }
        requestedDirectory = next
        listing = UUID()
        guard !loadingDirectory else { return }
        loadDirectory(next, browser)
    }
    private func loadDirectory(_ next: String, _ browser: DirectoryChannel) {
        let token = generation
        loadingDirectory = true
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let result = Result { try browser.withClient { try $0.list(next) } }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.generation == token else { return }
                self.loadingDirectory = false
                guard let wanted = self.requestedDirectory else { return }
                if next != wanted { self.loadDirectory(wanted, browser); return }
                self.requestedDirectory = nil
                switch result {
                case let .success((dir, files)): self.hasListing = true; self.path = dir; self.entries = files; self.message = ""
                case let .failure(err): self.message = err.localizedDescription
                }
            }
        }
    }
    func child(_ name: String) -> String { (path as NSString).appendingPathComponent(name) }
    func fileProvider(_ name: String) -> NSItemProvider {
        let item = NSItemProvider()
        guard let remote, authenticated else { return item }
        let source = child(name)
        item.suggestedName = name
        item.registerFileRepresentation(forTypeIdentifier: UTType.data.identifier, fileOptions: [], visibility: .all) { callback in
            DispatchQueue.global(qos: .utility).async {
                let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                do {
                    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false,
                                                           attributes: [.posixPermissions: 0o700])
                    defer { try? FileManager.default.removeItem(at: dir) }
                    let url = dir.appendingPathComponent(name)
                    try SFTP(remote).transfer(remote: source, local: url, upload: false)
                    callback(url, false, nil)
                } catch { callback(nil, false, error) }
            }
            return nil
        }
        return item
    }
    func transfer(_ name: String, _ local: URL, upload: Bool) {
        guard let remote, authenticated, !working else { return }
        let name = child(name), token = generation
        working = true; message = upload ? "Uploading…" : "Downloading…"
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let result = Result { try SFTP(remote).transfer(remote: name, local: local, upload: upload) }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.generation == token else { return }
                self.working = false
                switch result {
                case .success: self.message = ""; if self.pane == .files { self.refresh(self.path) }
                case let .failure(err): self.message = err.localizedDescription
                }
            }
        }
    }
    func sample() {
        guard monitor, active, authenticated, !sampling, let remote else { return }
        sampling = true
        let token = generation
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let proc = Process(), out = Pipe()
            proc.executableURL = URL(fileURLWithPath: "/usr/bin/ssh")
            let command = #"awk '/^cpu /{print $2+$3+$4+$5+$6+$7+$8+$9,$5+$6}' /proc/stat; awk '/^MemTotal:|^MemAvailable:/{print $2}' /proc/meminfo"#
            proc.arguments = remote.channel + ["--", remote.endpoint.target, command]
            proc.standardOutput = out; proc.standardError = FileHandle.nullDevice
            var numbers = [Double]()
            if (try? remote.run(proc)) != nil {
                defer { remote.finished(proc) }
                var data = Data()
                while data.count <= 4096 {
                    guard let part = try? out.fileHandleForReading.read(upToCount: 1024), !part.isEmpty else { break }
                    data.append(part)
                }
                if data.count > 4096 { try? out.fileHandleForReading.close(); if proc.isRunning { proc.terminate() } }
                proc.waitUntilExit()
                if data.count <= 4096 {
                    numbers = String(decoding: data, as: UTF8.self).split(whereSeparator: \.isWhitespace).compactMap { Double($0) }
                }
            }
            let values = numbers
            DispatchQueue.main.async { [weak self] in
                guard let self, self.generation == token else { return }
                self.sampling = false
                guard self.monitor, self.active else { return }
                guard values.count == 4, values.allSatisfy({ $0.isFinite && $0 >= 0 && $0 < 9e18 }),
                      values[2] > 0, values[2] >= values[3] else { self.memory = "n/a"; return }
                if let prev = self.prevCPU, values[0] > prev.0 {
                    self.cpu = Array((self.cpu + [min(1, max(0, 1 - (values[1] - prev.1) / (values[0] - prev.0)))]).suffix(30))
                }
                self.prevCPU = (values[0], values[1])
                self.memory = "\(Int((values[2] - values[3]) / 1024)) / \(Int(values[2] / 1024)) MiB"
            }
        }
    }
    func monitorDetails() async throws -> [MonitorSection] {
        guard monitor, authenticated, let remote else { throw TerminalError("监控已关闭或 SSH 尚未就绪") }
        let token = generation
        let sections = try await Task.detached(priority: .utility) { try remote.monitorDetails() }.value
        guard token == generation else { throw CancellationError() }
        return sections
    }
    deinit { terminal?.stop(); remote?.dispose() }
}
