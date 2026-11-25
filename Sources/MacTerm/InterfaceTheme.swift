import SwiftUI

enum InterfaceTheme: String, CaseIterable {
    case dark, light, system

    var title: String {
        switch self { case .dark: return "深色"; case .light: return "浅色"; case .system: return "跟随系统" }
    }
    var scheme: ColorScheme? {
        switch self { case .dark: return .dark; case .light: return .light; case .system: return nil }
    }
    @MainActor static var initiallyLight: Bool {
        let theme = Preferences.shared.string(forKey: "interfaceTheme").flatMap(Self.init(rawValue:)) ?? .system
        if let scheme = theme.scheme { return scheme == .light }
        return NSApplication.shared.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .aqua
    }
}

// Read the application's effective appearance, upstream of the window's explicit color scheme.
@MainActor final class SystemAppearance: ObservableObject {
    @Published private(set) var light: Bool
    private var observer: NSKeyValueObservation?
    init() {
        let app = NSApplication.shared
        light = app.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .aqua
        observer = app.observe(\.effectiveAppearance) { [weak self] _, _ in
            Task { @MainActor in
                let next = NSApp.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .aqua
                if let self, self.light != next { self.light = next }
            }
        }
    }
}
