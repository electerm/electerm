import SwiftUI

struct MonitorSection: Identifiable {
    let title: String
    let text: String
    var id: String { title }

    static func parse(_ output: String) -> [Self] {
        output.components(separatedBy: ":::").compactMap { block in
            let parts = block.split(separator: "\n", maxSplits: 1)
            guard parts.count == 2 else { return nil }
            let text = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? nil : Self(title: String(parts[0]), text: text)
        }
    }
}

extension Remote {
    func monitorDetails() throws -> [MonitorSection] {
        let proc = Process(), out = Pipe()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/ssh")
        // One read-only request, and only when the user opens or refreshes details.
        let command = """
        echo ':::系统'; uname -snrm
        echo ':::运行时间与负载'; uptime
        echo ':::内存与交换区 (KiB)'; awk '/^(MemTotal|MemAvailable|SwapTotal|SwapFree):/{print}' /proc/meminfo
        echo ':::根文件系统'; df -Ph /
        echo ':::网络接口 (RX / TX bytes)'; awk '/:/{gsub(":", " "); print $1, $2, $10}' /proc/net/dev
        echo ':::登录用户'; who | head -20
        echo ':::进程 (PID / CPU% / MEM% / 名称)'; ps -eo pid,pcpu,pmem,comm --sort=-pcpu | head -9
        """
        proc.arguments = channel + ["--", endpoint.target, command]
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
            guard data.count + chunk.count <= 32768 else {
                if proc.isRunning { proc.terminate() }
                throw TerminalError("监控数据过长")
            }
            data.append(chunk)
        }
        proc.waitUntilExit()
        guard proc.terminationStatus == 0 else { throw TerminalError("无法读取服务器信息") }
        return MonitorSection.parse(String(decoding: data, as: UTF8.self))
    }
}

struct MonitorDetails: View {
    let session: Session
    @State private var sections: [MonitorSection] = []
    @State private var error = ""
    @State private var loading = true
    @State private var revision = 0

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text("服务器详情").font(.headline)
                Spacer()
                icon("arrow.clockwise", "刷新") { revision += 1 }.disabled(loading)
            }
            if loading { ProgressView().controlSize(.small) }
            if !error.isEmpty { Text(error) }
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(sections) { section in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(section.title).bold()
                            Text(verbatim: section.text).font(.system(size: 11, design: .monospaced)).textSelection(.enabled)
                        }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        }.padding(12).frame(width: 380, height: 360).task(id: revision) {
            loading = true; error = ""
            do {
                let result = try await session.monitorDetails()
                guard !Task.isCancelled else { return }
                sections = result
                if result.isEmpty { error = "服务器未返回可用数据" }
            } catch {
                guard !Task.isCancelled else { return }
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}
