import AppKit
import Testing
@testable import MacTerm

@Suite(.serialized) struct CoreTests {
    @Test @MainActor func portableDataRoundTrip() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try PortableData.directory(root)
        defer { try? FileManager.default.removeItem(at: root) }
        let prefs = Preferences(), settings = root.appendingPathComponent("settings.plist")
        try prefs.open(at: settings)
        #expect(!FileManager.default.fileExists(atPath: settings.path))
        prefs.set("system", forKey: "interfaceTheme")
        let reopened = Preferences()
        try reopened.open(at: settings)
        #expect(reopened.string(forKey: "interfaceTheme") == "system")

        let url = root.appendingPathComponent("passwords.v1"), value = Data("fixture-secret-731".utf8)
        let vault = PasswordVault(file: url)
        try vault.set(value, account: "test") { fresh in #expect(fresh); return "fixture master" }
        let cipher = try Data(contentsOf: url)
        #expect(cipher.range(of: value) == nil)
        let other = PasswordVault(file: url)
        #expect(throws: (any Error).self) { try other.set(Data(), account: "test") { _ in "incorrect" } }
        #expect(try Data(contentsOf: url) == cipher)
        #expect(try other.read("test") { _ in "fixture master" } == value)
        try other.set(nil, account: "test") { _ in Issue.record("已解锁"); return "" }
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }

    @Test @MainActor func testSidebarAndFollowSwitchWithoutWaitingForSSH() throws {
        let ssh = Session(1, "example", endpoint: Endpoint("example"))
        let local = Session(2)
        defer { ssh.close(); local.close() }
        #expect(ssh.pane == .files)
        ssh.toggle(.bookmarks)
        #expect(ssh.pane == .bookmarks)
        ssh.setFollow(true)
        #expect(ssh.pane == .files)
        ssh.setFollow(false)
        #expect(!ssh.follow)
        #expect(ssh.pane == .files)
        ssh.toggle(.files)
        #expect(ssh.pane == .hidden)
        ssh.toggle(.files)
        #expect(ssh.pane == .files)
        local.toggle(.files)
        local.setFollow(true)
        #expect(local.pane == .bookmarks)
    }

    @Test @MainActor func hiddenPaneKeepsInFlightListing() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false)
        let gate = DispatchSemaphore(value: 0)
        let session = Session(1, "fixture", endpoint: Endpoint("fixture"))
        defer { gate.signal(); session.close(); try? FileManager.default.removeItem(at: dir) }
        session.setFollow(false)
        session.connected(using: DirectoryChannel { _ in
            _ = gate.wait(timeout: .now() + 5)
            return try SFTP(executable: "/usr/libexec/sftp-server", arguments: ["-d", dir.path])
        })
        session.toggle(.bookmarks)
        #expect(session.pane == .bookmarks && session.loadingDirectory)
        gate.signal()
        for _ in 0..<100 where session.loadingDirectory { try await Task.sleep(for: .milliseconds(10)) }
        #expect(session.pane == .bookmarks && session.path.hasSuffix(dir.lastPathComponent))
        let cached = session.entries.id
        session.toggle(.files)
        #expect(!session.loadingDirectory && session.entries.id == cached)
    }

    @Test(.enabled(if: FileManager.default.isExecutableFile(atPath: "/usr/libexec/sftp-server"))) func testDirectoryChannelReusesSubsystemAfterMissingDirectory() throws {
        let server = "/usr/libexec/sftp-server"
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: dir) }
        var opens = 0
        let channel = DirectoryChannel { _ in
            opens += 1
            return try SFTP(executable: server, arguments: ["-d", dir.path])
        }
        let home = try channel.withClient { try $0.resolve(".") }
        #expect(throws: (any Error).self) { try channel.withClient { try $0.list("missing") } }
        #expect(try channel.withClient { try $0.list(".").0 } == home)
        #expect(opens == 1)
    }

    @Test func compactServerSummary() {
        let sample = ServerSummary("disk 524288 1048576\nusers root×2 alice×1\nuptime 90061\n")
        #expect(sample.disk == "512 MiB / 1 GiB")
        #expect(sample.users == "root×2、alice×1")
        #expect(sample.uptime == "1 天 1 小时 1 分钟")
        #expect(ServerSummary("users\ndisk 0 0").users == "无登录记录")
        #expect(ServerSummary("disk 0 0").disk == "—")
        #expect(ServerSummary().users == "—")
        #expect(humanKiB(1572864) == "1.5 GiB")
    }

    @Test @MainActor func splitUsesOnlyChosenTabs() throws {
        let work = Workspace()
        let first = try #require(work.current)
        let others = (2...5).map { Session($0) }
        work.sessions.append(contentsOf: others)
        defer { work.sessions.forEach { $0.close() } }
        let chosen = [others[3], others[0], others[2]].map(\.id)
        #expect(work.setPanes(chosen))
        #expect(work.visibleSessions.map(\.id) == chosen)
        #expect(work.selected == chosen[0])
        let selected = work.selected
        #expect(work.moveTab(others[3].id, to: first.id))
        #expect(work.sessions.first?.id == others[3].id && selected == work.selected && work.splitIDs == chosen)
        #expect(!work.moveTab(others[3].id, to: others[2].id)) // Different pane
        #expect(work.tabs(in: chosen[0]).map(\.id) == [chosen[0], first.id, others[1].id])
        #expect(work.tabs(in: chosen[1]).map(\.id) == [chosen[1]])
        work.choose(others[0])
        #expect(work.splitIDs == chosen)
        #expect(!work.setPanes([first.id, first.id]))
        #expect(!work.setPanes([UUID()]))
        #expect(!work.setPanes(work.sessions.map(\.id)))
        #expect(work.splitIDs == chosen)
        work.close(others[0])
        #expect(work.visibleSessions.map(\.id) == [chosen[0], chosen[2]])
        #expect(work.selected == chosen[0])
        work.choose(first)
        #expect(work.splitIDs == [first.id, chosen[2]])
        work.close(first)
        #expect(work.visibleSessions.map(\.id) == [chosen[0], chosen[2]])
        work.choose(others[2]); work.cancelSplit()
        #expect(work.visibleSessions.map(\.id) == [chosen[2]] && work.tabs(in: chosen[2]).count == 3)
        #expect(work.setPanes([others[1].id]))
        #expect(work.selected == others[1].id)
        #expect(work.sessions.count == 3)
        #expect(work.sessions.allSatisfy { !$0.live })
    }

    @Test func existingBookmarksAndSSHOptions() throws {
        let json = #"{"id":"550E8400-E29B-41D4-A716-446655440000","name":"开发机","address":"me@dev:2222"}"#
        var b = try JSONDecoder().decode(Bookmark.self, from: Data(json.utf8))
        #expect(b.identity == nil && b.jump == nil && b.portablePassword != true)
        b.identity = "/tmp/key with spaces"; b.jump = "ops@bastion:2223"; b.portablePassword = true
        let remote = try Remote(#require(Endpoint(b.address)))
        defer { remote.dispose() }
        let argv = remote.login(keepalive: false, track: false, bookmark: b)
        #expect(argv.contains("/tmp/key with spaces") && argv.contains("ops@bastion:2223"))
        #expect(argv.suffix(4) == ["-p","2222","--","me@dev"])
        #expect(argv.contains("KbdInteractiveAuthentication=no"))
    }
    @Test func testEndpoint() throws {
        let a = try #require(Endpoint("ssh://tester@[2001:db8::1]:2222"))
        #expect(a.target == "tester@2001:db8::1")
        #expect(a.arguments == ["-p", "2222"])
        #expect(Endpoint("work-alias")?.arguments == [])
        for invalid in ["", "-oProxyCommand=x", "a;b", "a:0", "a:65536", "a\nb", "user:pass@host"] {
            #expect(Endpoint(invalid) == nil)
        }
    }
    @Test @MainActor func testTerminalAndHistory() throws {
        let screen = Screen()
        defer { screen.close() }
        screen.receive(Data("\u{1b}[31mred\u{1b}[0m".utf8))
        let snapshot = try #require(screen.view.terminalContentSnapshot(region: .viewport))
        #expect(snapshot.rows.first?.cells.first?.attribute.fg == .ansi256(code: 1))
        screen.receive(Data("\u{1b}[?1049hTUI\u{1b}[?2004h\u{1b}]7;unfinished".utf8))
        screen.ended("test")
        #expect(screen.view.terminalInputStateSnapshot()?.isAlternateBuffer == false)
        #expect(screen.view.terminalInputStateSnapshot()?.bracketedPasteMode == false)
        #expect(screen.find("red"))
        #expect(screen.find("Press R to reconnect"))
    }
    @Test @MainActor func testShellEventsAndClipboardPolicy() {
        let screen = Screen()
        defer { screen.close() }
        var paths = [String](), pids = [Int]()
        screen.directory = { paths.append($0) }
        screen.shellReady = { pids.append($0) }
        let clipboard = NSPasteboard.general.changeCount
        let messages = ["7;file://host/tmp/a%20b", #"633;P;Cwd=/tmp/中\x3b文"#,
                        "7;file://host/bad%00path", "777;electerm-shell;42",
                        "777;electerm-shell;-5", "777;electerm-shell;1234567890",
                        "52;c;c2hvdWxkLW5vdC1jb3B5"]
        for message in messages {
            for byte in "\u{1b}]\(message)\u{1b}\\".utf8 { screen.receive(Data([byte])) }
        }
        #expect(paths == ["/tmp/a b", "/tmp/中;文"])
        #expect(pids == [42])
        #expect(clipboard == NSPasteboard.general.changeCount)
    }
    @Test @MainActor func testDisconnectedInputAndRelease() async throws {
        weak var released: NativeTerminal?
        do {
            let session = Session(1)
            released = session.screen.view
            session.screen.receive(Data("prior-output".utf8))
            session.paste("r", broadcast: true)
            session.send(Data("r".utf8), broadcast: true)
            #expect(!session.live)
            let key = try #require(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [],
                timestamp: 0, windowNumber: 0, context: nil, characters: "r", charactersIgnoringModifiers: "r",
                isARepeat: false, keyCode: 15))
            session.screen.view.keyDown(with: key)
            #expect(session.live)
            #expect(session.screen.find("prior-output"))
            session.close()
        }
        for _ in 0..<40 where released != nil { try await Task.sleep(nanoseconds: 25_000_000) }
        #expect(released == nil)
    }
    @Test @MainActor func testPTY() async throws {
        var closed = false
        var bytes = Data()
        let pty = try PseudoTerminal(path: "/bin/sh", arguments: ["-c", "test -t 0 && printf PTY_READY"],
                                     cols: 81, rows: 25, output: { bytes.append($0) }, ended: { closed = true })
        defer { pty.stop() }
        for _ in 0..<200 where !closed { try await Task.sleep(for: .milliseconds(25)) }
        #expect(closed)
        #expect(String(decoding: bytes, as: UTF8.self).contains("PTY_READY"))
    }
    @Test @MainActor func testProtocolReplyReturnsToOriginatingPTY() async throws {
        let screen = Screen()
        var closed = false
        var bytes = Data()
        let command = #"stty raw -echo; printf '\033[5n'; dd bs=1 count=4 2>/dev/null"#
        let pty = try PseudoTerminal(path: "/bin/sh", arguments: ["-c", command], cols: 80, rows: 24,
                                     output: { bytes.append($0); screen.receive($0) }, ended: { closed = true })
        screen.view.replies.bind(pty)
        defer { screen.view.replies.bind(nil); pty.stop(); screen.close() }
        for _ in 0..<200 where !closed { try await Task.sleep(for: .milliseconds(25)) }
        #expect(closed)
        #expect(bytes.range(of: Data("\u{1b}[0n".utf8)) != nil)
    }
    @Test func testClosedRemoteRejectsNewChildren() throws {
        let remote = try Remote(#require(Endpoint("localhost")))
        let child = Process()
        child.executableURL = URL(fileURLWithPath: "/bin/sleep")
        child.arguments = ["60"]
        defer { remote.dispose() }
        try remote.run(child)
        remote.dispose()
        child.waitUntilExit()
        #expect(!child.isRunning)
        #expect(throws: (any Error).self) { try remote.run(Process()) }
    }
    @Test(.enabled(if: FileManager.default.isExecutableFile(atPath: "/usr/libexec/sftp-server"))) func testSystemSftpRoundTrip() throws {
        let server = "/usr/libexec/sftp-server"
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: dir) }
        let source = dir.appendingPathComponent("source"), dest = dir.appendingPathComponent("download")
        let contents = Data((0..<70000).map { UInt8(truncatingIfNeeded: $0) })
        try contents.write(to: source)
        let client = try SFTP(executable: server, arguments: ["-d", dir.path])
        let name = "file ' [$].bin"
        var sent: [UInt64] = [], received: [UInt64] = []
        try client.transfer(remote: name, local: source, upload: true) { bytes, total in
            #expect(total == UInt64(contents.count)); sent.append(bytes)
        }
        #expect(sent.first == 0 && sent.last == UInt64(contents.count) && sent == sent.sorted())
        #expect(throws: (any Error).self) { try client.transfer(remote: name, local: source, upload: true) }
        #expect(try client.list(".").1.contains { $0.name == name && !$0.directory })
        try client.transfer(remote: name, local: dest, upload: false) { bytes, total in
            #expect(total == UInt64(contents.count)); received.append(bytes)
        }
        #expect(received.first == 0 && received.last == UInt64(contents.count) && received == received.sorted())
        #expect(try Data(contentsOf: dest) == contents)
        #expect(throws: (any Error).self) { try client.transfer(remote: "missing", local: dest, upload: false) }
        #expect(try Data(contentsOf: dest) == contents)
    }
    @Test @MainActor func fileTransferResultSurvivesRefresh() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        let s = Session(1, "fixture", endpoint: Endpoint("fixture"))
        defer { s.close(); try? FileManager.default.removeItem(at: root) }
        let src = root.appendingPathComponent("source")
        let data = Data(repeating: 42, count: 96_001)
        try data.write(to: src)
        s.connected(using: DirectoryChannel { control in
            try SFTP(executable: "/usr/libexec/sftp-server", arguments: ["-d", root.path], control: control)
        })
        func idle() async throws {
            for _ in 0..<100 where s.working || s.loadingDirectory { try await Task.sleep(for: .milliseconds(10)) }
            try #require(!s.working && !s.loadingDirectory)
        }
        try await idle()
        let name = "进度 test.bin"
        s.transfer(name, src, upload: true, parent: s.path, connection: s.connectionID)
        #expect(s.working && s.transferStatus.snapshot?.name == name)
        try await idle()
        let sent = try #require(s.transferStatus.snapshot)
        guard case .finished = sent.phase else { Issue.record("上传未完成"); return }
        #expect(sent.total == UInt64(data.count) && sent.bytes == sent.total && (sent.rate ?? 0) > 0)
        #expect(s.entries.contains { $0.name == name })
        let dest = root.appendingPathComponent("received")
        s.transfer(name, dest, upload: false, parent: s.path, connection: s.connectionID)
        try await idle()
        #expect(s.transferStatus.snapshot?.upload == false && s.transferStatus.snapshot?.bytes == sent.bytes)
        #expect(try Data(contentsOf: dest) == data)
        let folder = root.appendingPathComponent("folder"), tree = root.appendingPathComponent("tree")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        try data.write(to: folder.appendingPathComponent(name))
        s.transfer("folder", tree, upload: false, parent: s.path, connection: s.connectionID, directory: true)
        try await idle()
        let received = try #require(s.transferStatus.snapshot)
        guard case .finished = received.phase else { Issue.record("目录下载未完成"); return }
        #expect(received.currentFile == name && received.bytes == UInt64(data.count) && received.fileFraction == 1)
        #expect(try Data(contentsOf: tree.appendingPathComponent(name)) == data)
        s.transfer("missing", dest, upload: false, parent: s.path, connection: s.connectionID)
        try await idle(); s.refresh(s.path); try await idle()
        let failed = try #require(s.transferStatus.snapshot)
        guard case let .failed(reason) = failed.phase else { Issue.record("下载错误提示丢失"); return }
        #expect(failed.name == "missing" && !reason.isEmpty && s.message.isEmpty)
        #expect(try Data(contentsOf: dest) == data)
    }

    @Test func cpuDeltaUsesIntegerCountersAndRejectsDiscontinuities() throws {
        let base = try #require(CPUTicks("cpu 9007199254740992 0 0 100 2 0 0 0 7 0"))
        let next = try #require(CPUTicks("cpu 9007199254740993 0 0 102 3 0 0 0 8 0"))
        #expect(next.utilization(since: base) == 0.25)
        #expect(base.utilization(since: next) == nil)
        #expect(base.utilization(since: base) == nil)
        #expect(CPUTicks("cpu 1 2 invalid 4") == nil)
    }

    @Test func fileOperationsOnOpenSSH() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: root) }
        let client = try SFTP(executable: "/usr/libexec/sftp-server", arguments: ["-d", root.path])
        try client.edit(.folder, parent: root.path, name: "文件 夹")
        let dir = root.appendingPathComponent("文件 夹")
        try client.edit(.file, parent: dir.path, name: "a")
        try client.edit(.rename("中 文"), parent: dir.path, name: "a")
        try client.edit(.file, parent: dir.path, name: "b")
        #expect(throws: (any Error).self) { try client.edit(.rename("b"), parent: dir.path, name: "中 文") }
        #expect(throws: (any Error).self) { try client.edit(.file, parent: dir.path, name: "../escape") }
        #expect(throws: (any Error).self) { try client.edit(.remove(directory: true), parent: root.path, name: "文件 夹") }
        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("link"), withDestinationURL: dir)
        let entries = try client.list(root.path).1
        #expect(entries.first { $0.name == "link" }?.link == true)
        try client.edit(.remove(directory: false), parent: root.path, name: "link")
        let file = try #require(try client.list(dir.path).1.first { $0.name == "中 文" })
        #expect(file.size == 0 && file.modified != nil)
        for name in ["中 文", "b"] { try client.edit(.remove(directory: false), parent: dir.path, name: name) }
        try client.edit(.remove(directory: true), parent: root.path, name: "文件 夹")
        #expect(try client.list(root.path).1.isEmpty)
    }

    @Test func directoryDownloadOnOpenSSH() throws {
        let fm = FileManager.default, root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let source = root.appendingPathComponent("source"), dest = root.appendingPathComponent("dest")
        try fm.createDirectory(at: source.appendingPathComponent("子目录/empty"), withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: root) }
        let bytes = Data(repeating: 42, count: 72_000)
        try bytes.write(to: source.appendingPathComponent("子目录/.hidden"))
        try Data([7]).write(to: source.appendingPathComponent("readme"))
        try fm.createSymbolicLink(at: source.appendingPathComponent("loop"), withDestinationURL: source)
        #expect(mkfifo(source.appendingPathComponent("fifo").path, 0o600) == 0)
        let control = TransferControl(), client = try SFTP(executable: "/usr/libexec/sftp-server", arguments: [], control: control)
        var last: UInt64 = 0
        let skipped = try client.downloadDirectory(remote: source.path, local: dest, control: control) { _, base, n, _ in
            #expect(base + n >= last)
            last = base + n
        }
        #expect(last == 72_001 && skipped == 2)
        #expect(try Data(contentsOf: dest.appendingPathComponent("子目录/.hidden")) == bytes)
        #expect(try fm.contentsOfDirectory(atPath: dest.appendingPathComponent("子目录/empty").path).isEmpty)
        #expect(try Set(fm.contentsOfDirectory(atPath: dest.path)) == ["readme", "子目录"])
    }

    @Test func directoryDownloadCancelAndCollisionDiscardStaging() throws {
        signal(SIGPIPE, SIG_IGN)
        let fm = FileManager.default, root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let source = root.appendingPathComponent("source"), dest = root.appendingPathComponent("dest")
        try fm.createDirectory(at: source, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: root) }
        try Data(repeating: 21, count: 120_000).write(to: source.appendingPathComponent("payload"))
        for cancel in [true, false] {
            let control = TransferControl(), client = try SFTP(executable: "/usr/libexec/sftp-server", arguments: [], control: control)
            var triggered = false
            #expect(throws: (any Error).self) {
                try client.downloadDirectory(remote: source.path, local: dest, control: control) { _, _, n, _ in
                    if !triggered && n > 0 {
                        triggered = true
                        if cancel { control.cancel() } else { try? Data([99]).write(to: dest, options: .withoutOverwriting) }
                    }
                }
            }
            #expect(triggered)
            if !cancel { #expect(try Data(contentsOf: dest) == Data([99])) }
            #expect(try Set(fm.contentsOfDirectory(atPath: root.path)) == (cancel ? ["source"] : ["source", "dest"]))
        }
    }

    @Test func cancelledDownloadKeepsOriginal() throws {
        // Match the app’s pipe policy when the cancelled child closes its input.
        signal(SIGPIPE, SIG_IGN)
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: root) }
        try Data(repeating: 42, count: 512_000).write(to: root.appendingPathComponent("source"))
        let dest = root.appendingPathComponent("destination"), original = Data("original".utf8)
        try original.write(to: dest)
        let control = TransferControl()
        let client = try SFTP(executable: "/usr/libexec/sftp-server", arguments: ["-d", root.path], control: control)
        #expect(throws: (any Error).self) {
            try client.transfer(remote: "source", local: dest, upload: false) { bytes, _ in if bytes > 0 { control.cancel() } }
        }
        #expect(try Data(contentsOf: dest) == original)
        #expect(try FileManager.default.contentsOfDirectory(atPath: root.path).count == 2)
    }
}
