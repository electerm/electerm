import SwiftUI
import UniformTypeIdentifiers

enum Pane { case bookmarks, files, hidden }

enum TerminalInput { case bytes(Data), paste(String) }

@MainActor final class Session: ObservableObject, Identifiable {
    let id = UUID(), screen = Screen()
    let number: Int, address: String
    let bookmark: Bookmark?
    private var passwordChannel: PasswordChannel?
    let endpoint: Endpoint?
    var title: String { bookmark?.name ?? (endpoint == nil ? "Local" : address) }
    @Published var pane: Pane
    @Published private(set) var live = false
    @Published private(set) var follow = Preferences.shared.object(forKey: "defaultFollow") as? Bool ?? true
    @Published var wrap = Preferences.shared.object(forKey: "defaultWrap") as? Bool ?? true
    @Published var path = "."
    @Published private(set) var entries = FileListing()
    @Published var message = ""
    @Published var working = false
    @Published var monitor = false { didSet { if monitor != oldValue { resetSample() } } }
    @Published var memory = "—"
    var activatePane: (() -> Void)?
    var broadcast: ((TerminalInput) -> Void)?
    var isSelected: Bool { active }
    private var terminal: PseudoTerminal?, remote: Remote?
    private var generation: UUID { connectionID }
    private(set) var connectionID = UUID()
    let transferStatus = TransferStatus()
    private var transferControl: TransferControl?
    private var browser: DirectoryChannel?
    private var hasListing = false
    private var followingRequest = false
    private var readingDirectory = false
    var loadingDirectory: Bool { requestedDirectory != nil }
    @Published private var requestedDirectory: String?
    private var listing = UUID(), cwd: String?, shellPID: Int?, pending: DispatchWorkItem?
    private var active = true, authenticated = false, probePending = false, probing = false
    private var watchCommandOutput = false
    private var lastOutput = TimeInterval.zero
    private var trackShellPID = false
    private var prevCPU: CPUTicks?, sampleEpoch = UUID(), sampling = false
    @Published private(set) var cpuLabel = "采样中"
    func resetSample() {
        sampleEpoch = UUID(); prevCPU = nil
        if cpuLabel != "采样中" { cpuLabel = "采样中" }
        if memory != "—" { memory = "—" }
    }
    init(_ number: Int, _ address: String = "", endpoint: Endpoint? = nil, bookmark: Bookmark? = nil) {
        self.bookmark = bookmark
        self.number = number; self.address = address; self.endpoint = endpoint
        monitor = endpoint != nil && Preferences.shared.bool(forKey: "defaultMonitor")
        pane = endpoint == nil ? .bookmarks : .files
        screen.view.session = self
        screen.directory = { [weak self] dir in
            guard let self, self.endpoint != nil else { return }
            let changed = self.cwd != dir
            self.cwd = dir
            self.probePending = false; self.watchCommandOutput = false
            self.listing = UUID()
            self.pending?.cancel(); self.pending = nil
            if changed && self.follow && self.active && self.pane == .files && (self.requestedDirectory ?? self.path) != dir {
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
        if live || terminal != nil || remote != nil { stop() }
        let token = generation
        if !message.isEmpty { message = "" }
        cwd = nil; shellPID = nil
        if path != "." { path = "." }
        if !entries.includingHidden(true).isEmpty { entries = FileListing() }
        do {
            let cmd: String, args: [String]
            if let endpoint {
                let link = try Remote(endpoint)
                remote = link
                if let b = bookmark, b.portablePassword == true {
                    let target = (endpoint.user ?? NSUserName()) + "@" + endpoint.host
                    let secret = try PasswordVault.shared.read(b.account, password: PasswordVault.prompt)
                    passwordChannel = try PasswordChannel(directory: link.directory, target: target) { secret }
                }
                cmd = "/usr/bin/ssh"
                let prefs = Preferences.shared
                trackShellPID = prefs.object(forKey: "shellTracking") as? Bool ?? true
                args = link.login(keepalive: prefs.object(forKey: "keepalive") as? Bool ?? true,
                                  track: trackShellPID, interval: prefs.object(forKey: "keepaliveSeconds") as? Int ?? 30,
                                  timeout: prefs.integer(forKey: "connectTimeout"), bookmark: bookmark)
            } else {
                let shell = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
                cmd = shell.hasPrefix("/") ? shell : "/bin/zsh"; args = ["-l"]
            }
            terminal = try PseudoTerminal(path: cmd, arguments: args, directory: remote?.directory.path ?? NSHomeDirectory(), environment: passwordChannel?.environment ?? [:], cols: screen.cols, rows: screen.rows,
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
            passwordChannel?.pid = terminal?.pid ?? 0
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
            connected(using: DirectoryChannel { try SFTP(remote, control: $0) })
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in self?.waitForMaster(token) }
        }
    }
    func connected(using channel: DirectoryChannel) {
        passwordChannel = nil
        browser = channel; authenticated = true; resumePane()
    }
    func stop() {
        passwordChannel = nil
        if transferControl != nil, var t = transferStatus.snapshot {
            t.phase = .failed("SSH 连接已断开" + t.partialWarning); transferStatus.snapshot = t
        }
        transferControl?.cancel(); transferControl = nil
        connectionID = UUID(); listing = UUID(); readingDirectory = false; hasListing = false
        if requestedDirectory != nil { requestedDirectory = nil }
        if live { live = false }
        authenticated = false; trackShellPID = false
        pending?.cancel(); pending = nil; probePending = false; probing = false; watchCommandOutput = false; lastOutput = 0
        resetSample(); sampling = false
        if working { working = false }
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
    func select(_ value: Bool) { guard active != value else { return }; active = value; resetSample(); if value { resumePane() } }
    func setFollow(_ enabled: Bool) {
        guard endpoint != nil else { return }
        follow = enabled
        if enabled {
            pane = .files
            resumePane()
        } else {
            pending?.cancel(); pending = nil; probePending = false; watchCommandOutput = false
            listing = UUID()
            if followingRequest && requestedDirectory != nil { requestedDirectory = nil }
        }
    }
    func toggle(_ choice: Pane) {
        guard choice != .files || endpoint != nil else { return }
        pane = pane == choice ? .hidden : choice
        if pane == .files { resumePane() }
        else {
            // Stop tracking the shell; allow the one outstanding listing to fill the cache.
            pending?.cancel(); pending = nil; probePending = false; watchCommandOutput = false; listing = UUID()
        }
    }
    func resumePane() {
        guard authenticated, active, pane == .files else { return }
        if follow, let cwd, cwd != path { refresh(cwd, following: true) }
        else if !hasListing && requestedDirectory == nil { refresh(path) }
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
                        let changed = next != self.cwd
                        if changed { self.watchCommandOutput = false }
                        self.cwd = next
                        if (immediate || changed) && self.active && self.follow && self.pane == .files && self.path != next { self.refresh(next, following: true) }
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
        if requestedDirectory == next {
            // An explicit navigation owns the result even if a follow request asks for the same path.
            if !following { followingRequest = false }
            return
        }
        followingRequest = following
        requestedDirectory = next
        listing = UUID()
        guard !readingDirectory else { return }
        loadDirectory(next, browser)
    }
    private func loadDirectory(_ next: String, _ browser: DirectoryChannel) {
        let token = generation
        readingDirectory = true
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let result = Result {
                let (dir, files) = try browser.withClient { try $0.list(next) }
                return (dir, FileListing(files))
            }
            DispatchQueue.main.async { [weak self] in
                guard let self, self.generation == token else { return }
                self.readingDirectory = false
                guard let wanted = self.requestedDirectory else { return }
                if next != wanted { self.loadDirectory(wanted, browser); return }
                self.requestedDirectory = nil
                switch result {
                case let .success((dir, files)):
                    self.hasListing = true
                    if self.path != dir { self.path = dir }
                    self.entries = files
                    if !self.message.isEmpty { self.message = "" }
                case let .failure(err): self.message = err.localizedDescription
                }
            }
        }
    }
    func child(_ name: String) -> String { (path as NSString).appendingPathComponent(name) }
    func fileProvider(_ name: String, parent: String, connection: UUID) -> NSItemProvider {
        let item = NSItemProvider()
        item.suggestedName = name
        item.registerFileRepresentation(forTypeIdentifier: UTType.data.identifier, fileOptions: [], visibility: .all) { [weak self] callback in
            DispatchQueue.main.async {
                guard let self, self.generation == connection, !self.working, self.authenticated else {
                    callback(nil, false, TerminalError("连接不可用或传输正在进行")); return
                }
                let dir = PortableData.temporary.appendingPathComponent("electerm-drag-" + UUID().uuidString)
                do {
                    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false,
                                                           attributes: [.posixPermissions: 0o700])
                    let url = dir.appendingPathComponent(name)
                    self.transfer(name, url, upload: false, parent: parent, connection: connection) { result in
                        defer { try? FileManager.default.removeItem(at: dir) }
                        switch result {
                        case .success: callback(url, false, nil)
                        case let .failure(error): callback(nil, false, error)
                        }
                    }
                } catch {
                    self.transferStatus.snapshot = TransferSnapshot(name: name, upload: false, phase: .failed(error.localizedDescription))
                    callback(nil, false, error)
                }
            }
            return nil
        }
        return item
    }
    func edit(_ action: SFTP.Edit, parent: String, name: String, connection: UUID) {
        guard connection == generation, let browser, authenticated, !working else { return }
        working = true
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let result = Result { try browser.withClient { try $0.edit(action, parent: parent, name: name) } }
            DispatchQueue.main.async {
                guard let self, self.generation == connection else { return }
                self.working = false
                switch result {
                case .success: self.message = ""; self.changedDirectory(parent)
                case let .failure(error): self.message = error.localizedDescription
                }
            }
        }
    }
    private func changedDirectory(_ parent: String) {
        guard parent == path, requestedDirectory == nil || requestedDirectory == parent else { return }
        hasListing = false
        if active && pane == .files { refresh(parent) }
    }
    func cancelTransfer() { transferControl?.cancel() }
    func transfer(_ name: String, _ local: URL, upload: Bool, parent: String, connection: UUID, directory: Bool = false,
                  completed: ((Result<Void, Error>) -> Void)? = nil) {
        guard connection == generation, parent.hasPrefix("/"), SFTP.validName(name), let browser, authenticated, !working else {
            let error = TerminalError("目录或连接不可用，或已有文件操作正在进行")
            message = "\(upload ? "上传" : "下载") \(name) 失败：\(error.localizedDescription)"
            if transferControl == nil {
                transferStatus.snapshot = TransferSnapshot(name: name, upload: upload, phase: .failed(error.localizedDescription))
            }
            completed?(.failure(error)); return
        }
        let path = (parent as NSString).appendingPathComponent(name), control = TransferControl()
        let initial = TransferSnapshot(name: name, upload: upload)
        transferControl = control; working = true; transferStatus.snapshot = initial
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let start = ProcessInfo.processInfo.systemUptime
            var last = start, reported = false, previous: UInt64 = 0, state = initial
            let result = Result {
                let client = try browser.openTransfer(control)
                func report(_ bytes: UInt64, _ total: UInt64?) {
                    state.bytes = bytes; state.total = total
                    let now = ProcessInfo.processInfo.systemUptime
                    guard !reported || now - last >= 0.25 else { return }; reported = true
                    if bytes > previous { state.rate = Double(bytes - previous) / (now - last) }
                    previous = bytes; last = now
                    DispatchQueue.main.async { [weak self, state] in
                        if self?.transferControl === control { self?.transferStatus.snapshot = state }
                    }
                }
                if directory {
                    state.skipped = try client.downloadDirectory(remote: path, local: local, control: control) { file, base, n, size in
                        state.currentFile = file
                        state.fileFraction = size.flatMap { $0 > 0 ? min(1, Double(n) / Double($0)) : nil }
                        report(base + n, nil)
                    }
                } else { try client.transfer(remote: path, local: local, upload: upload, progress: report) }
            }
            switch result {
            case .success:
                state.phase = .finished
                let elapsed = ProcessInfo.processInfo.systemUptime - start
                if elapsed > 0 { state.rate = Double(state.bytes) / elapsed }
            case let .failure(error):
                state.phase = control.isCancelled ? .cancelled(state.partialWarning) : .failed(error.localizedDescription)
            }
            completed?(result)
            DispatchQueue.main.async { [weak self, state] in
                guard let self, self.transferControl === control else { return }
                self.transferControl = nil; self.working = false; self.transferStatus.snapshot = state
                if case .success = result, upload { self.changedDirectory(parent) }
            }
        }
    }
    func sample(cpuEnabled: Bool = true, memoryEnabled: Bool = true) {
        guard monitor, active, authenticated, !sampling, cpuEnabled || memoryEnabled, let remote else { return }
        sampling = true
        let token = generation, epoch = sampleEpoch
        let command = (cpuEnabled ? "head -n 1 /proc/stat; " : "") +
            (memoryEnabled ? "awk '/^(MemTotal|MemAvailable):/{print $1,$2}' /proc/meminfo; " : "") + ":"
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let lines = (try? remote.output(command, limit: 2048))?.split(separator: "\n") ?? []
            let ticks = lines.first.flatMap(CPUTicks.init)
            func kib(_ name: String) -> UInt64? {
                lines.first { $0.hasPrefix(name + ":") }?.split(whereSeparator: \.isWhitespace).last.flatMap { UInt64($0) }
            }
            let total = kib("MemTotal"), available = kib("MemAvailable")
            DispatchQueue.main.async {
                guard let self, token == self.generation else { return }
                self.sampling = false
                guard self.active, self.monitor, epoch == self.sampleEpoch else { return }
                if cpuEnabled {
                    let label: String
                    if let ticks, let old = self.prevCPU, let fraction = ticks.utilization(since: old) {
                        label = String(format: "%.1f%%", 100 * fraction)
                    } else { label = ticks == nil || self.prevCPU != nil ? "—" : "采样中" }
                    if self.cpuLabel != label { self.cpuLabel = label }
                    self.prevCPU = ticks
                }
                if memoryEnabled {
                    let label: String
                    if let total, let available, total > 0, available <= total {
                        label = "\(humanKiB(total - available)) / \(humanKiB(total))"
                    } else { label = "—" }
                    if self.memory != label { self.memory = label }
                }
            }
        }
    }
    func monitorDetails() async throws -> ServerSummary {
        guard monitor, authenticated, let remote else { throw TerminalError("监控已关闭或 SSH 尚未就绪") }
        let token = generation
        let sections = try await Task.detached(priority: .utility) { try remote.monitorDetails() }.value
        guard token == generation else { throw CancellationError() }
        return sections
    }
    deinit { terminal?.stop(); remote?.dispose() }
}
