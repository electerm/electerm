import SwiftUI
import UniformTypeIdentifiers

struct FilePane: View {
    @ObservedObject private var preferences = Preferences.shared
    @ObservedObject var session: Session
    @ViewState private var draft = ""
    @PortableSetting("showHiddenFiles") private var hidden = false
    @PortableSetting("fileSizeColumn") private var sizes = false
    @PortableSetting("fileDateColumn") private var dates = false
    @ViewState private var prompt: FilePrompt?
    @ViewState private var input = ""
    @ViewState private var selection: RemoteFile?
    @ViewState private var selectionListing: UUID?
    private var selected: RemoteFile? {
        guard selectionListing == session.entries.id, let selection, hidden || !selection.name.hasPrefix(".") else { return nil }
        return selection
    }

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
            HStack(spacing: 4) {
                Text("名称")
                Spacer(minLength: 2)
                Menu {
                    Button("新建文件…") { ask(.file) }
                    Button("新建文件夹…") { ask(.folder) }
                } label: { Image(systemName: "plus").frame(width: 18, height: 20) }
                    .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                    .accessibilityLabel("新建").help("新建文件或文件夹").disabled(!ready)
                icon("tray.and.arrow.up", "上传文件") { upload() }.disabled(!ready)
                icon("tray.and.arrow.down", "下载选中的文件或文件夹") {
                    if let selected { download(selected, parent: session.path, connection: session.connectionID) }
                }.disabled(!ready || selected == nil)
            }.frame(height: 23)
            TransferCard(status: session.transferStatus, cancel: session.cancelTransfer)
            FileRows(session: session, parent: session.path, connection: session.connectionID,
                     files: session.entries.includingHidden(hidden), hidden: hidden, sizes: sizes, dates: dates, ready: ready,
                     selected: selected?.name, select: { file in selection = file; selectionListing = session.entries.id },
                     ask: ask, download: download)
                .equatable()
                .contextMenu {
                    Button("新建文件…") { ask(.file) }.disabled(!ready)
                    Button("新建文件夹…") { ask(.folder) }.disabled(!ready)
                }
        }.font(.system(size: 12)).padding(.horizontal, 5)
        .onAppear { draft = session.path }.onChange(of: session.path) { _, path in draft = path }
        .sheet(item: $prompt) { item in
            VStack(alignment: .leading, spacing: 12) {
                Text(item.action.title).font(.headline)
                Text(verbatim: item.name.map { (item.parent as NSString).appendingPathComponent($0) } ?? item.parent)
                    .font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                if item.action.deletes {
                    Text("此操作不可撤销。目录必须为空；符号链接仅移除链接本身。").foregroundStyle(.secondary)
                } else { TextField("名称", text: $input).textFieldStyle(.roundedBorder) }
                HStack {
                    Spacer()
                    Button("取消") { prompt = nil }.keyboardShortcut(.cancelAction)
                    Button(item.action.deletes ? "删除" : "确定", role: item.action.deletes ? .destructive : nil) {
                        session.edit(item.action.operation(input), parent: item.parent, name: item.name ?? input, connection: item.connection)
                        prompt = nil
                    }.keyboardShortcut(item.action.deletes ? nil : .defaultAction)
                        .disabled(session.working || item.connection != session.connectionID || (!item.action.deletes && !SFTP.validName(input)))
                }.buttonStyle(.bordered)
            }.padding(18).frame(width: 360)
        }
        .dropDestination(for: URL.self) { urls, _ in
            guard ready, urls.count == 1, let url = urls.first, url.isFileURL,
                  (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true else { return false }
            session.transfer(url.lastPathComponent, url, upload: true, parent: session.path, connection: session.connectionID)
            return true
        }
    }
    private var ready: Bool { session.live && session.path.hasPrefix("/") && !session.working }
    private func ask(_ action: FileAction, _ file: RemoteFile? = nil, parent: String? = nil, connection: UUID? = nil) {
        input = action == .rename ? file?.name ?? "" : ""
        prompt = FilePrompt(action: action, parent: parent ?? session.path, connection: connection ?? session.connectionID, name: file?.name)
    }
    private func upload() {
        let parent = session.path, connection = session.connectionID, panel = NSOpenPanel()
        panel.canChooseDirectories = false
        if panel.runModal() == .OK, let url = panel.url {
            session.transfer(url.lastPathComponent, url, upload: true, parent: parent, connection: connection)
        }
    }
    private func download(_ file: RemoteFile, parent: String, connection: UUID) {
        if file.directory {
            let panel = NSOpenPanel()
            panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.canCreateDirectories = true
            panel.prompt = "下载到此处"
            panel.message = "选择存放“\(file.name)”的位置。同名目录不会被覆盖；符号链接和特殊文件将跳过。"
            if panel.runModal() == .OK, let parentURL = panel.url {
                session.transfer(file.name, parentURL.appendingPathComponent(file.name), upload: false,
                                 parent: parent, connection: connection, directory: true)
            }
            return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = file.name
        if panel.runModal() == .OK, let url = panel.url {
            session.transfer(file.name, url, upload: false, parent: parent, connection: connection)
        }
    }
}

private enum FileAction: Equatable {
    case file, folder, rename, remove(Bool)
    var deletes: Bool { if case .remove = self { return true }; return false }
    var title: String {
        switch self { case .file: return "新建文件"; case .folder: return "新建文件夹"; case .rename: return "重命名"; case .remove: return "删除远端项目" }
    }
    func operation(_ input: String) -> SFTP.Edit {
        switch self { case .file: return .file; case .folder: return .folder; case .rename: return .rename(input); case .remove(let dir): return .remove(directory: dir) }
    }
}
private struct FilePrompt: Identifiable {
    let id = UUID(), action: FileAction, parent: String, connection: UUID, name: String?
}

private struct FileRows: View, Equatable {
    let session: Session, parent: String, connection: UUID
    let files: FileListing, hidden: Bool, sizes: Bool, dates: Bool, ready: Bool
    let selected: String?, select: (RemoteFile?) -> Void
    let ask: (FileAction, RemoteFile?, String?, UUID?) -> Void, download: (RemoteFile, String, UUID) -> Void
    static func == (a: Self, b: Self) -> Bool {
        a.files.id == b.files.id && a.parent == b.parent && a.connection == b.connection &&
        a.selected == b.selected && a.hidden == b.hidden && a.sizes == b.sizes && a.dates == b.dates && a.ready == b.ready
    }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                row("..", "arrow.turn.up.left", nil)
                    .onTapGesture(count: 2) { session.refresh(session.child("..")) }
                    .onTapGesture { select(nil) }
                ForEach(files) { file in
                    let entry = row(file.name, file.directory ? "folder" : file.link ? "link" : "doc", file)
                        .onTapGesture(count: 2) {
                            if file.directory { session.refresh((parent as NSString).appendingPathComponent(file.name)) }
                            else if ready { download(file, parent, connection) }
                        }.onTapGesture { select(file) }
                        .contextMenu {
                            Button(file.directory ? "下载文件夹…" : "下载…") { download(file, parent, connection) }.disabled(!ready)
                            Button("重命名…") { ask(.rename, file, parent, connection) }.disabled(!ready)
                            Button("删除…", role: .destructive) { ask(.remove(file.directory), file, parent, connection) }.disabled(!ready)
                        }
                    // Give the lazy stack one stable row per file, including when drag support differs.
                    VStack(spacing: 0) {
                        if file.directory { entry } else { entry.onDrag { session.fileProvider(file.name, parent: parent, connection: connection) } }
                    }
                }
            }
        }
    }
    private func row(_ name: String, _ image: String, _ file: RemoteFile?) -> some View {
        HStack(spacing: 4) {
            Image(systemName: image).foregroundStyle(file?.directory == true ? Color.accentColor : .secondary)
            Text(verbatim: name).lineLimit(1).truncationMode(.middle)
            Spacer(minLength: 0)
            if sizes, let size = file?.size, file?.directory == false {
                Text(ByteCountFormatter.string(fromByteCount: Int64(clamping: size), countStyle: .file))
                    .foregroundStyle(.secondary).font(.caption2)
            }
            if dates, let date = file?.modified {
                Text(date.formatted(.dateTime.year().month().day())).foregroundStyle(.secondary).font(.caption2)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).frame(height: 22)
            .background(selected == name ? Color.accentColor.opacity(0.20) : .clear).contentShape(Rectangle())
    }
}

struct StatusLine: View {
    @ObservedObject private var preferences = Preferences.shared
    @ObservedObject var session: Session
    @PortableSetting("monitorInterval") private var interval = 3
    @PortableSetting("monitorCPU") private var showCPU = true
    @PortableSetting("monitorMemory") private var showMemory = true
    @ViewState private var details = false
    private var needsCPU: Bool { showCPU || details }
    private var needsMemory: Bool { showMemory || details }
    var body: some View {
        HStack(spacing: 9) {
            if session.endpoint != nil {
                icon("gauge.with.dots.needle.50percent", "远程监控") {
                    session.monitor.toggle()
                }.foregroundStyle(session.monitor ? Color.cyan : .secondary)
                if session.monitor {
                    Divider()
                    if showCPU {
                        Text("CPU \(session.cpuLabel)").monospacedDigit().help("整机 CPU，100% 减去 idle 和 iowait")
                    }
                    if showMemory { Divider(); Text("内存 \(session.memory)").monospacedDigit() }
                    icon("info.circle", "服务器详情") { details = true }
                        .popover(isPresented: $details) { MonitorDetails(session: session).id(session.id) }
                }
            }
            Text("UTF-8"); Divider()
            Text(session.message).lineLimit(1).help(session.message)
            Spacer()
        }.padding(.horizontal, 8).font(.system(size: 11)).task(id: "\(session.id)-\(session.monitor)-\(interval)-\(needsCPU)-\(needsMemory)") {
            guard session.monitor, needsCPU || needsMemory else { return }
            session.resetSample()
            while !Task.isCancelled {
                session.sample(cpuEnabled: needsCPU, memoryEnabled: needsMemory)
                do { try await Task.sleep(nanoseconds: UInt64(max(2, min(60, interval))) * 1_000_000_000) } catch { return }
            }
        }
    }
}
