import Foundation

@main
enum BridgeStateTests {
    static func main() {
        var passed = 0
        func check(_ value: @autoclosure () -> Bool, _ label: String) {
            guard value() else { fatalError("FAIL: \(label)") }
            passed += 1
            print("PASS: \(label)")
        }
        let start = Date(timeIntervalSince1970: 1000)
        var health = BridgeHealth()
        check(!health.isAlive(at: start), "no connection is not healthy")
        health.received(at: start)
        check(health.shouldPing(at: start), "new connection gets an immediate protocol ping")
        check(!health.shouldPing(at: start.addingTimeInterval(4)), "pings are bounded to one per five seconds")
        check(health.shouldPing(at: start.addingTimeInterval(5)), "protocol ping renews after five seconds")
        // Simulate five minutes with no JavaScript status timers, but normal
        // WebSocket protocol pongs from Chromium's networking stack.
        for seconds in stride(from: 5, through: 300, by: 5) {
            let now = start.addingTimeInterval(Double(seconds))
            guard health.isAlive(at: now) else { fatalError("Background connection expired") }
            health.received(at: now)
        }
        check(health.isAlive(at: start.addingTimeInterval(319)), "native pongs keep a throttled background page connected")
        check(!health.isAlive(at: start.addingTimeInterval(320)), "missing protocol pongs still expire a dead connection")

        let original: [[String: UInt64]] = [["src": 4, "dst": 5]]
        let installed = original + [["src": 181, "dst": 111]]
        check(KeymapAction.reconcile(current: installed, original: original, installed: installed) == .unchanged,
              "an installed map is not rewritten")
        check(KeymapAction.reconcile(current: original, original: original, installed: installed) == .reinstall,
              "a map reset after wake is installed again")
        check(KeymapAction.reconcile(current: [], original: [], installed: installed) == .reinstall,
              "a reset originally empty map is restored")
        check(KeymapAction.reconcile(current: [["src": 181, "dst": 112]], original: original, installed: installed) == .preserveExternalChange,
              "another remapper's change is preserved")
        let src = DeviceMappings.sourceKey, dst = DeviceMappings.destinationKey
        let gmmkNative = DeviceMappings.additions(vendor: 13357, product: 58321, gmmkEnabled: true, fadeEnabled: false)
        let gmmkFade = DeviceMappings.additions(vendor: 13357, product: 58321, gmmkEnabled: true, fadeEnabled: true)
        check(gmmkNative.contains([src: DeviceMappings.voiceCommand, dst: DeviceMappings.previousTrack]),
              "GMMK3 Fn+F5 sends native previous track")
        check(gmmkNative.contains([src: DeviceMappings.doNotDisturb, dst: DeviceMappings.nextTrack]),
              "GMMK3 Fn+F6 remains Next when Spotify is disconnected or fade disabled")
        check(gmmkFade.contains([src: DeviceMappings.doNotDisturb, dst: DeviceMappings.fadeKey]),
              "GMMK3 Fn+F6 uses the existing fade hotkey when Spotify is connected")
        check(!gmmkFade.contains { [UInt64(0x70000003E), UInt64(0x70000003F)].contains($0[src] ?? 0) },
              "plain F5 and F6 retain their normal keyboard behavior")
        check(DeviceMappings.additions(vendor: 13357, product: 58321, gmmkEnabled: false, fadeEnabled: true).isEmpty,
              "GMMK3 changes require explicit opt-in")
        check(DeviceMappings.additions(vendor: 1, product: 2, gmmkEnabled: true, fadeEnabled: true).isEmpty,
              "unrelated keyboards are not remapped")
        check(DeviceMappings.additions(vendor: 2070, product: 9332, gmmkEnabled: true, fadeEnabled: true) ==
              [[src: DeviceMappings.nextTrack, dst: DeviceMappings.fadeKey]], "SDCX knob mapping is retained")
        check(DeviceMappings.additions(vendor: 2070, product: 9332, gmmkEnabled: true, fadeEnabled: false).isEmpty,
              "SDCX keeps native behavior without Spotify")
        print("\(passed) native regression checks passed")
    }
}
