// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ElectermMac",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "ElectermMac", targets: ["MacTerm"])],
    dependencies: [.package(path: ".build/vendor/SwiftTerm")],
    targets: [
        .target(name: "TerminalPTY"),
        .executableTarget(name: "MacTerm", dependencies: [
            "TerminalPTY", .product(name: "SwiftTerm", package: "SwiftTerm")
        ]),
        .testTarget(name: "MacTermTests", dependencies: ["MacTerm"])
    ]
)
