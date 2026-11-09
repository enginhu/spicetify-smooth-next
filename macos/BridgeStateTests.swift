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
        print("\(passed) native regression checks passed")
    }
}
