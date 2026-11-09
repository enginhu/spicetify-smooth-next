import Foundation

// WebSocket protocol pongs are handled by Chromium's networking stack even
// when its background page timers are throttled. Do not require JS heartbeats.
struct BridgeHealth {
    static let pingInterval: TimeInterval = 5
    static let timeout: TimeInterval = 20
    var lastResponse = Date.distantPast
    var lastPing = Date.distantPast

    mutating func received(at now: Date) { lastResponse = now }
    func isAlive(at now: Date) -> Bool { now.timeIntervalSince(lastResponse) < Self.timeout }
    mutating func shouldPing(at now: Date) -> Bool {
        guard now.timeIntervalSince(lastPing) >= Self.pingInterval else { return false }
        lastPing = now
        return true
    }
}

enum KeymapAction {
    case unchanged, reinstall, preserveExternalChange

    static func reconcile(current: [[String: UInt64]], original: [[String: UInt64]], installed: [[String: UInt64]]) -> Self {
        if current == installed { return .unchanged }
        if current == original { return .reinstall }
        return .preserveExternalChange
    }
}
