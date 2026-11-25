import SwiftUI

struct BookmarkEditor: View {
    let original: Bookmark?
    let commit: (Bookmark) -> Void
    @ViewState private var name: String
    @ViewState private var address: String
    @ViewState private var identity: String
    @ViewState private var jump: String
    @ViewState private var remember: Bool
    @ViewState private var password = ""
    @ViewState private var error = ""

    init(original: Bookmark?, commit: @escaping (Bookmark) -> Void) {
        self.original = original; self.commit = commit
        _name = ViewState(initialValue: original?.name ?? "")
        _address = ViewState(initialValue: original?.address ?? "")
        _identity = ViewState(initialValue: original?.identity ?? "")
        _jump = ViewState(initialValue: original?.jump ?? "")
        _remember = ViewState(initialValue: original?.portablePassword == true)
    }
    var body: some View {
        Form {
            TextField("名称", text: $name, prompt: Text("例如：开发机"))
            TextField("SSH 地址", text: $address, prompt: Text("user@host:port 或配置别名"))
            TextField("跳板机", text: $jump, prompt: Text("可选 · user@bastion:port"))
            HStack {
                TextField("私钥文件", text: $identity, prompt: Text("留空沿用 OpenSSH 配置"))
                Button("选择…") {
                    let panel = NSOpenPanel()
                    panel.showsHiddenFiles = true; panel.canChooseDirectories = false
                    if panel.runModal() == .OK, let url = panel.url { identity = url.path }
                }
            }
            Toggle("保存 SSH 登录密码", isOn: $remember)
            if remember {
                SecureField("密码", text: $password, prompt: Text(original?.portablePassword == true ? "地址不变时，留空保留原密码" : "登录密码"))
                Text("密码保存在便携加密库中；验证码请手动输入。").font(.caption).foregroundStyle(.secondary)
            }
            if !error.isEmpty { Text(error).foregroundStyle(.red) }
            HStack { Spacer(); Button("保存", action: save).keyboardShortcut(.defaultAction) }
        }.textFieldStyle(.roundedBorder)
    }
    private func save() {
        let address = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let jump = jump.trimmingCharacters(in: .whitespacesAndNewlines)
        guard Endpoint(address) != nil else { error = "请输入有效的 SSH 地址"; return }
        guard jump.isEmpty || (!jump.hasPrefix("ssh://") && Endpoint(jump) != nil) else {
            error = "跳板机格式：user@host:port 或 SSH 配置别名"; return
        }
        let key = (identity as NSString).expandingTildeInPath
        guard key.isEmpty || (key.hasPrefix("/") && FileManager.default.isReadableFile(atPath: key) &&
            (try? URL(fileURLWithPath: key).resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true) else {
            error = "请选择可读取的私钥文件"; return
        }
        let result = Bookmark(id: original?.id ?? UUID(), name: name.isEmpty ? address : name, address: address,
                              identity: key.isEmpty ? nil : key, jump: jump.isEmpty ? nil : jump, portablePassword: remember)
        do {
            if remember && password.isEmpty && (original?.portablePassword != true || result.account != original?.account) {
                throw TerminalError("请为此 SSH 地址输入密码，或关闭保存密码")
            }
            if remember && !password.isEmpty { try BookmarkPassword.save(password, account: result.account) }
            if let old = original, old.portablePassword == true, !remember || old.account != result.account {
                do { try BookmarkPassword.remove(old.account) }
                catch {
                    if remember && old.account != result.account { try BookmarkPassword.remove(result.account) }
                    throw error
                }
            }
            password = ""; commit(result)
        } catch { self.error = error.localizedDescription }
    }
}
