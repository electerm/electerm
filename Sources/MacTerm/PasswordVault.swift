import AppKit
import CryptoKit
import CommonCrypto

// The salt and authenticated ciphertext travel with the application; the master password does not.
@MainActor final class PasswordVault {
    static let shared = PasswordVault(file: PortableData.folder.appendingPathComponent("passwords.v1"))
    let file: URL
    private var cached: SymmetricKey?
    init(file: URL) { self.file = file }
    private func unlock(create: Bool, password: (Bool) throws -> String) throws -> (Data, SymmetricKey, [String: Data]) {
        let exists = FileManager.default.fileExists(atPath: file.path)
        guard exists || create else { throw TerminalError("便携密码库不存在") }
        let data = exists ? try Data(contentsOf: file) : Data()
        guard !exists || data.count >= 44 else { throw TerminalError("密码库文件不完整") }
        let salt = exists ? Data(data.prefix(16)) : SymmetricKey(size: .bits128).withUnsafeBytes { Data($0) }
        let key: SymmetricKey
        if exists, let cached { key = cached }
        else {
            let phrase = try password(!exists)
            var bytes = [UInt8](repeating: 0, count: 32)
            defer { bytes.withUnsafeMutableBytes { _ = memset_s($0.baseAddress, $0.count, 0, $0.count) } }
            let ok = salt.withUnsafeBytes { saltBytes in
                CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), phrase, phrase.utf8.count,
                    saltBytes.bindMemory(to: UInt8.self).baseAddress, salt.count, CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                    600_000, &bytes, 32)
            }
            guard ok == kCCSuccess else { throw TerminalError("无法派生密码库密钥") }
            key = SymmetricKey(data: bytes)
        }
        var entries: [String: Data] = [:]
        if exists {
            do {
                let clear = try AES.GCM.open(AES.GCM.SealedBox(combined: data.dropFirst(16)), using: key)
                entries = try PropertyListDecoder().decode([String: Data].self, from: clear)
            } catch { cached = nil; throw TerminalError("主密码不正确，或密码库文件已损坏") }
        }
        cached = key
        return (salt, key, entries)
    }
    func read(_ account: String, password: (Bool) throws -> String) throws -> Data {
        let (_, _, entries) = try unlock(create: false, password: password)
        guard let result = entries[account] else { throw TerminalError("密码库中没有此书签的密码") }
        return result
    }
    func set(_ value: Data?, account: String, password: (Bool) throws -> String) throws {
        if value == nil && !FileManager.default.fileExists(atPath: file.path) { return }
        var (salt, key, entries) = try unlock(create: value != nil, password: password)
        entries[account] = value
        if entries.isEmpty { try FileManager.default.removeItem(at: file); cached = nil; return }
        let clear = try PropertyListEncoder().encode(entries)
        salt.append(try AES.GCM.seal(clear, using: key).combined!)
        try salt.write(to: file, options: .atomic)
    }
    static func prompt(create: Bool) throws -> String {
        let alert = NSAlert()
        alert.messageText = create ? "设置便携密码库主密码" : "解锁便携密码库"
        alert.informativeText = create ? "至少 8 个字符。忘记后无法找回已保存的 SSH 密码。" : "本次运行只需解锁一次。"
        let field = NSSecureTextField(frame: NSRect(x: 0, y: create ? 30 : 0, width: 280, height: 24))
        field.placeholderString = "主密码"
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 280, height: create ? 54 : 24))
        view.addSubview(field)
        let repeatField = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        if create { repeatField.placeholderString = "再次输入主密码"; view.addSubview(repeatField) }
        alert.accessoryView = view; alert.addButton(withTitle: create ? "创建" : "解锁"); alert.addButton(withTitle: "取消")
        alert.window.initialFirstResponder = field
        guard alert.runModal() == .alertFirstButtonReturn else { throw TerminalError("已取消密码库操作") }
        if create && (field.stringValue.count < 8 || field.stringValue != repeatField.stringValue) { throw TerminalError("主密码至少 8 个字符，且两次输入必须相同") }
        return field.stringValue
    }
}
