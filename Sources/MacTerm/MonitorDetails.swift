import SwiftUI

struct ServerSummary {
    var disk = "—", users = "—", uptime = "—"

    init(_ output: String = "") {
        for line in output.split(separator: "\n") {
            let fields = line.split(separator: " ")
            switch fields.first {
            case "disk" where fields.count == 3:
                if let used = UInt64(fields[1]), let total = UInt64(fields[2]), total > 0, used <= total {
                    disk = "\(humanKiB(used)) / \(humanKiB(total))"
                }
            case "users":
                users = fields.count == 1 ? "无登录记录" : fields.dropFirst().joined(separator: "、")
            case "uptime" where fields.count == 2:
                if let seconds = UInt64(fields[1]) {
                    let days = seconds / 86400, hours = seconds / 3600 % 24, minutes = seconds / 60 % 60
                    uptime = (days > 0 ? "\(days) 天 " : "") + (days > 0 || hours > 0 ? "\(hours) 小时 " : "") + "\(minutes) 分钟"
                }
            default: break
            }
        }
    }
}

extension Remote {
    func monitorDetails() throws -> ServerSummary {
        // Local mounted storage only. Keep a container's root overlay, skip nested overlays and duplicate devices.
        let command = """
        df -klPT | awk 'NR>1 && $2!="tmpfs" && $2!="devtmpfs" && $2!="squashfs" && (($1 ~ /^\\/dev\\//) || $2=="zfs" || $NF=="/") && !seen[$1]++ {used+=$4; total+=$3} END {if(total>0) printf "disk %.0f %.0f\\n",used,total}'
        if logins=$(who); then printf '%s\\n' "$logins" | awk 'BEGIN{printf "users"} NF {if(!n[$1]++) names[++i]=$1} END{for(j=1;j<=i;j++) printf " %s×%d",names[j],n[names[j]]; print ""}'; fi
        awk '{printf "uptime %.0f\\n",int($1)}' /proc/uptime
        :
        """
        return ServerSummary(try output(command, limit: 8192))
    }
}

struct MonitorDetails: View {
    @ObservedObject var session: Session
    @ViewState private var summary = ServerSummary()
    @ViewState private var error = ""
    @ViewState private var loading = true
    @ViewState private var revision = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("服务器详情").font(.headline)
                Spacer()
                if loading { ProgressView().controlSize(.small) }
                icon("arrow.clockwise", "刷新") { revision += 1 }.disabled(loading)
            }
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 5) {
                row("CPU", session.cpuLabel)
                row("内存 · 已用 / 总量", session.memory)
                row("硬盘 · 已用 / 总量", summary.disk)
                row("登录用户", summary.users)
                row("运行时间", summary.uptime)
            }
            if !error.isEmpty { Text(error).foregroundStyle(.secondary) }
        }.padding(12).frame(width: 330, alignment: .leading).task(id: revision) {
            loading = true; error = ""
            do {
                let result = try await session.monitorDetails()
                guard !Task.isCancelled else { return }
                summary = result
            } catch {
                guard !Task.isCancelled else { return }
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
    private func row(_ title: String, _ value: String) -> some View {
        GridRow {
            Text(title).foregroundStyle(.secondary)
            Text(verbatim: value).monospacedDigit().textSelection(.enabled)
        }
    }
}
