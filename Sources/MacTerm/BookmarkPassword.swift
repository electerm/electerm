import Foundation
import TerminalPTY

enum BookmarkPassword {
    @MainActor static func save(_ value: String, account: String) throws {
        guard !value.isEmpty, value.utf8.count <= 1000,
              value.rangeOfCharacter(from: .controlCharacters) == nil else { throw TerminalError("密码不可含控制字符，且不能超过 1000 字节") }
        try PasswordVault.shared.set(Data(value.utf8), account: account, password: PasswordVault.prompt)
    }
    @MainActor static func remove(_ account: String) throws {
        try PasswordVault.shared.set(nil, account: account, password: PasswordVault.prompt)
    }

}

// No listener for ordinary connections. Retire it after authentication or disconnect.
@MainActor final class PasswordChannel {
    let environment: [String: String]
    private let source: DispatchSourceRead
    var pid: pid_t = 0

    init(directory: URL, target: String, readPassword: @escaping () -> Data?) throws {
        let path = directory.appendingPathComponent("password").path
        guard let helper = Bundle.main.executableURL?.path else { throw TerminalError("找不到 SSH 密码助手") }
        let fd = term_password_listener("Temp/" + directory.lastPathComponent + "/password")
        guard fd >= 0 else { throw TerminalError("无法建立本地密码通道") }
        environment = ["SSH_ASKPASS": helper, "SSH_ASKPASS_REQUIRE": "force",
                       "ELECTERM_ASKPASS_SOCKET": "./password", "ELECTERM_ASKPASS_PROMPT": target + "'s password: "]
        source = DispatchSource.makeReadSource(fileDescriptor: fd, queue: .main)
        source.setCancelHandler { close(fd); unlink(path) }
        source.setEventHandler { [weak self] in
            guard let self else { return }
            let peer = term_password_accept(fd, self.pid, helper)
            guard peer >= 0 else { return }
            self.source.cancel() // Only one saved-password attempt per connection.
            DispatchQueue.global(qos: .userInitiated).async {
                defer { close(peer) }
                if var data = readPassword() {
                    data.append(10)
                    _ = data.withUnsafeBytes { write(peer, $0.baseAddress, $0.count) }
                    data.resetBytes(in: 0..<data.count)
                }
            }
        }
        source.resume()
    }
    deinit { source.cancel() }
}
