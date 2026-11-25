import Foundation

func humanKiB(_ kib: UInt64) -> String {
    var value = Double(kib)
    let units = ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB"]
    var index = 0
    while value >= 1024 && index + 1 < units.count { value /= 1024; index += 1 }
    return String(format: value.rounded() == value ? "%.0f " : "%.1f ", value) + units[index]
}

struct CPUTicks {
    let fields: [UInt64]
    init?(_ line: Substring) {
        let parts = line.split(whereSeparator: \.isWhitespace)
        guard parts.first == "cpu", parts.count >= 5 else { return nil }
        let fields = parts.dropFirst().prefix(8).compactMap { UInt64($0) }
        guard fields.count == min(8, parts.count - 1) else { return nil }
        self.fields = fields
    }
    // guest and guest_nice are already included in user and nice.
    func utilization(since old: Self) -> Double? {
        guard fields.count == old.fields.count else { return nil }
        var total = 0.0, busy = 0.0
        for index in fields.indices {
            guard fields[index] >= old.fields[index] else { return nil }
            let delta = Double(fields[index] - old.fields[index])
            total += delta
            if index != 3 && index != 4 { busy += delta }
        }
        return total > 0 ? busy / total : nil
    }
}

extension Remote {
    func output(_ command: String, limit: Int) throws -> String {
        let proc = Process(), out = Pipe()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/ssh")
        proc.arguments = channel + ["--", endpoint.target, "export LC_ALL=C; " + command]
        proc.standardInput = FileHandle.nullDevice
        proc.standardError = FileHandle.nullDevice
        proc.standardOutput = out
        try run(proc)
        defer { finished(proc) }
        let timeout = DispatchWorkItem { if proc.isRunning { proc.terminate() } }
        DispatchQueue.global().asyncAfter(deadline: .now() + 10, execute: timeout)
        defer { timeout.cancel() }
        var data = Data()
        while let chunk = try out.fileHandleForReading.read(upToCount: 4096), !chunk.isEmpty {
            guard data.count + chunk.count <= limit else {
                if proc.isRunning { proc.terminate() }
                throw TerminalError("监控响应超过大小限制")
            }
            data.append(chunk)
        }
        proc.waitUntilExit()
        guard proc.terminationStatus == 0 else { throw TerminalError("服务器未返回监控数据") }
        return String(decoding: data, as: UTF8.self)
    }
}
