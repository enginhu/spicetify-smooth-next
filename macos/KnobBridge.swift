import Cocoa
import Carbon
import Network
import IOKit.hidsystem

// No event tap, keystroke recorder, Apple Events, or USB firmware writes.
// A per-device HID map redirects only Consumer Scan Next Track to F20.
// Carbon consumes that reserved hotkey, and Spotify performs the fade itself.
final class KnobBridge {
    let hid = IOHIDEventSystemClientCreateSimpleClient(kCFAllocatorDefault)
    let mappingKey = "UserKeyMapping" as CFString
    let sourceKey = "HIDKeyboardModifierMappingSrc"
    let destinationKey = "HIDKeyboardModifierMappingDst"
    let source: UInt64 = 0xC000000B5
    let destination: UInt64 = 0x70000006F // F20
    var listener: NWListener?
    var connection: NWConnection?
    var hotkey: EventHotKeyRef?
    var handler: EventHandlerRef?
    var timer: Timer?
    var signals: [DispatchSourceSignal] = []
    var lastHeartbeat = Date.distantPast
    var clientEnabled = false
    var records: [String: [String: Any]] = [:]
    var pending: String?
    var pendingSince = Date.distantPast
    let journal: URL

    init() {
        let folder = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Smooth Next")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        journal = folder.appendingPathComponent("keymap-backup.plist")
        if let data = try? Data(contentsOf: journal),
           let saved = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: [String: Any]] {
            records = saved
        }
    }

    func log(_ message: String) { print("[Smooth Next Knob] \(message)"); fflush(stdout) }

    func services() -> [IOHIDServiceClient] {
        let all = IOHIDEventSystemClientCopyServices(hid) as? [IOHIDServiceClient] ?? []
        return all.filter {
            (IOHIDServiceClientCopyProperty($0, "VendorID" as CFString) as? NSNumber)?.intValue == 2070 &&
            (IOHIDServiceClientCopyProperty($0, "ProductID" as CFString) as? NSNumber)?.intValue == 9332
        }
    }

    func registryID(_ service: IOHIDServiceClient) -> String {
        String(describing: IOHIDServiceClientGetRegistryID(service))
    }

    func mapping(_ service: IOHIDServiceClient) -> [[String: UInt64]] {
        IOHIDServiceClientCopyProperty(service, mappingKey) as? [[String: UInt64]] ?? []
    }

    @discardableResult func persist() -> Bool {
        do {
            let data = try PropertyListSerialization.data(fromPropertyList: records, format: .xml, options: 0)
            try data.write(to: journal, options: .atomic)
            return true
        } catch { log("Cannot save keymap backup: \(error)"); return false }
    }

    func restore() {
        if records.isEmpty && hotkey == nil { return }
        for service in services() {
            let id = registryID(service)
            guard let record = records[id],
                  let installed = record["installed"] as? [[String: UInt64]],
                  let original = record["original"] as? [[String: UInt64]] else { continue }
            // Preserve changes made later by the user or another remapper.
            if mapping(service) == installed {
                guard IOHIDServiceClientSetProperty(service, mappingKey, original as CFArray),
                      mapping(service) == original else {
                    log("Keymap restoration failed for \(id)"); continue
                }
                log("Native Next restored for \(id)")
            }
            records.removeValue(forKey: id)
        }
        persist()
        if let key = hotkey { UnregisterEventHotKey(key); hotkey = nil }
    }

    func activate() {
        if hotkey == nil {
            let status = RegisterEventHotKey(UInt32(kVK_F20), 0,
                EventHotKeyID(signature: 0x534E4B42, id: 1), GetApplicationEventTarget(),
                OptionBits(kEventHotKeyExclusive), &hotkey)
            guard status == noErr else { log("F20 is unavailable (\(status)); native mapping retained"); return }
        }
        for service in services() {
            let id = registryID(service)
            if records[id] != nil { continue }
            let original = mapping(service)
            // Never override another remapper's assignment of Next or F20.
            if original.contains(where: { $0[sourceKey] == source || $0[sourceKey] == destination || $0[destinationKey] == destination }) {
                log("Conflicting device mapping; left unchanged"); continue
            }
            let installed = original + [[sourceKey: source, destinationKey: destination]]
            records[id] = ["original": original, "installed": installed]
            guard persist() else { records.removeValue(forKey: id); continue }
            if IOHIDServiceClientSetProperty(service, mappingKey, installed as CFArray), mapping(service) == installed {
                log("SDCX Next → fade enabled for \(id)")
            } else {
                log("Cannot apply the device mapping")
                records.removeValue(forKey: id); persist()
            }
        }
    }

    func next() {
        guard clientEnabled, Date().timeIntervalSince(lastHeartbeat) < 3, let client = connection else { return }
        // A lost acknowledgement must not queue up late skips.
        if pending != nil && Date().timeIntervalSince(pendingSince) < 3 { return }
        let id = UUID().uuidString
        pending = id; pendingSince = Date()
        send(["type": "next", "id": id], to: client)
        log("Knob Next delivered to Spotify")
    }

    func send(_ object: [String: Any], to client: NWConnection) {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return }
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "smooth-next", metadata: [metadata])
        client.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { [weak self] error in
            if error != nil { self?.disconnect(client) }
        })
    }

    func disconnect(_ client: NWConnection) {
        guard connection === client else { client.cancel(); return }
        connection = nil; clientEnabled = false; pending = nil
        restore(); client.cancel()
        log("Spotify disconnected; native knob behavior restored")
    }

    func receive(_ client: NWConnection) {
        client.receiveMessage { [weak self] data, context, _, error in
            guard let self, self.connection === client else { return }
            let metadata = context?.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata
            if error != nil || metadata?.opcode == .close { self.disconnect(client); return }
            if metadata?.opcode == .text, let data,
               let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if message["type"] as? String == "status", let enabled = message["enabled"] as? Bool {
                    self.lastHeartbeat = Date(); self.clientEnabled = enabled
                    if enabled { self.activate() } else { self.restore() }
                } else if message["type"] as? String == "ack", message["id"] as? String == self.pending {
                    self.pending = nil
                }
            }
            self.receive(client)
        }
    }

    func start() throws {
        // Recover mappings left behind by a previous abnormal termination.
        restore()
        var event = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let status = InstallEventHandler(GetApplicationEventTarget(), { _, _, context in
            guard let context else { return OSStatus(eventNotHandledErr) }
            Unmanaged<KnobBridge>.fromOpaque(context).takeUnretainedValue().next()
            return noErr
        }, 1, &event, Unmanaged.passUnretained(self).toOpaque(), &handler)
        guard status == noErr else { throw NSError(domain: "Hotkey", code: Int(status)) }

        let ws = NWProtocolWebSocket.Options()
        ws.autoReplyPing = true; ws.maximumMessageSize = 2048
        ws.setClientRequestHandler(.main) { protocols, headers in
            let origin = headers.first { $0.name.lowercased() == "origin" }?.value
            let allowed = origin == "https://xpui.app.spotify.com" && protocols.contains("smooth-next-v1")
            return .init(status: allowed ? .accept : .reject, subprotocol: allowed ? "smooth-next-v1" : nil)
        }
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 17643)
        parameters.defaultProtocolStack.applicationProtocols.insert(ws, at: 0)
        let server = try NWListener(using: parameters)
        listener = server
        server.stateUpdateHandler = { [weak self] state in
            if case .failed(let error) = state { self?.log("Listener failed: \(error)"); self?.stop(); exit(1) }
            if case .ready = state { self?.log("Ready on loopback 127.0.0.1:17643") }
        }
        server.newConnectionHandler = { [weak self] client in
            guard let self else { return }
            // Validate handshake before replacing the currently live client.
            client.stateUpdateHandler = { [weak self] state in
                guard let self else { return }
                switch state {
                case .ready:
                    if let previous = self.connection { self.disconnect(previous) }
                    self.connection = client; self.lastHeartbeat = Date()
                    self.receive(client); self.log("Spotify bridge connected")
                case .failed, .cancelled:
                    if self.connection === client { self.disconnect(client) }
                default: break
                }
            }
            client.start(queue: .main)
        }
        server.start(queue: .main)
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            if Date().timeIntervalSince(self.lastHeartbeat) >= 3 {
                if let client = self.connection { self.disconnect(client) }
            } else if self.clientEnabled { self.activate() }
        }
        for number in [SIGINT, SIGTERM] {
            signal(number, SIG_IGN)
            let signalSource = DispatchSource.makeSignalSource(signal: number, queue: .main)
            signalSource.setEventHandler { [weak self] in self?.stop(); exit(0) }
            signalSource.resume(); signals.append(signalSource)
        }
    }

    func stop() {
        timer?.invalidate(); clientEnabled = false; restore()
        connection?.cancel(); listener?.cancel()
        if let handler { RemoveEventHandler(handler) }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let bridge = KnobBridge()
do { try bridge.start(); app.run() }
catch { bridge.log("Startup failed: \(error)"); bridge.stop(); exit(1) }
