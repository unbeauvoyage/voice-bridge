import Cocoa

// Read initial state from --state arg, default to "listening"
var initialState = "listening"
if let idx = CommandLine.arguments.firstIndex(of: "--state"), idx + 1 < CommandLine.arguments.count {
    initialState = CommandLine.arguments[idx + 1]
}

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var statusItem: NSStatusItem!
    var timer: Timer?
    var settingsPanel: NSPanel?

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        updateIcon(state: initialState)
        // Write initial state to file
        try? initialState.write(toFile: "/tmp/vb-mic-state", atomically: true, encoding: .utf8)

        // Poll state file every 0.5s
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            let state = (try? String(contentsOfFile: "/tmp/vb-mic-state", encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "listening"
            self?.updateIcon(state: state)
        }

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Settings…", action: #selector(openSettings), keyEquivalent: ","))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(quitApp), keyEquivalent: "q"))
        statusItem.menu = menu
    }

    func updateIcon(state: String) {
        let btn = statusItem.button
        if state == "recording" {
            btn?.image = NSImage(systemSymbolName: "mic.fill", accessibilityDescription: "Recording")
            btn?.contentTintColor = .systemRed
        } else {
            btn?.image = NSImage(systemSymbolName: "mic.fill", accessibilityDescription: "Listening")
            btn?.contentTintColor = .systemYellow
        }
    }

    @objc func quitApp() {
        // Kill all voice-bridge processes
        let task = Process()
        task.launchPath = "/bin/sh"
        task.arguments = ["-c", "pkill -f 'wake_word.py'; pkill -f 'toast_overlay'"]
        try? task.run()
        task.waitUntilExit()
        NSApp.terminate(nil)
    }

    @objc func openSettings() {
        if settingsPanel != nil {
            settingsPanel?.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        // Load current settings
        var settings: [String: Any] = [
            "toast_duration": 15.0,
            "tts_enabled": true,
            "tts_word_limit": 8,
            "stop_threshold": 0.15,
            "start_threshold": 0.3
        ]
        let settingsPath = "/Users/riseof/environment/projects/voice-bridge/daemon/settings.json"
        if let data = try? Data(contentsOf: URL(fileURLWithPath: settingsPath)),
           let loaded = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            settings = loaded
        }

        let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 340, height: 280),
                            styleMask: [.titled, .closable, .nonactivatingPanel],
                            backing: .buffered, defer: false)
        panel.title = "Voice Bridge Settings"
        panel.level = .floating
        panel.center()

        let content = NSView(frame: NSRect(x: 0, y: 0, width: 340, height: 280))

        func addRow(label: String, key: String, y: CGFloat, isFloat: Bool = true) -> NSTextField {
            let lbl = NSTextField(labelWithString: label + ":")
            lbl.frame = NSRect(x: 20, y: y, width: 160, height: 22)
            lbl.alignment = .right
            content.addSubview(lbl)

            let field = NSTextField(frame: NSRect(x: 190, y: y, width: 120, height: 22))
            field.stringValue = isFloat
                ? String(format: "%.2f", (settings[key] as? Double) ?? 0)
                : "\(settings[key] ?? "")"
            field.identifier = NSUserInterfaceItemIdentifier(key)
            content.addSubview(field)
            return field
        }

        _ = addRow(label: "Toast duration (sec)", key: "toast_duration", y: 210)
        _ = addRow(label: "TTS word limit", key: "tts_word_limit", y: 170, isFloat: false)
        _ = addRow(label: "Stop threshold", key: "stop_threshold", y: 130)
        _ = addRow(label: "Start threshold", key: "start_threshold", y: 90)

        // TTS enabled toggle
        let ttsLbl = NSTextField(labelWithString: "TTS enabled:")
        ttsLbl.frame = NSRect(x: 20, y: 50, width: 160, height: 22)
        ttsLbl.alignment = .right
        content.addSubview(ttsLbl)
        let ttsCheck = NSButton(checkboxWithTitle: "", target: nil, action: nil)
        ttsCheck.frame = NSRect(x: 190, y: 50, width: 30, height: 22)
        ttsCheck.state = (settings["tts_enabled"] as? Bool ?? true) ? .on : .off
        ttsCheck.identifier = NSUserInterfaceItemIdentifier("tts_enabled")
        content.addSubview(ttsCheck)

        // Save button
        let saveBtn = NSButton(title: "Save", target: self, action: #selector(saveSettings(_:)))
        saveBtn.frame = NSRect(x: 230, y: 10, width: 90, height: 28)
        saveBtn.keyEquivalent = "\r"
        content.addSubview(saveBtn)

        panel.contentView = content
        panel.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        settingsPanel = panel
        panel.delegate = self
    }

    @objc func saveSettings(_ sender: NSButton) {
        guard let content = sender.superview else { return }
        let settingsPath = "/Users/riseof/environment/projects/voice-bridge/daemon/settings.json"

        var newSettings: [String: Any] = [:]
        for sub in content.subviews {
            guard let key = sub.identifier?.rawValue, !key.isEmpty else { continue }
            if let field = sub as? NSTextField, field.isEditable {
                if key == "tts_word_limit" {
                    newSettings[key] = Int(field.stringValue) ?? 8
                } else {
                    newSettings[key] = Double(field.stringValue) ?? 0
                }
            } else if let check = sub as? NSButton, check.identifier?.rawValue == key {
                newSettings[key] = check.state == .on
            }
        }

        if let data = try? JSONSerialization.data(withJSONObject: newSettings, options: .prettyPrinted) {
            try? data.write(to: URL(fileURLWithPath: settingsPath))
        }
        settingsPanel?.close()
        settingsPanel = nil
    }

    func windowWillClose(_ notification: Notification) {
        if (notification.object as? NSPanel) === settingsPanel {
            settingsPanel = nil
        }
    }
}

let delegate = AppDelegate()
let app = NSApplication.shared
app.delegate = delegate
app.setActivationPolicy(.accessory)  // Don't show in Dock
app.run()
