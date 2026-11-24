import SwiftUI
import UniformTypeIdentifiers

struct FilePane: View {
    @ObservedObject var session: Session
    @State private var draft = ""
    @AppStorage("showHiddenFiles") private var hidden = false
    @State private var selection: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("远程：\(session.endpoint?.target ?? "")").lineLimit(1)
                Spacer()
                if session.loadingDirectory { ProgressView().controlSize(.small).accessibilityLabel("读取目录") }
            }.frame(height: 28)
            HStack(spacing: 2) {
                icon(hidden ? "eye.slash" : "eye", "隐藏文件") { hidden.toggle() }
                icon("arrow.up", "上一级") { session.refresh(session.child("..")) }
                icon("house", "主目录") { session.refresh(".") }
                TextField("路径", text: $draft).textFieldStyle(.plain).onSubmit { session.refresh(draft) }
                icon("arrow.clockwise", "刷新") { session.refresh(session.path) }
            }.padding(3).background(.quaternary)
            HStack {
                Text("名称")
                Spacer()
                icon("arrow.up.doc", "上传文件") {
                    let panel = NSOpenPanel()
                    panel.canChooseDirectories = false
                    if panel.runModal() == .OK, let url = panel.url {
                        session.transfer(url.lastPathComponent, url, upload: true)
                    }
                }.disabled(session.working)
            }.frame(height: 23)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    Button { session.refresh(session.child("..")) } label: { row("..", true) }
                    ForEach(session.entries.filter { hidden || !$0.name.hasPrefix(".") }) { file in
                        if file.directory {
                            Button { selection = file.name; open(file) } label: { row(file.name, true) }
                        } else {
                            row(file.name, false)
                                .onTapGesture(count: 2) { open(file) }.onTapGesture { selection = file.name }
                                .contextMenu { Button("下载…") { open(file) } }
                                .onDrag { session.fileProvider(file.name) }
                        }
                    }
                }
            }
        }.font(.system(size: 12)).padding(.horizontal, 5)
        .onAppear { draft = session.path }.onChange(of: session.path) { _, path in draft = path }
        .dropDestination(for: URL.self) { urls, _ in
            guard urls.count == 1, let url = urls.first, url.isFileURL,
                  (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true,
                  !session.working else { return false }
            session.transfer(url.lastPathComponent, url, upload: true); return true
        }
    }
    private func row(_ name: String, _ folder: Bool) -> some View {
        HStack(spacing: 4) {
            Image(systemName: folder ? "folder.fill" : "doc").foregroundStyle(folder ? Color.yellow : .secondary)
            Text(name).lineLimit(1)
        }.frame(maxWidth: .infinity, alignment: .leading).frame(height: 21)
        .background(selection == name ? Color.accentColor.opacity(0.28) : .clear).contentShape(Rectangle())
    }
    private func open(_ file: RemoteFile) {
        if file.directory { session.refresh(session.child(file.name)); return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = file.name
        if panel.runModal() == .OK, let url = panel.url { session.transfer(file.name, url, upload: false) }
    }
}

struct StatusLine: View {
    @ObservedObject var session: Session
    @AppStorage("monitorInterval") private var interval = 3
    @State private var details = false
    var body: some View {
        HStack(spacing: 9) {
            if session.endpoint != nil {
                icon("gauge.with.dots.needle.50percent", "远程监控") {
                    session.monitor.toggle()
                    if session.monitor { session.sample() }
                }.foregroundStyle(session.monitor ? Color.cyan : .secondary)
                if session.monitor {
                    Divider()
                    Text("CPU")
                    HStack(alignment: .bottom, spacing: 1) {
                        ForEach(Array(session.cpu.enumerated()), id: \.offset) { _, value in
                            Rectangle().fill(Color.cyan).frame(width: 3, height: max(1, 14 * value))
                        }
                    }.frame(height: 15)
                    Divider(); Text("内存 \(session.memory)")
                    icon("info.circle", "服务器详情") { details = true }
                        .popover(isPresented: $details) { MonitorDetails(session: session).id(session.id) }
                }
            }
            Text("UTF-8"); Divider()
            Text(session.message).lineLimit(1).help(session.message)
            Spacer()
        }.padding(.horizontal, 8).font(.system(size: 11)).task(id: "\(session.id)-\(session.monitor)-\(interval)") {
            guard session.monitor else { return }
            while !Task.isCancelled {
                do { try await Task.sleep(nanoseconds: UInt64(max(2, min(60, interval))) * 1_000_000_000) } catch { return }
                session.sample()
            }
        }
    }
}
