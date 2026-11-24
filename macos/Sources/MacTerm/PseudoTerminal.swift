import Foundation
import Darwin
import TerminalPTY

final class PseudoTerminal {
    private let io: DispatchIO
    private let fd: Int32
    private let queue = DispatchQueue(label: "terminal.pty")
    private var open = true

    init(path: String, arguments: [String], cols: Int, rows: Int,
         output: @escaping (Data) -> Void, ended: @escaping () -> Void) throws {
        var env = ProcessInfo.processInfo.environment
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        if env["LANG"] == nil { env["LANG"] = "en_US.UTF-8" }
        var argv = ([path] + arguments).map { strdup($0) } + [nil]
        var envp = env.map { strdup("\($0.key)=\($0.value)") } + [nil]
        defer { argv.forEach { free($0) }; envp.forEach { free($0) } }
        var master: Int32 = -1
        let pid = term_start(path, &argv, &envp, NSHomeDirectory(),
                             UInt16(clamping: max(1, cols)), UInt16(clamping: max(1, rows)), &master)
        guard pid > 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
        fd = master
        let ownedFD = master
        io = DispatchIO(type: .stream, fileDescriptor: master, queue: queue) { _ in Darwin.close(ownedFD) }
        io.setLimit(lowWater: 1)
        io.setLimit(highWater: 32768)
        io.read(offset: 0, length: Int.max, queue: queue) { done, bytes, _ in
            if let bytes, !bytes.isEmpty {
                let data = Data(bytes)
                // Apply backpressure: one bounded batch per PTY, even when the UI is busy.
                DispatchQueue.main.sync { output(data) }
            }
            if done { DispatchQueue.main.async { ended() } }
        }
        DispatchQueue.global(qos: .utility).async {
            var status: Int32 = 0
            while waitpid(pid, &status, 0) == -1 && errno == EINTR {}
        }
    }
    func write(_ bytes: Data) {
        // DispatchIO is thread-safe; writes to a closed channel fail without reusing its fd.
        let data = bytes.withUnsafeBytes { DispatchData(bytes: $0) }
        io.write(offset: 0, data: data, queue: queue) { _, _, _ in }
    }
    func resize(_ cols: Int, _ rows: Int) {
        if open { term_resize(fd, UInt16(clamping: max(1, cols)), UInt16(clamping: max(1, rows))) }
    }
    func stop() {
        guard open else { return }
        open = false
        io.close(flags: .stop)
    }
    deinit { stop() }
}
