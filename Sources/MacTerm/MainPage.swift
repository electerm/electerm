import SwiftUI

private extension Color { init(hex: Int) { self.init(nsColor: NSColor(rgb: hex)) } }
private enum Panel: String, Identifiable { case bookmark, settings; var id: String { rawValue } }

struct MainPage: View {
    @ObservedObject var work: Workspace
    @AppStorage("lightChrome") private var light = false
    @AppStorage("sidebarWidth") private var sidebarWidth = 224.0
    @AppStorage("fontSize") private var fontSize = 13.0
    @AppStorage("keepalive") private var keepalive = true
    @AppStorage("shellTracking") private var shellTracking = true
    @AppStorage("scrollback") private var scrollback = 3000
    @AppStorage("defaultWrap") private var defaultWrap = true
    @AppStorage("defaultFollow") private var defaultFollow = true
    @AppStorage("showHiddenFiles") private var showHiddenFiles = false
    @AppStorage("defaultMonitor") private var defaultMonitor = false
    @AppStorage("monitorInterval") private var monitorInterval = 3
    @State private var quick = ""
    @State private var name = ""
    @State private var address = ""
    @State private var validation = ""
    @State private var panel: Panel?
    @State private var search = false
    @State private var searchText = ""
    @State private var draggingFrom: Double?
    private var chrome: Color { Color(hex: light ? 0xe3e7eb : 0x151515) }
    private var bodyColor: Color { Color(hex: light ? 0xf6f7f8 : 0x222222) }
    private var edge: Color { Color(hex: light ? 0xc6ccd0 : 0x484848) }

    var body: some View {
        Group {
            if let s = work.current {
                page(s)
            }
        }
        .font(.system(size: 12)).buttonStyle(.plain)
        .preferredColorScheme(light ? .light : .dark)
        .sheet(item: $panel) { item in
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text(item == .bookmark ? "新建书签" : "设置").font(.headline)
                    Spacer(); icon("xmark", "关闭") { panel = nil }.keyboardShortcut(.cancelAction)
                }
                if item == .bookmark {
                    TextField("名称", text: $name)
                    TextField("SSH 地址：user@host:port", text: $address)
                    if !validation.isEmpty { Text(validation).foregroundStyle(.red) }
                    Button("保存") {
                        guard Endpoint(address) != nil else { validation = "请输入有效的 SSH 地址"; return }
                        work.bookmarks.append(Bookmark(name: name.isEmpty ? address : name, address: address))
                        panel = nil
                    }.keyboardShortcut(.defaultAction)
                } else {
                    Form {
                        Section("终端") {
                            Stepper("终端字号：\(Int(fontSize))", value: $fontSize, in: 9...28)
                            Stepper("历史行数（新标签）：\(scrollback)", value: $scrollback, in: 500...20000, step: 500)
                            Toggle("自动换行（新标签）", isOn: $defaultWrap)
                            Toggle("浅色界面", isOn: $light)
                        }
                        Section("SSH 与文件") {
                            Toggle("SSH 保活（新连接）", isOn: $keepalive)
                            Toggle("探测远程 shell 目录（新连接）", isOn: $shellTracking)
                            Toggle("SFTP 跟随终端（新标签）", isOn: $defaultFollow)
                            Toggle("显示隐藏文件", isOn: $showHiddenFiles)
                        }
                        Section("远程监控") {
                            Toggle("连接时开启监控（新标签）", isOn: $defaultMonitor)
                            Picker("采样间隔", selection: $monitorInterval) {
                                ForEach([2, 3, 5, 10], id: \.self) { Text("\($0) 秒").tag($0) }
                            }
                        }
                    }.formStyle(.grouped).frame(height: 400)
                }
            }.padding(18).frame(width: 350)
        }
    }
    private func page(_ s: Session) -> some View {
        ObservedSession(session: s) { s in
            GeometryReader { g in
                let width = s.pane == .hidden ? 28.0 : max(150, min(sidebarWidth, g.size.width * 0.48))
                VStack(spacing: 0) {
                    ScrollView(.horizontal) {
                        HStack(spacing: 15) {
                            tool("doc.badge.plus", "新建书签", .cyan) {
                                name = ""; address = ""; validation = ""; panel = .bookmark
                            }
                            tool("terminal.fill", "本地", .green) { work.add() }
                            if s.endpoint != nil {
                                Toggle("SFTP 与终端同步", isOn: Binding(get: { s.follow }, set: s.setFollow))
                                    .toggleStyle(.checkbox)
                                tool("heart", "保活", keepalive ? .cyan : .primary) {
                                    keepalive.toggle()
                                    s.message = keepalive ? "SSH 保活将在下次连接时开启" : "SSH 保活将在下次连接时关闭"
                                }
                            }
                            tool("point.3.connected.trianglepath.dotted", "广播输入", work.sendToAll ? .cyan : .primary) {
                                work.sendToAll.toggle()
                            }
                            tool("arrow.left.and.right", s.wrap ? "禁用换行" : "启用换行", .primary) {
                                s.wrap.toggle(); s.screen.setWrap(s.wrap)
                            }
                            tool("arrow.up.left.and.arrow.down.right", "全屏", .primary) { NSApp.keyWindow?.toggleFullScreen(nil) }
                            tool("magnifyingglass", "搜索", .primary) { search.toggle() }
                            Spacer(minLength: 14)
                            tool("rectangle.split.2x1", "分屏", .primary) { work.split() }
                            tool("gearshape.fill", "设置", .primary) { panel = .settings }
                            tool(light ? "moon" : "sun.max", "界面主题", .primary) { light.toggle() }
                        }.padding(.horizontal, 10).frame(minWidth: g.size.width, alignment: .leading).frame(height: 36)
                    }.scrollIndicators(.hidden).frame(height: 36).background(chrome)
                    edge.frame(height: 1)
                    HStack(spacing: 0) {
                        VStack(spacing: 0) {
                            if s.pane != .hidden {
                                HStack(spacing: 4) {
                                    TextField("快速连接", text: $quick).onSubmit { connect(s) }.textFieldStyle(.plain)
                                    icon("arrow.right", "SSH 连接") { connect(s) }.disabled(quick.isEmpty)
                                }.padding(.horizontal, 7).frame(height: 28).background(chrome)
                            }
                            HStack(alignment: .top, spacing: 0) {
                                VStack(spacing: 0) {
                                    railButton("bookmark", "书签夹", selected: s.pane == .bookmarks) { s.toggle(.bookmarks) }
                                    if s.endpoint != nil {
                                        railButton("folder", "远程文件", selected: s.pane == .files) { s.toggle(.files) }
                                    }
                                    Spacer()
                                }.frame(width: 28).background(chrome)
                                if s.pane != .hidden {
                                    Group {
                                        if s.pane == .bookmarks { BookmarkList(work: work) }
                                        else { FilePane(session: s) }
                                    }.frame(minWidth: 0, maxWidth: .infinity).clipped()
                                }
                            }
                        }.frame(width: width).background(bodyColor)
                        if s.pane != .hidden {
                            Rectangle().fill(edge).frame(width: 2).overlay {
                                Color.clear.frame(width: 8).contentShape(Rectangle()).gesture(
                                    DragGesture(coordinateSpace: .global).onChanged { value in
                                        if draggingFrom == nil { draggingFrom = width }
                                        sidebarWidth = min(g.size.width * 0.48, max(150, (draggingFrom ?? width) + value.translation.width))
                                    }.onEnded { _ in draggingFrom = nil })
                            }
                        }
                        VStack(spacing: 0) {
                            HStack(spacing: 2) {
                                ScrollView(.horizontal) {
                                    HStack(spacing: 1) {
                                        ForEach(work.sessions) { tab in
                                            HStack(spacing: 5) {
                                                Button { work.choose(tab) } label: {
                                                    HStack(spacing: 4) {
                                                        Text("\(tab.number)").padding(.horizontal, 3).background(Color.blue).foregroundStyle(.white)
                                                        Text(tab.title).lineLimit(1)
                                                    }
                                                }
                                                icon("xmark", "关闭标签") { work.close(tab) }
                                            }.padding(.horizontal, 6).frame(height: 27)
                                            .background(tab.id == s.id ? bodyColor : chrome)
                                            .overlay(alignment: .top) { if tab.id == s.id { Color.cyan.frame(height: 2) } }
                                        }
                                        icon("plus", "新建本地终端") { work.add() }.padding(.horizontal, 5)
                                    }
                                }.scrollIndicators(.hidden)
                            }.frame(height: 28).background(chrome)
                            if search {
                                HStack {
                                    TextField("搜索终端历史", text: $searchText).onSubmit {
                                        s.message = s.screen.find(searchText) ? "" : "无匹配"
                                    }
                                    icon("xmark", "关闭搜索") { search = false }
                                }.padding(.horizontal, 6).frame(height: 26)
                            }
                            if let other = work.sessions.first(where: { $0.id == work.secondary && $0.id != s.id }) {
                                HSplitView {
                                    TerminalView(session: s, pointSize: fontSize).id(s.id)
                                    TerminalView(session: other, pointSize: fontSize).id(other.id)
                                }
                            } else { TerminalView(session: s, pointSize: fontSize).id(s.id) }
                        }
                    }
                    StatusLine(session: s).frame(height: 24).background(bodyColor)
                }
            }
        }
    }
    private func connect(_ s: Session) {
        guard !quick.isEmpty else { return }
        if work.add(quick) == nil { s.message = "无效的 SSH 地址，请使用 user@host:port" }
    }
}

private struct ObservedSession<Content: View>: View {
    @ObservedObject var session: Session
    @ViewBuilder var content: (Session) -> Content
    var body: some View { content(session) }
}

private func railButton(_ image: String, _ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: selected ? image + ".fill" : image)
            .foregroundStyle(selected ? Color.accentColor : Color.primary)
            .frame(width: 28, height: 28)
            .background(selected ? Color.accentColor.opacity(0.16) : .clear)
            .contentShape(Rectangle())
    }.buttonStyle(.plain).accessibilityLabel(title).help(title)
}

func icon(_ image: String, _ title: String, _ action: @escaping () -> Void) -> some View {
    Button(action: action) { Image(systemName: image).frame(minWidth: 17, minHeight: 18) }
        .accessibilityLabel(title).help(title)
}

private func tool(_ image: String, _ title: String, _ tint: Color, _ action: @escaping () -> Void) -> some View {
    Button(action: action) {
        HStack(spacing: 4) { Image(systemName: image).foregroundStyle(tint); Text(title) }
    }.help(title)
}

private struct BookmarkList: View {
    @ObservedObject var work: Workspace
    @State private var selection: UUID?
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Label("SSH 书签夹", systemImage: "folder.fill").frame(height: 28)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(work.bookmarks) { b in
                        Label(b.name, systemImage: "terminal").lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                            .frame(height: 21).background(selection == b.id ? Color.accentColor.opacity(0.28) : .clear)
                            .contentShape(Rectangle())
                            .onTapGesture(count: 2) { work.add(b.address) }
                            .onTapGesture { selection = b.id }
                            .contextMenu { Button("删除书签") { work.bookmarks.removeAll { $0.id == b.id } } }
                    }
                }
            }
        }.padding(.horizontal, 5).frame(maxWidth: .infinity, alignment: .leading)
    }
}
