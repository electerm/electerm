import Foundation

struct RemoteFile: Identifiable {
    let name: String
    let directory: Bool
    var id: String { name }
}

private extension Data {
    mutating func number(_ n: UInt32) { Swift.withUnsafeBytes(of: n.bigEndian) { append(contentsOf: $0) } }
    mutating func field(_ d: Data) { number(UInt32(d.count)); append(d) }
}

private struct Reader {
    let data: Data
    var pos = 0
    mutating func take(_ count: Int) throws -> Data {
        guard count <= data.count - pos else { throw TerminalError("Incomplete SFTP response") }
        defer { pos += count }
        return data.subdata(in: pos..<pos + count)
    }
    mutating func number() throws -> UInt32 { try take(4).reduce(0) { $0 << 8 | UInt32($1) } }
    mutating func field() throws -> Data { let n = try number(); return try take(Int(n)) }
    mutating func string() throws -> String {
        guard let s = String(data: try field(), encoding: .utf8) else { throw TerminalError("Non-UTF-8 filename") }
        return s
    }
    mutating func permissions() throws -> UInt32 {
        let flags = try number()
        if flags & 1 != 0 { _ = try take(8) }
        if flags & 2 != 0 { _ = try take(8) }
        let mode = flags & 4 != 0 ? try number() : 0
        if flags & 8 != 0 { _ = try take(8) }
        if flags & 0x80000000 != 0 {
            let count = try number()
            for _ in 0..<count { _ = try field(); _ = try field() }
        }
        return mode
    }
}

// Browsing reuses one SFTP subsystem; transfers have separate channels so a large
// transfer cannot hold up navigation. Call withClient only from background queues.
final class DirectoryChannel {
    private let makeClient: () throws -> SFTP
    private var client: SFTP?
    private let lock = NSLock()
    init(_ makeClient: @escaping () throws -> SFTP) { self.makeClient = makeClient }

    func withClient<T>(_ body: (SFTP) throws -> T) throws -> T {
        try lock.withLock {
            do {
                let current = try client ?? makeClient()
                client = current
                return try body(current)
            } catch {
                if !(error is SFTPStatusError) { client = nil }
                throw error
            }
        }
    }
}

private struct SFTPStatusError: LocalizedError {
    let errorDescription: String?
}

// Paths are length-prefixed bytes, never interpolated into a remote shell or an ls command.
final class SFTP {
    private let process = Process()
    private let input = Pipe(), output = Pipe()
    private let owner: Remote?
    private var id: UInt32 = 0
    convenience init(_ remote: Remote) throws {
        try self.init(executable: "/usr/bin/ssh", arguments: remote.channel + ["-s", "--", remote.endpoint.target, "sftp"], owner: remote)
    }
    init(executable: String, arguments: [String], owner: Remote? = nil) throws {
        self.owner = owner
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardInput = input; process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        if let owner { try owner.run(process) } else { try process.run() }
        do {
            var hello = Data([1]); hello.number(3)
            try send(hello)
            var reply = Reader(data: try packet())
            guard try reply.take(1) == Data([2]), try reply.number() == 3 else {
                throw TerminalError("Server does not support SFTP version 3")
            }
        } catch { stop(); throw error }
    }
    private func stop() {
        owner?.finished(process)
        try? input.fileHandleForWriting.close()
        try? output.fileHandleForReading.close()
        if process.isRunning { process.terminate() }
    }
    deinit { stop() }
    private func send(_ body: Data) throws {
        var frame = Data(); frame.field(body)
        try input.fileHandleForWriting.write(contentsOf: frame)
    }
    private func read(_ n: Int) throws -> Data {
        var data = Data()
        while data.count < n {
            guard let bytes = try output.fileHandleForReading.read(upToCount: n - data.count), !bytes.isEmpty else {
                throw TerminalError("SFTP channel closed")
            }
            data.append(bytes)
        }
        return data
    }
    private func packet() throws -> Data {
        var header = Reader(data: try read(4))
        let n = try header.number()
        guard n > 0, n <= 4_194_304 else { throw TerminalError("Invalid SFTP packet length") }
        return try read(Int(n))
    }
    private func request(_ type: UInt8, _ expected: UInt8, _ payload: Data, eof: Bool = false) throws -> Reader? {
        id &+= 1
        var body = Data([type]); body.number(id); body.append(payload)
        try send(body)
        var result = Reader(data: try packet())
        let tag = try result.take(1).first!
        guard try result.number() == id else { throw TerminalError("Unexpected SFTP response ID") }
        if tag == 101 {
            let code = try result.number()
            if eof && code == 1 { return nil }
            if code != 0 { throw SFTPStatusError(errorDescription: try result.string()) }
        }
        guard tag == expected else { throw TerminalError("Unexpected SFTP response \(tag)") }
        return result
    }
    private func field(_ bytes: Data) -> Data { var d = Data(); d.field(bytes); return d }
    private func path(_ name: String) -> Data { field(Data(name.utf8)) }
    private func close(_ h: Data) throws { _ = try request(4, 101, field(h)) }
    func resolve(_ name: String) throws -> String {
        var real = try request(16, 104, path(name))!
        guard try real.number() == 1 else { throw TerminalError("Cannot resolve remote directory") }
        return try real.string()
    }
    func list(_ name: String) throws -> (String, [RemoteFile]) {
        let canonical = try resolve(name)
        var opened = try request(11, 102, path(canonical))!
        let h = try opened.field()
        defer { try? close(h) }
        var files = [RemoteFile]()
        var nameBytes = 0, entries = 0
        while var result = try request(12, 104, field(h), eof: true) {
            let n = try result.number()
            guard n > 0 else { break }
            entries += Int(n)
            guard entries <= 100_000 else { throw TerminalError("Remote directory exceeds the listing limit") }
            for _ in 0..<n {
                let name = try result.string()
                _ = try result.field()
                let mode = try result.permissions()
                guard !name.isEmpty, name != ".", name != "..", !name.contains("/"), !name.contains("\0") else { continue }
                nameBytes += name.utf8.count
                guard nameBytes <= 8_388_608 else { throw TerminalError("Remote filenames exceed the listing limit") }
                files.append(RemoteFile(name: name, directory: mode & 0o170000 == 0o040000))
            }
        }
        return (canonical, files.sorted {
            $0.directory == $1.directory ? $0.name.localizedStandardCompare($1.name) == .orderedAscending : $0.directory
        })
    }
    func transfer(remote: String, local: URL, upload: Bool) throws {
        // Download to a sibling temporary file; publish only after a complete transfer.
        let tmp = local.deletingLastPathComponent().appendingPathComponent(".electerm-\(UUID().uuidString)")
        if !upload {
            try Data().write(to: tmp, options: .withoutOverwriting)
        }
        defer { if !upload { try? FileManager.default.removeItem(at: tmp) } }
        let file = try upload ? FileHandle(forReadingFrom: local) : FileHandle(forWritingTo: tmp)
        defer { try? file.close() }
        var args = path(remote)
        args.number(upload ? 0x2a : 1) // WRITE | CREAT | EXCL: never clobber a remote file.
        args.number(0)
        var opened = try request(3, 102, args)!
        let h = try opened.field()
        var offset: UInt64 = 0
        do {
            while true {
                var part = field(h)
                part.number(UInt32(offset >> 32)); part.number(UInt32(truncatingIfNeeded: offset))
                if upload {
                    guard let data = try file.read(upToCount: 32768), !data.isEmpty else { break }
                    part.field(data)
                    _ = try request(6, 101, part)
                    offset += UInt64(data.count)
                } else {
                    part.number(32768)
                    guard var reply = try request(5, 103, part, eof: true) else { break }
                    let data = try reply.field()
                    guard !data.isEmpty && data.count <= 32768 else { throw TerminalError("Invalid SFTP read") }
                    try file.write(contentsOf: data)
                    offset += UInt64(data.count)
                }
            }
            try close(h)
        } catch {
            try? close(h)
            // Never unlink a remote path by name: it may have been replaced while uploading.
            throw error
        }
        if !upload {
            try file.synchronize()
            if FileManager.default.fileExists(atPath: local.path) {
                _ = try FileManager.default.replaceItemAt(local, withItemAt: tmp)
            } else { try FileManager.default.moveItem(at: tmp, to: local) }
        }
    }
}
