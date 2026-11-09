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

enum DeviceMappings {
    static let sourceKey = "HIDKeyboardModifierMappingSrc"
    static let destinationKey = "HIDKeyboardModifierMappingDst"
    static let fadeKey: UInt64 = 0x70000006F // F20
    static let nextTrack: UInt64 = 0xC000000B5
    static let previousTrack: UInt64 = 0xC000000B6
    static let doNotDisturb: UInt64 = 0x10000009B
    static let voiceCommand: UInt64 = 0xC000000CF

    static func known(vendor: Int, product: Int) -> Bool {
        (vendor == 2070 && product == 9332) || (vendor == 13357 && product == 58321)
    }

    static func additions(vendor: Int, product: Int, gmmkEnabled: Bool, fadeEnabled: Bool) -> [[String: UInt64]] {
        func map(_ source: UInt64, _ destination: UInt64) -> [String: UInt64] {
            [sourceKey: source, destinationKey: destination]
        }
        if vendor == 2070 && product == 9332 {
            return fadeEnabled ? [map(nextTrack, fadeKey)] : []
        }
        if vendor == 13357 && product == 58321 && gmmkEnabled {
            // The GMMK3 Mac layer emits these HID usages for Fn+F5/F6.
            // Plain F5/F6 and modifier keys are not remapped.
            return [map(doNotDisturb, fadeEnabled ? fadeKey : nextTrack),
                    map(voiceCommand, previousTrack)]
        }
        return []
    }
}
