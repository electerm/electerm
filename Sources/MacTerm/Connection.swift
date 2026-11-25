import Foundation

struct Endpoint: Equatable {
    let host: String
    let user: String?
    let port: Int?
    var target: String { user.map { "\($0)@\(host)" } ?? host }
    var arguments: [String] { port.map { ["-p", String($0)] } ?? [] }

    init?(_ input: String) {
        var raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.hasPrefix("ssh://") { raw.removeFirst(6) }
        let pattern = #"^(?:([A-Za-z0-9_.][A-Za-z0-9_.-]*)@)?(\[[0-9A-Fa-f:.%]+\]|[A-Za-z0-9_][A-Za-z0-9_.-]*)(?::([0-9]{1,5}))?$"#
        guard let re = try? NSRegularExpression(pattern: pattern),
              let match = re.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw)) else { return nil }
        func field(_ i: Int) -> String? { Range(match.range(at: i), in: raw).map { String(raw[$0]) } }
        guard let name = field(2) else { return nil }
        host = name.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        user = field(1)
        port = field(3).flatMap(Int.init)
        if let port, !(1...65535).contains(port) { return nil }
    }
}

struct Bookmark: Identifiable, Codable {
    var id = UUID()
    let name: String
    let address: String
    var identity: String?
    var jump: String?
    var portablePassword: Bool?
    var account: String { id.uuidString + ":" + address }
}

struct TerminalError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

// Auxiliary channels must reuse the authenticated terminal. If the master is gone,
// fail rather than opening a second login or prompting behind the terminal.
private final class RemoteChannels {
    private let lock = NSLock()
    private var closed = false
    private var children = [ObjectIdentifier: Process]()

    func run(_ child: Process) throws {
        guard lock.withLock({ !closed }) else { throw TerminalError("SSH session closed") }
        try child.run()
        let registered = lock.withLock {
            guard !closed else { return false }
            children[ObjectIdentifier(child)] = child
            return true
        }
        if !registered {
            if child.isRunning { child.terminate() }
            throw TerminalError("SSH session closed")
        }
    }
    func finished(_ child: Process) {
        lock.withLock { children[ObjectIdentifier(child)] = nil }
    }
    func close() {
        let active = lock.withLock {
            closed = true
            let active = Array(children.values)
            children.removeAll()
            return active
        }
        for child in active where child.isRunning { child.terminate() }
    }
}

struct Remote {
    let endpoint: Endpoint
    let directory: URL
    private let channels = RemoteChannels()
    var socket: String { directory.appendingPathComponent("s").path }
    init(_ endpoint: Endpoint) throws {
        self.endpoint = endpoint
        directory = PortableData.temporary.appendingPathComponent("et-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false,
                                               attributes: [.posixPermissions: 0o700])
    }
    func login(keepalive: Bool, track: Bool, interval: Int = 30, timeout: Int = 0, bookmark: Bookmark? = nil) -> [String] {
        let connectOptions = timeout > 0 ? ["-o", "ConnectTimeout=\(min(timeout, 300))"] : []
        var profile: [String] = []
        if let path = bookmark?.identity, !path.isEmpty { profile += ["-i", path, "-o", "IdentitiesOnly=yes"] }
        if let jump = bookmark?.jump, Endpoint(jump) != nil { profile += ["-J", jump] }
        // Keyboard-interactive prompts can be written by the server. Never auto-answer them.
        if bookmark?.portablePassword == true { profile += ["-o", "KbdInteractiveAuthentication=no"] }
        let args = profile + connectOptions + ["-o", "UserKnownHostsFile=../../known_hosts ~/.ssh/known_hosts ~/.ssh/known_hosts2", "-M", "-S", "./s", "-o", "ControlPersist=no", "-o",
                    "ServerAliveInterval=\(keepalive ? min(300, max(5, interval)) : 0)", "-o", "ServerAliveCountMax=3",
                    "-tt"] + endpoint.arguments + ["--", endpoint.target]
        // A fixed command reports the login shell PID before exec. No keystrokes are
        // injected into prompts and no startup files are installed on the server.
        return track ? args + [#"exec /bin/sh -c 'printf "\033]777;electerm-shell;%s\007" "$$"; exec "${SHELL:-/bin/sh}" -l'"#] : args
    }
    var channel: [String] {
        ["-T", "-S", "./s", "-o", "ControlMaster=no", "-o", "BatchMode=yes",
         "-o", "ProxyCommand=/usr/bin/false"] + endpoint.arguments
    }
    func run(_ child: Process) throws { child.currentDirectoryURL = directory; try channels.run(child) }
    func finished(_ child: Process) { channels.finished(child) }
    func dispose() { channels.close(); try? FileManager.default.removeItem(at: directory) }
}
