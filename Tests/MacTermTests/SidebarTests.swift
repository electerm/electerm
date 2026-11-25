import AppKit
import SwiftUI
import Testing
@testable import MacTerm

@Suite(.serialized) struct SidebarTests {
    // A real hosting window and a real SFTP subsystem; only the first reply is delayed.
    @Test @MainActor func clickDuringSlowListing() async throws {
        NSApplication.shared.setActivationPolicy(.accessory)
        NSApp.finishLaunching()
        signal(SIGPIPE, SIG_IGN)
        let work = Workspace(), ssh = Session(2, "fixture", endpoint: Endpoint("fixture"))
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("electerm-test-" + UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false)
        let fileCount = 2048
        for index in 0..<fileCount {
            try Data().write(to: dir.appendingPathComponent("entry-\(index)"))
        }
        let window = NSWindow(contentRect: NSRect(x: 50, y: 80, width: 1120, height: 700),
                              styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        defer { work.sessions.forEach { $0.close() }; window.orderOut(nil); try? FileManager.default.removeItem(at: dir) }
        let host = NSHostingView(rootView: MainPage(work: work))
        window.contentView = host
        window.makeKeyAndOrderFront(nil)
        try await Task.sleep(for: .milliseconds(200))
        work.sessions.append(ssh); work.choose(ssh)
        try await Task.sleep(for: .milliseconds(100))
        host.layoutSubtreeIfNeeded()
        ssh.setFollow(true)
        ssh.screen.receive(Data("\u{1b}]7;file://localhost\(dir.path)\u{7}".utf8))
        let gate = DispatchSemaphore(value: 0)
        defer { gate.signal() }
        ssh.connected(using: DirectoryChannel { _ in
            _ = gate.wait(timeout: .now() + 5)
            return try SFTP(executable: "/usr/libexec/sftp-server", arguments: ["-d", dir.path])
        })
        #expect(ssh.loadingDirectory)
        func click(_ x: CGFloat, _ y: CGFloat) async throws {
            let location = CGPoint(x: x, y: host.bounds.height - y)
            func event(_ type: NSEvent.EventType) throws -> NSEvent {
                try #require(NSEvent.mouseEvent(with: type, location: location, modifierFlags: [],
                    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                    context: nil, eventNumber: 1, clickCount: 1, pressure: 1))
            }
            let down = try event(.leftMouseDown), up = try event(.leftMouseUp)
            NSApp.sendEvent(down)
            NSApp.sendEvent(up)
            try await Task.sleep(for: .milliseconds(50))
        }
        // Capture the rendered control, not just its binding. No resize or forced re-layout.
        func pixels(_ x: CGFloat, _ top: CGFloat, _ width: CGFloat, _ height: CGFloat) throws -> Data {
            let rect = NSRect(x: x, y: host.isFlipped ? top : host.bounds.height - top - height,
                              width: width, height: height)
            let image = try #require(host.bitmapImageRepForCachingDisplay(in: rect))
            host.cacheDisplay(in: rect, to: image)
            return try #require(image.representation(using: .png, properties: [:]))
        }
        // Hit-test and drag the actual native divider while SFTP is waiting.
        let prefs = Preferences.shared, previousWidth = prefs.object(forKey: "sidebarWidth")
        defer { prefs.set(previousWidth, forKey: "sidebarWidth") }
        let width = CGFloat(prefs.object(forKey: "sidebarWidth") as? Double ?? 224)
        let startX = min(host.bounds.width - 250, max(150, width)) + 4
        for (type, x) in [(NSEvent.EventType.leftMouseDown, startX), (.leftMouseDragged, startX + 60), (.leftMouseUp, startX + 60)] {
            let event = try #require(NSEvent.mouseEvent(with: type, location: NSPoint(x: x, y: 220),
                modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                context: nil, eventNumber: 2, clickCount: 1, pressure: 1))
            window.sendEvent(event)
            try await Task.sleep(for: .milliseconds(15))
        }
        try await Task.sleep(for: .milliseconds(80))
        let expectedWidth = min(host.bounds.width - 250, startX - 4 + 60)
        let savedWidth = prefs.double(forKey: "sidebarWidth")
        #expect(abs(savedWidth - Double(expectedWidth)) < 0.01)
        #expect(host.hitTest(NSPoint(x: expectedWidth + 4, y: 220)) is SidebarGrip.Grip)
        let checked = try pixels(148, 9, 16, 18)
        let files = try pixels(30, 66, 140, 25)
        let start = ContinuousClock.now
        try await click(185, 18) // Toolbar checkbox
        #expect(!ssh.follow && !ssh.loadingDirectory)
        #expect(try pixels(148, 9, 16, 18) != checked)
        try await click(14, 79) // Bookmarks rail
        #expect(ssh.pane == .bookmarks && !ssh.loadingDirectory)
        #expect(try pixels(30, 66, 140, 25) != files)
        #expect(start.duration(to: .now) < .seconds(2))
        ssh.screen.receive(Data("\u{1b}]7;file://host/somewhere\u{7}".utf8))
        gate.signal()
        try await Task.sleep(for: .milliseconds(150))
        #expect(ssh.pane == .bookmarks && ssh.path == "." && !ssh.loadingDirectory)
        try await click(14, 107)
        for _ in 0..<150 where ssh.loadingDirectory { try await Task.sleep(for: .milliseconds(20)) }
        #expect(ssh.entries.includingHidden(true).count == fileCount)
        let listing = ssh.entries.id
        let populated = try pixels(30, 66, 140, 25)
        try await click(14, 79)
        #expect(ssh.pane == .bookmarks)
        #expect(try pixels(30, 66, 140, 25) != populated)
        let reopen = ContinuousClock.now
        try await click(14, 107)
        #expect(ssh.pane == .files && !ssh.loadingDirectory && ssh.entries.id == listing)
        #expect(try pixels(30, 66, 140, 25) == populated)
        print("SFTP: re-open and capture, including a 50 ms UI settle: " + String(describing: reopen.duration(to: .now)))
    }

    @Test @MainActor func preferencesReachMountedAndBackgroundSessions() async throws {
        let prefs = Preferences.shared
        let keys = ["cursorStyle", "interfaceTheme", "fontSize", "defaultWrap", "defaultFollow", "defaultMonitor"]
        let original = keys.map { prefs.object(forKey: $0) }
        defer { for (key, value) in zip(keys, original) { prefs.set(value, forKey: key) } }
        prefs.set("steadyBlock", forKey: keys[0]); prefs.set("dark", forKey: keys[1])
        prefs.set(13, forKey: keys[2]); prefs.set(true, forKey: keys[3]); prefs.set(true, forKey: keys[4])
        prefs.set(false, forKey: keys[5])
        let work = Workspace(), local = try #require(work.current)
        let ssh = Session(2, "fixture", endpoint: Endpoint("fixture"))
        work.sessions.append(ssh)
        let token = local.connectionID
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 900, height: 600),
                              styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        defer { window.orderOut(nil); work.sessions.forEach { $0.close() } }
        window.contentView = NSHostingView(rootView: MainPage(work: work))
        window.orderFront(nil)
        try await Task.sleep(for: .milliseconds(120))
        #expect(window.titlebarAppearsTransparent && window.backgroundColor == NSColor(rgb: 0x151515))
        local.send(Data("printf '\nLIVE_TOKEN_421\n'\r".utf8), broadcast: false)
        func containsMarker() -> Bool {
            local.screen.view.visibleRowsText(0..<local.screen.rows).contains { $0.contains("LIVE_TOKEN_421") }
        }
        for _ in 0..<20 where !containsMarker() { try await Task.sleep(for: .milliseconds(25)) }
        #expect(containsMarker())
        prefs.set("steadyBar", forKey: keys[0]); prefs.set("light", forKey: keys[1])
        prefs.set(16, forKey: keys[2]); prefs.set(false, forKey: keys[3]); prefs.set(false, forKey: keys[4])
        prefs.set(true, forKey: keys[5])
        try await Task.sleep(for: .milliseconds(200))
        for tab in work.sessions {
            #expect(tab.screen.view.terminalStateSnapshot().cursorStyle.tagName == "steadyBar")
            #expect(tab.screen.view.nativeBackgroundColor == NSColor(rgb: 0xf8f9fa))
            #expect(tab.screen.view.font.pointSize == 16 && !tab.wrap)
        }
        #expect(window.backgroundColor == NSColor(rgb: 0xe3e7eb))
        // Sample the toolbar label itself. A correct background can still have white-on-white text.
        let host = try #require(window.contentView)
        func readableLightToolbar() throws -> Bool {
            let rect = NSRect(x: 26, y: host.isFlipped ? 7 : host.bounds.height - 29, width: 47, height: 22)
            let bitmap = try #require(host.bitmapImageRepForCachingDisplay(in: rect))
            host.cacheDisplay(in: rect, to: bitmap)
            var darkPixels = 0
            for y in 0..<bitmap.pixelsHigh {
                for x in 0..<bitmap.pixelsWide {
                    if let c = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.sRGB),
                       c.alphaComponent > 0.8, max(c.redComponent, c.greenComponent, c.blueComponent) < 0.5 { darkPixels += 1 }
                }
            }
            return darkPixels > 12
        }
        let panel = NSPanel(contentRect: NSRect(x: 10, y: 10, width: 80, height: 50), styleMask: [.titled],
                            backing: .buffered, defer: false)
        panel.isReleasedWhenClosed = false
        defer { panel.orderOut(nil) }
        for target in [window, panel, window] {
            target.makeKeyAndOrderFront(nil)
            try await Task.sleep(for: .milliseconds(80))
            #expect(try readableLightToolbar())
        }
        let prior = NSApp.appearance
        defer { NSApp.appearance = prior }
        prefs.set("system", forKey: keys[1])
        for dark in [true, false] {
            NSApp.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
            try await Task.sleep(for: .milliseconds(150))
            #expect(window.backgroundColor == NSColor(rgb: dark ? 0x151515 : 0xe3e7eb))
            #expect(work.sessions.allSatisfy { $0.screen.view.nativeBackgroundColor == NSColor(rgb: dark ? 0x1e1e1e : 0xf8f9fa) })
        }
        #expect(!ssh.follow && ssh.monitor)
        #expect(local.live && local.connectionID == token && containsMarker())
    }

    @Test @MainActor func rendersOnlyChosenTerminals() async throws {
        let work = Workspace(), local = try #require(work.current)
        let tabs = (2...5).map { Session($0) }
        let window = NSWindow(contentRect: NSRect(x: 80, y: 90, width: 900, height: 600),
                              styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        defer { work.sessions.forEach { $0.close() }; window.orderOut(nil) }
        window.contentView = NSHostingView(rootView: MainPage(work: work))
        window.orderFront(nil)
        try await Task.sleep(for: .milliseconds(80))
        #expect(local.screen.view.window === window)
        work.sessions.append(contentsOf: tabs)
        let chosen = [tabs[3], tabs[0], tabs[2], local]
        let layouts = [chosen, Array(chosen.prefix(3)), Array(chosen.prefix(2)), [chosen[0]],
                       [local, tabs[0], tabs[2], tabs[3]], [tabs[2], tabs[3], local], [tabs[1]]]
        for visible in layouts {
            #expect(work.setPanes(visible.map(\.id)))
            try await Task.sleep(for: .milliseconds(100))
            for session in work.sessions {
                let view = session.screen.view
                #expect((view.window === window) == visible.contains { $0.id == session.id },
                        "tab \(session.number), layout \(visible.map(\.number))")
            }
            let frames = visible.map { $0.screen.view.convert($0.screen.view.bounds, to: nil) }
            #expect(frames.allSatisfy { $0.width >= 48 && $0.height >= 32 })
            for (i, frame) in frames.enumerated() {
                #expect(frames.dropFirst(i + 1).allSatisfy { !frame.intersects($0) })
            }
        }
        work.choose(local)
        for tab in tabs { work.close(tab) }
        try await Task.sleep(for: .milliseconds(80))
        #expect(work.sessions.count == 1 && local.screen.view.window === window)
    }
}
