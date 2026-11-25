import SwiftUI

enum PortableData {
    static let folder = Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("Electerm Data", isDirectory: true)
    static func directory(_ url: URL) throws {
        let fm = FileManager.default
        if !fm.fileExists(atPath: url.path) {
            try fm.createDirectory(at: url, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
        }
        let item = try fm.attributesOfItem(atPath: url.path)
        guard item[.type] as? FileAttributeType == .typeDirectory, (item[.ownerAccountID] as? NSNumber)?.uint32Value == getuid() else {
            throw TerminalError("数据目录必须是当前用户拥有的目录：\(url.path)")
        }
        if (item[.posixPermissions] as? NSNumber)?.intValue != 0o700 {
            try fm.setAttributes([.posixPermissions: 0o700], ofItemAtPath: url.path)
        }
    }
    private(set) static var temporary = FileManager.default.temporaryDirectory
    static func prepare() throws {
        try directory(folder)
        temporary = folder.appendingPathComponent("Temp")
        try directory(temporary)
        let lock = Darwin.open(folder.path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW)
        guard lock >= 0 else { throw POSIXError(.EACCES) }
        guard flock(lock, LOCK_EX | LOCK_NB) == 0 else { close(lock); throw TerminalError("此便携目录已由另一实例使用") }
        // Keep the directory descriptor until process exit. No lock file survives a crash.
        guard FileManager.default.changeCurrentDirectoryPath(folder.path) else { throw TerminalError("无法进入数据目录") }
        try Preferences.shared.open(at: folder.appendingPathComponent("settings.plist"))
    }
}

// AppKit owns its own defaults. Application settings and bookmarks have a separate, explicit file.
final class Preferences: ObservableObject {
    static let shared = Preferences()
    private var values: [String: Any] = [:]
    private var file: URL?
    func open(at url: URL) throws {
        if FileManager.default.fileExists(atPath: url.path) {
            guard let content = try PropertyListSerialization.propertyList(from: Data(contentsOf: url), format: nil) as? [String: Any] else {
                throw TerminalError("设置文件格式无效：\(url.path)")
            }
            values = content
        } else {
            values = [:]
        }
        file = url
    }
    private func write(_ content: [String: Any], to url: URL) throws {
        try PropertyListSerialization.data(fromPropertyList: content, format: .binary, options: 0).write(to: url, options: .atomic)
    }
    func object(forKey key: String) -> Any? { values[key] }
    func string(forKey key: String) -> String? { values[key] as? String }
    func data(forKey key: String) -> Data? { values[key] as? Data }
    func bool(forKey key: String) -> Bool { values[key] as? Bool ?? false }
    func integer(forKey key: String) -> Int { values[key] as? Int ?? 0 }
    func double(forKey key: String) -> Double { values[key] as? Double ?? 0 }
    func set(_ value: Any?, forKey key: String) {
        if let old = values[key] as? NSObject { if old.isEqual(value) { return } }
        else if value == nil { return }
        var next = values; next[key] = value.map { $0 as AnyObject }
        do {
            if let file { try write(next, to: file) }
            objectWillChange.send(); values = next
        } catch {
            DispatchQueue.main.async { NSAlert(error: error).runModal() }
        }
    }
}

@propertyWrapper struct PortableSetting<Value>: DynamicProperty {
    private var store: Preferences { .shared }
    let key: String, fallback: Value
    let decode: (Any?) -> Value?, encode: (Value) -> Any
    init(wrappedValue: Value, _ key: String) {
        self.key = key; fallback = wrappedValue; decode = { $0 as? Value }; encode = { $0 }
    }
    init(wrappedValue: Value, _ key: String) where Value: RawRepresentable, Value.RawValue == String {
        self.key = key; fallback = wrappedValue; decode = { ($0 as? String).flatMap(Value.init(rawValue:)) }; encode = { $0.rawValue }
    }
    var wrappedValue: Value {
        get { decode(store.object(forKey: key)) ?? fallback }
        nonmutating set { store.set(encode(newValue), forKey: key) }
    }
    var projectedValue: Binding<Value> { Binding(get: { wrappedValue }, set: { wrappedValue = $0 }) }
}
