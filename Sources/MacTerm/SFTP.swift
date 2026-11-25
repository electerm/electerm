import Foundation

struct RemoteFile: Identifiable {
    let name: String
    let mode: UInt16
    let flags: UInt16
    let sizeBytes: UInt64
    let mtime: UInt32
    var size: UInt64? { flags & 1 == 0 ? nil : sizeBytes }
    var modified: Date? { flags & 8 == 0 ? nil : Date(timeIntervalSince1970: Double(mtime)) }
    var directory: Bool { mode & 0o170000 == 0o040000 }
    var link: Bool { mode & 0o170000 == 0o120000 }
    var id: String { name }
}

// Compute the visible index only when a listing changes, off the UI thread.
// Ordinary directories without dotfiles use the original array directly.
struct FileListing: RandomAccessCollection {
    let id = UUID()
    private let all: [RemoteFile]
    private var visible: [Int]?
    init(_ entries: [RemoteFile] = []) {
        all = entries
        if entries.contains(where: { $0.name.hasPrefix(".") }) {
            visible = entries.indices.filter { !entries[$0].name.hasPrefix(".") }
        }
    }
    func includingHidden(_ show: Bool) -> Self {
        var result = self
        if show { result.visible = nil }
        return result
    }
    var startIndex: Int { 0 }
    var endIndex: Int { visible?.count ?? all.count }
    subscript(position: Int) -> RemoteFile { all[visible?[position] ?? position] }
}

private extension Data {
    mutating func number(_ n: UInt32) { Swift.withUnsafeBytes(of: n.bigEndian) { append(contentsOf: $0) } }
    mutating func field(_ d: Data) { number(UInt32(d.count)); append(d) }
}

private struct Reader {
    let data: Data
    var pos = 0
    private mutating func consume(_ count: Int) throws -> Range<Int> {
        guard count <= data.count - pos else { throw TerminalError("Incomplete SFTP response") }
        defer { pos += count }
        return pos..<pos + count
    }
    mutating func take(_ count: Int) throws -> Data { data.subdata(in: try consume(count)) }
    private mutating func integer<T: FixedWidthInteger>(_ type: T.Type) throws -> T {
        let offset = try consume(MemoryLayout<T>.size).lowerBound
        return data.withUnsafeBytes { T(bigEndian: $0.loadUnaligned(fromByteOffset: offset, as: T.self)) }
    }
    mutating func number() throws -> UInt32 { try integer(UInt32.self) }
    mutating func field() throws -> Data { let n = try number(); return try take(Int(n)) }
    mutating func skipField() throws { let n = try number(); _ = try consume(Int(n)) }
    mutating func string() throws -> String {
        let n = try number(), range = try consume(Int(n))
        guard let s = String(bytes: data[range], encoding: .utf8) else { throw TerminalError("Non-UTF-8 filename") }
        return s
    }
    mutating func attributes(_ name: String) throws -> RemoteFile {
        let flags = try number()
        let size = flags & 1 != 0 ? try integer(UInt64.self) : 0
        if flags & 2 != 0 { _ = try consume(8) }
        let mode = flags & 4 != 0 ? try number() : 0
        var modified: UInt32 = 0
        if flags & 8 != 0 { _ = try consume(4); modified = try number() }
        if flags & 0x80000000 != 0 {
            let count = try number()
            for _ in 0..<count { try skipField(); try skipField() }
        }
        return RemoteFile(name: name, mode: UInt16(truncatingIfNeeded: mode), flags: UInt16(truncatingIfNeeded: flags), sizeBytes: size, mtime: modified)
    }
}

// Browsing reuses one SFTP subsystem; transfers have separate channels so a large
// transfer cannot hold up navigation. Call withClient only from background queues.
final class DirectoryChannel {
    private let makeClient: (TransferControl?) throws -> SFTP
    private var client: SFTP?
    private let lock = NSLock()
    init(_ makeClient: @escaping (TransferControl?) throws -> SFTP) { self.makeClient = makeClient }

    func openTransfer(_ control: TransferControl) throws -> SFTP { try makeClient(control) }

    func withClient<T>(_ body: (SFTP) throws -> T) throws -> T {
        try lock.withLock {
            do {
                let current = try client ?? makeClient(nil)
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
    convenience init(_ remote: Remote, control: TransferControl? = nil) throws {
        try self.init(executable: "/usr/bin/ssh", arguments: remote.channel + ["-s", "--", remote.endpoint.target, "sftp"], owner: remote, control: control)
    }
    init(executable: String, arguments: [String], owner: Remote? = nil, control: TransferControl? = nil) throws {
        self.owner = owner
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardInput = input; process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        if let owner { try owner.run(process) } else { try process.run() }
        do {
            try control?.attach(process)
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
            if code != 0 {
                let reason = try result.string()
                throw SFTPStatusError(errorDescription: reason.isEmpty ? "SFTP 错误码 \(code)" : "\(reason)（SFTP \(code)）")
            }
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
        var files = [RemoteFile]()
        try forEachEntry(in: canonical) { files.append($0) }
        return (canonical, files.sorted {
            $0.directory == $1.directory ? $0.name.localizedStandardCompare($1.name) == .orderedAscending : $0.directory
        })
    }
    private func forEachEntry(in directory: String, _ visit: (RemoteFile) throws -> Void) throws {
        var opened = try request(11, 102, path(directory))!
        let h = try opened.field()
        defer { try? close(h) }
        var nameBytes = 0, entries = 0
        while var result = try request(12, 104, field(h), eof: true) {
            let n = try result.number()
            guard n > 0 else { break }
            entries += Int(n)
            guard entries <= 100_000 else { throw TerminalError("Remote directory exceeds the listing limit") }
            for _ in 0..<n {
                let name = try result.string()
                try result.skipField()
                let item = try result.attributes(name)
                guard !name.isEmpty, name != ".", name != "..", !name.contains("/"), !name.contains("\0") else { continue }
                nameBytes += name.utf8.count
                guard nameBytes <= 8_388_608 else { throw TerminalError("Remote filenames exceed the listing limit") }
                try visit(item)
            }
        }
    }

    private func attributes(at pathName: String) throws -> RemoteFile {
        var reply = try request(7, 105, path(pathName))! // LSTAT, never follow the selected link.
        return try reply.attributes(pathName)
    }

    // Walk one directory packet at a time. The whole tree uses a single transfer channel.
    func downloadDirectory(remote: String, local: URL, control: TransferControl,
                           progress: (String, UInt64, UInt64, UInt64?) -> Void) throws -> Int {
        let fm = FileManager.default
        let exists = TerminalError("本地已存在同名项目，请选择其他位置：\(local.lastPathComponent)")
        guard !fm.fileExists(atPath: local.path) else { throw exists }
        guard try attributes(at: remote).directory else { throw TerminalError("远端项目已不是目录") }
        let root = try resolve(remote)
        let stage = local.deletingLastPathComponent().appendingPathComponent(".electerm-\(UUID().uuidString)")
        func createDirectory(_ url: URL) throws {
            guard mkdir(url.path, 0o700) == 0 else {
                throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno), userInfo: [NSFilePathErrorKey: url.path])
            }
        }
        try createDirectory(stage)
        defer { try? fm.removeItem(at: stage) }
        var completed: UInt64 = 0, skipped = 0
        func walk(_ path: String, _ destination: URL, _ prefix: String, depth: Int) throws {
            guard depth < 64 else { throw TerminalError("目录超过 64 层：\(prefix)") }
            try forEachEntry(in: path) { entry in
                guard !control.isCancelled else { throw CancellationError() }
                let child = (path as NSString).appendingPathComponent(entry.name)
                let url = destination.appendingPathComponent(entry.name), relative = prefix + entry.name
                let kind = try (entry.mode == 0 ? attributes(at: child) : entry).mode & 0o170000
                switch kind {
                case 0o040000:
                    try createDirectory(url)
                    try walk(child, url, relative + "/", depth: depth + 1)
                case 0o100000:
                    var bytes: UInt64 = 0
                    do {
                        try transfer(remote: child, local: url, upload: false, inStagingDirectory: true) { n, total in
                            bytes = n; progress(relative, completed, n, total)
                        }
                    } catch { throw TerminalError("\(relative)：\(error.localizedDescription)") }
                    completed += bytes
                case 0: throw TerminalError("服务器未返回文件类型：\(relative)")
                default: skipped += 1 // No symlinks, sockets, FIFOs or devices in a downloaded tree.
                }
            }
        }
        try walk(root, stage, "", depth: 0)
        guard !control.isCancelled else { throw CancellationError() }
        // Unlike rename(), RENAME_EXCL also protects a destination created during the transfer.
        guard renamex_np(stage.path, local.path, UInt32(RENAME_EXCL)) == 0 else {
            if errno == EEXIST { throw exists }
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }
        return skipped
    }
    enum Edit { case file, folder, rename(String), remove(directory: Bool) }
    static func validName(_ name: String) -> Bool {
        !name.isEmpty && name != "." && name != ".." && !name.contains("/") && !name.contains("\0")
    }
    func edit(_ action: Edit, parent: String, name: String) throws {
        guard Self.validName(name) else { throw TerminalError("文件名无效") }
        func entry(_ leaf: String) -> Data { path((parent as NSString).appendingPathComponent(leaf)) }
        var args = entry(name)
        switch action {
        case .file:
            args.number(0x2a); args.number(0)
            var opened = try request(3, 102, args)!
            try close(opened.field())
        case .folder:
            args.number(0); _ = try request(14, 101, args)
        case let .rename(new):
            guard Self.validName(new) else { throw TerminalError("文件名无效") }
            args.append(entry(new)); _ = try request(18, 101, args)
        case let .remove(directory):
            _ = try request(directory ? 15 : 13, 101, args)
        }
    }
    func transfer(remote: String, local: URL, upload: Bool, inStagingDirectory: Bool = false, progress: (UInt64, UInt64?) -> Void = { _, _ in }) throws {
        // Download to a sibling temporary file; publish only after a complete transfer.
        let tmp = inStagingDirectory ? local : local.deletingLastPathComponent().appendingPathComponent(".electerm-\(UUID().uuidString)")
        if !upload {
            try Data().write(to: tmp, options: .withoutOverwriting)
        }
        defer { if !upload && !inStagingDirectory { try? FileManager.default.removeItem(at: tmp) } }
        let file = try upload ? FileHandle(forReadingFrom: local) : FileHandle(forWritingTo: tmp)
        defer { try? file.close() }
        var args = path(remote)
        args.number(upload ? 0x2a : 1) // WRITE | CREAT | EXCL: never clobber a remote file.
        args.number(0)
        var opened = try request(3, 102, args)!
        let h = try opened.field()
        var offset: UInt64 = 0
        do {
            let total: UInt64?
            if upload {
                total = try file.seekToEnd()
                try file.seek(toOffset: 0)
            } else {
                // Size from the open handle also works for symlinks. Some servers omit FSTAT.
                do {
                    var reply = try request(8, 105, field(h))!
                    total = try reply.attributes("").size
                } catch is SFTPStatusError { total = nil }
            }
            progress(0, total)
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
                progress(offset, total)
            }
            try close(h)
        } catch {
            try? close(h)
            // Never unlink a remote path by name: it may have been replaced while uploading.
            if upload { throw TerminalError("\(error.localizedDescription)；远端可能留有不完整文件：\(remote)") }
            throw error
        }
        if !upload {
            if inStagingDirectory { try file.close(); return }
            try file.synchronize()
            if FileManager.default.fileExists(atPath: local.path) {
                _ = try FileManager.default.replaceItemAt(local, withItemAt: tmp)
            } else { try FileManager.default.moveItem(at: tmp, to: local) }
        }
    }
}


// One transfer owns one SSH subsystem. Cancelling also unblocks a pending pipe read.
final class TransferControl: @unchecked Sendable {
    private let lock = NSLock()
    private var process: Process?
    private var cancelled = false
    var isCancelled: Bool { lock.withLock { cancelled } }
    func attach(_ child: Process) throws {
        try lock.withLock {
            guard !cancelled else { throw CancellationError() }
            process = child
        }
    }
    func cancel() {
        let child = lock.withLock { cancelled = true; return process }
        if let child, child.isRunning { child.terminate() }
    }
}
