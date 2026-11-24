import AppKit
import XCTest
@testable import MacTerm

final class CoreTests: XCTestCase {
    @MainActor func testSidebarAndFollowSwitchWithoutWaitingForSSH() throws {
        let ssh = Session(1, "example", endpoint: try XCTUnwrap(Endpoint("example")))
        let local = Session(2)
        defer { ssh.close(); local.close() }
        XCTAssertEqual(ssh.pane, .files)
        ssh.toggle(.bookmarks)
        XCTAssertEqual(ssh.pane, .bookmarks)
        ssh.setFollow(true)
        XCTAssertEqual(ssh.pane, .files)
        ssh.setFollow(false)
        XCTAssertFalse(ssh.follow)
        XCTAssertEqual(ssh.pane, .files)
        ssh.toggle(.files)
        XCTAssertEqual(ssh.pane, .hidden)
        ssh.toggle(.files)
        XCTAssertEqual(ssh.pane, .files)
        local.toggle(.files)
        local.setFollow(true)
        XCTAssertEqual(local.pane, .bookmarks)
    }

    func testDirectoryChannelReusesSubsystemAfterMissingDirectory() throws {
        let server = "/usr/libexec/sftp-server"
        guard FileManager.default.isExecutableFile(atPath: server) else { throw XCTSkip("No SFTP subsystem") }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: dir) }
        var opens = 0
        let channel = DirectoryChannel {
            opens += 1
            return try SFTP(executable: server, arguments: ["-d", dir.path])
        }
        let home = try channel.withClient { try $0.resolve(".") }
        XCTAssertThrowsError(try channel.withClient { try $0.list("missing") })
        XCTAssertEqual(try channel.withClient { try $0.list(".").0 }, home)
        XCTAssertEqual(opens, 1)
    }

    func testMonitorOmitsUnavailableSections() {
        let sections = MonitorSection.parse(":::系统\nLinux\n:::用户\n:::磁盘\n42%\n")
        XCTAssertEqual(sections.map(\.title), ["系统", "磁盘"])
        XCTAssertEqual(sections.map(\.text), ["Linux", "42%"])
    }

    func testEndpoint() throws {
        let a = try XCTUnwrap(Endpoint("ssh://tester@[2001:db8::1]:2222"))
        XCTAssertEqual(a.target, "tester@2001:db8::1")
        XCTAssertEqual(a.arguments, ["-p", "2222"])
        XCTAssertEqual(Endpoint("work-alias")?.arguments, [])
        for invalid in ["", "-oProxyCommand=x", "a;b", "a:0", "a:65536", "a\nb", "user:pass@host"] {
            XCTAssertNil(Endpoint(invalid))
        }
    }
    @MainActor func testTerminalAndHistory() throws {
        let screen = Screen()
        defer { screen.close() }
        screen.receive(Data("\u{1b}[31mred\u{1b}[0m".utf8))
        let snapshot = try XCTUnwrap(screen.view.terminalContentSnapshot(region: .viewport))
        XCTAssertEqual(snapshot.rows.first?.cells.first?.attribute.fg, .ansi256(code: 1))
        screen.receive(Data("\u{1b}[?1049hTUI\u{1b}[?2004h\u{1b}]7;unfinished".utf8))
        screen.ended("test")
        XCTAssertEqual(screen.view.terminalInputStateSnapshot()?.isAlternateBuffer, false)
        XCTAssertEqual(screen.view.terminalInputStateSnapshot()?.bracketedPasteMode, false)
        XCTAssertTrue(screen.find("red"))
        XCTAssertTrue(screen.find("Press R to reconnect"))
    }
    @MainActor func testShellEventsAndClipboardPolicy() {
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
        XCTAssertEqual(paths, ["/tmp/a b", "/tmp/中;文"])
        XCTAssertEqual(pids, [42])
        XCTAssertEqual(clipboard, NSPasteboard.general.changeCount)
    }
    @MainActor func testDisconnectedInputAndRelease() async throws {
        weak var released: NativeTerminal?
        do {
            let session = Session(1)
            released = session.screen.view
            session.screen.receive(Data("prior-output".utf8))
            session.paste("r", broadcast: true)
            session.send(Data("r".utf8), broadcast: true)
            XCTAssertFalse(session.live)
            let key = try XCTUnwrap(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [],
                timestamp: 0, windowNumber: 0, context: nil, characters: "r", charactersIgnoringModifiers: "r",
                isARepeat: false, keyCode: 15))
            session.screen.view.keyDown(with: key)
            XCTAssertTrue(session.live)
            XCTAssertTrue(session.screen.find("prior-output"))
            session.close()
        }
        for _ in 0..<40 where released != nil { try await Task.sleep(nanoseconds: 25_000_000) }
        XCTAssertNil(released)
    }
    func testPTY() throws {
        let closed = expectation(description: "PTY closed")
        var bytes = Data()
        let pty = try PseudoTerminal(path: "/bin/sh", arguments: ["-c", "test -t 0 && printf PTY_READY"],
                                     cols: 81, rows: 25, output: { bytes.append($0) }, ended: { closed.fulfill() })
        defer { pty.stop() }
        wait(for: [closed], timeout: 5)
        XCTAssertTrue(String(decoding: bytes, as: UTF8.self).contains("PTY_READY"))
    }
    @MainActor func testProtocolReplyReturnsToOriginatingPTY() throws {
        let screen = Screen(), closed = expectation(description: "status reply")
        var bytes = Data()
        let command = #"stty raw -echo; printf '\033[5n'; dd bs=1 count=4 2>/dev/null"#
        let pty = try PseudoTerminal(path: "/bin/sh", arguments: ["-c", command], cols: 80, rows: 24,
                                     output: { bytes.append($0); screen.receive($0) }, ended: { closed.fulfill() })
        screen.view.replies.bind(pty)
        defer { screen.view.replies.bind(nil); pty.stop(); screen.close() }
        wait(for: [closed], timeout: 5)
        XCTAssertNotNil(bytes.range(of: Data("\u{1b}[0n".utf8)), "PTY output: \(Array(bytes))")
    }
    func testClosedRemoteRejectsNewChildren() throws {
        let remote = try Remote(XCTUnwrap(Endpoint("localhost")))
        let child = Process()
        child.executableURL = URL(fileURLWithPath: "/bin/sleep")
        child.arguments = ["60"]
        defer { remote.dispose() }
        try remote.run(child)
        remote.dispose()
        child.waitUntilExit()
        XCTAssertFalse(child.isRunning)
        XCTAssertThrowsError(try remote.run(Process()))
    }
    func testSystemSftpRoundTrip() throws {
        let server = "/usr/libexec/sftp-server"
        guard FileManager.default.isExecutableFile(atPath: server) else { throw XCTSkip("No local OpenSSH SFTP subsystem") }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: dir) }
        let source = dir.appendingPathComponent("source"), dest = dir.appendingPathComponent("download")
        let contents = Data((0..<70000).map { UInt8(truncatingIfNeeded: $0) })
        try contents.write(to: source)
        let client = try SFTP(executable: server, arguments: ["-d", dir.path])
        let name = "file ' [$].bin"
        try client.transfer(remote: name, local: source, upload: true)
        XCTAssertThrowsError(try client.transfer(remote: name, local: source, upload: true))
        XCTAssertTrue(try client.list(".").1.contains { $0.name == name && !$0.directory })
        try client.transfer(remote: name, local: dest, upload: false)
        XCTAssertEqual(try Data(contentsOf: dest), contents)
        XCTAssertThrowsError(try client.transfer(remote: "missing", local: dest, upload: false))
        XCTAssertEqual(try Data(contentsOf: dest), contents)
    }
}
