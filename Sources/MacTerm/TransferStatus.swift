import SwiftUI

struct TransferSnapshot {
    enum Phase { case active, finished, failed(String), cancelled(String) }
    let name: String, upload: Bool
    var bytes: UInt64 = 0, total: UInt64?, rate: Double?
    var currentFile: String?, fileFraction: Double?
    var skipped = 0
    var phase: Phase = .active
    var direction: String { upload ? "上传" : "下载" }
    var partialWarning: String { upload ? "；远端可能留有不完整文件" : "" }
}

// Only the transfer card observes progress; the terminal and file list do not redraw per packet.
@MainActor final class TransferStatus: ObservableObject {
    @Published var snapshot: TransferSnapshot?
}

struct TransferCard: View {
    @ObservedObject var status: TransferStatus
    let cancel: () -> Void
    private func size(_ bytes: UInt64) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(clamping: bytes), countStyle: .file)
    }
    var body: some View {
        if let t = status.snapshot {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(verbatim: "\(t.direction) · \(t.name)").lineLimit(1).truncationMode(.middle).help(t.name)
                    Spacer(minLength: 2)
                    if case .active = t.phase { icon("xmark.circle", "取消传输", cancel) }
                    else { icon("xmark", "关闭传输结果") { status.snapshot = nil } }
                }
                details(t)
            }.padding(.vertical, 5).frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func rateLabel(_ t: TransferSnapshot) -> String? {
        t.rate.map { size(UInt64($0)) + "/s" }
    }
    private func progressLabel(_ t: TransferSnapshot) -> String {
        let amount = size(t.bytes) + (t.total.map { " / " + size($0) } ?? "")
        return amount + " · " + (rateLabel(t) ?? "测速中…")
    }
    @ViewBuilder private func activeProgress(_ t: TransferSnapshot) -> some View {
        if let file = t.currentFile {
            Text(verbatim: file).font(.caption).lineLimit(1).truncationMode(.middle).help(file)
        }
        if let fraction = t.fileFraction {
            ProgressView(value: fraction).progressViewStyle(.linear).accessibilityLabel("当前文件进度")
        } else if let total = t.total, total > 0 {
            ProgressView(value: min(1, Double(t.bytes) / Double(total))).progressViewStyle(.linear)
        } else { ProgressView().progressViewStyle(.linear) }
        Text(verbatim: progressLabel(t)).font(.caption).monospacedDigit().foregroundStyle(.secondary)
    }
    @ViewBuilder private func details(_ t: TransferSnapshot) -> some View {
        switch t.phase {
        case .active:
            activeProgress(t)
        case .finished:
            Text(verbatim: "已完成 · " + size(t.bytes) + (rateLabel(t).map { " · " + $0 } ?? ""))
                .font(.caption).foregroundStyle(.secondary)
            if t.skipped > 0 { Text("已跳过 \(t.skipped) 个符号链接或特殊文件").font(.caption) }
        case let .failed(reason):
            Label("失败：" + reason, systemImage: "exclamationmark.triangle").foregroundStyle(.red)
                .textSelection(.enabled)
        case let .cancelled(detail):
            Text("已取消" + detail).foregroundStyle(.secondary)
        }
    }
}
