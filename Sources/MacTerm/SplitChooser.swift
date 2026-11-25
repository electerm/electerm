import SwiftUI

struct SplitChooser: View {
    @ObservedObject var work: Workspace
    let dismiss: () -> Void
    @ViewState private var count: Int
    @ViewState private var ids: [UUID]

    init(work: Workspace, dismiss: @escaping () -> Void) {
        self.work = work; self.dismiss = dismiss
        let visible = work.visibleSessions.map(\.id)
        _count = ViewState(initialValue: visible.count)
        _ids = ViewState(initialValue: visible)
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("窗格", selection: $count) {
                ForEach(1...min(4, max(1, work.sessions.count)), id: \.self) { Text("\($0)").tag($0) }
            }.pickerStyle(.segmented)
            Text("选择 \(count) 个标签 · 已选 \(ids.count)").foregroundStyle(.secondary)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 6) {
                    ForEach(work.sessions) { tab in
                        Toggle("\(tab.number)  \(tab.title)", isOn: Binding(get: { ids.contains(tab.id) }, set: { on in
                            if on { ids.append(tab.id) } else { ids.removeAll { $0 == tab.id } }
                        })).toggleStyle(.checkbox).disabled(!ids.contains(tab.id) && ids.count >= count)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }.frame(height: min(190, CGFloat(work.sessions.count) * 24))
            HStack {
                Spacer()
                Button("取消", action: dismiss).keyboardShortcut(.cancelAction)
                Button("应用") { if work.setPanes(ids) { dismiss() } }
                    .disabled(count != ids.count).keyboardShortcut(.defaultAction)
            }.buttonStyle(.bordered)
        }.padding(12).frame(width: 288)
        .onChange(of: count) { _, n in ids = Array(ids.prefix(n)) }
        .onChange(of: work.sessions.map(\.id)) { _, open in
            ids.removeAll { !open.contains($0) }; count = min(count, open.count)
        }
    }
}

struct TerminalPanes: View {
    @ObservedObject var work: Workspace
    let chrome: Color
    private var sessions: [Session] { work.visibleSessions }

    var body: some View {
        let panes = sessions
        if work.sessions.count == 1, let only = panes.first {
            terminal(only)
        } else {
            // Keep the same native containers when rearranging existing tabs.
            VSplitView {
                row(panes.prefix(2))
                if panes.count > 2 { row(panes.dropFirst(2)) }
            }
        }
    }
    private func row(_ panes: ArraySlice<Session>) -> some View {
        HSplitView {
            ForEach(panes) { session in terminal(session) }
        }
    }
    private func terminal(_ session: Session) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 2) {
                ScrollView(.horizontal) {
                    HStack(spacing: 3) {
                        ForEach(work.tabs(in: session.id)) { tab in
                            let visible = tab.id == session.id
                            let tint: Color = tab.id == work.selected ? .accentColor : .secondary
                            HStack(spacing: 4) {
                                Button { work.choose(tab) } label: {
                                    HStack(spacing: 4) {
                                        Text("\(tab.number)").font(.system(size: 10, weight: .medium)).monospacedDigit()
                                            .padding(.horizontal, 4).frame(height: 15)
                                            .foregroundStyle(visible ? Color.primary : .secondary)
                                            .background(tint.opacity(visible ? 0.20 : 0.09), in: RoundedRectangle(cornerRadius: 4))
                                        Text(tab.title).foregroundStyle(visible ? Color.primary : .secondary).lineLimit(1)
                                    }
                                }
                                icon("xmark", "关闭标签") { work.close(tab) }.font(.system(size: 9)).foregroundStyle(.secondary)
                            }.padding(.horizontal, 6).frame(height: 23)
                            .background(Color.primary.opacity(visible ? 0.10 : 0), in: RoundedRectangle(cornerRadius: 6))
                            .draggable("electerm-tab:" + tab.id.uuidString)
                            .dropDestination(for: String.self) { items, _ in
                                guard let item = items.first, item.hasPrefix("electerm-tab:"),
                                      let id = UUID(uuidString: String(item.dropFirst("electerm-tab:".count))) else { return false }
                                return work.moveTab(id, to: tab.id)
                            }
                        }
                        icon("plus", "新建本地终端") { work.choose(session); work.add() }.padding(.horizontal, 5)
                    }.padding(.horizontal, 4)
                }.scrollIndicators(.hidden)
            }.frame(height: 28).background(chrome)
            TerminalView(session: session).id(session.id).frame(minWidth: 48, minHeight: 32)
        }
    }
}
