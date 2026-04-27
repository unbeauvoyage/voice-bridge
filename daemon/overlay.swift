// voice-bridge recording overlay — linear layout with timer + target
// Compile: swiftc overlay.swift -o overlay_bin
// Run: ./overlay_bin [--target chief-of-staff]

import Cocoa

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSPanel!
    var dotLabel: NSTextField!
    var timerLabel: NSTextField!
    var targetLabel: NSTextField!
    var phase = false
    var elapsed = 0
    var target = "command"

    func applicationDidFinishLaunching(_ n: Notification) {
        // Parse --target argument
        let args = CommandLine.arguments
        if let idx = args.firstIndex(of: "--target"), idx + 1 < args.count {
            target = args[idx + 1]
        }

        // Parse --mode argument (recording | success | error)
        var mode = "recording"
        if let idx = args.firstIndex(of: "--mode"), idx + 1 < args.count {
            mode = args[idx + 1]
        }

        NSApp.setActivationPolicy(.accessory)

        let W: CGFloat = 420
        let H: CGFloat = 54

        if mode == "message" {
            // Parse --bodyfile (preferred — avoids shell quoting issues) or --body fallback
            var body = "New message"
            if let idx = args.firstIndex(of: "--bodyfile"), idx + 1 < args.count {
                let path = args[idx + 1]
                body = (try? String(contentsOfFile: path, encoding: .utf8)) ?? "New message"
                try? FileManager.default.removeItem(atPath: path)
            } else if let idx = args.firstIndex(of: "--body"), idx + 1 < args.count {
                body = args[idx + 1]
            }

            let W: CGFloat = 480
            let padding: CGFloat = 20
            let font = NSFont.systemFont(ofSize: 18, weight: .medium)
            let maxLabelWidth = W - 32
            let textRect = ("📨  \(body)" as NSString).boundingRect(
                with: CGSize(width: maxLabelWidth, height: 10000),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                attributes: [.font: font]
            )
            let H = max(52, ceil(textRect.height) + padding)

            // Downward stacking slot
            let messageStackFile = "/tmp/vb-message-stack"
            var messageSlot = 0
            if let data = FileManager.default.contents(atPath: messageStackFile),
               let str = String(data: data, encoding: .utf8),
               let count = Int(str.trimmingCharacters(in: .whitespaces)) {
                messageSlot = count
            }
            try? String(messageSlot + 1).write(toFile: messageStackFile, atomically: true, encoding: .utf8)

            window = NSPanel(
                contentRect: NSRect(x: 0, y: 0, width: W, height: H),
                styleMask: [.borderless, .nonactivatingPanel],
                backing: .buffered,
                defer: false
            )
            window.level = .statusBar
            window.isOpaque = false
            window.alphaValue = 0.0
            window.hasShadow = true
            window.ignoresMouseEvents = true
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]

            let bg = NSView(frame: NSRect(x: 0, y: 0, width: W, height: H))
            bg.wantsLayer = true
            bg.layer?.backgroundColor = NSColor(red: 0.08, green: 0.08, blue: 0.15, alpha: 0.92).cgColor
            bg.layer?.cornerRadius = 10
            bg.layer?.masksToBounds = true
            bg.layer?.borderWidth = 1.0
            bg.layer?.borderColor = NSColor(white: 0.35, alpha: 0.5).cgColor
            window.contentView = bg

            let msgLabel = NSTextField(frame: NSRect(x: 16, y: 10, width: maxLabelWidth, height: H - padding))
            msgLabel.backgroundColor = .clear
            msgLabel.isBordered = false
            msgLabel.isEditable = false
            msgLabel.isSelectable = false
            msgLabel.alignment = .left
            msgLabel.maximumNumberOfLines = 0
            msgLabel.lineBreakMode = .byWordWrapping
            msgLabel.cell?.wraps = true

            // Split "agent-name: message body" for colored attribution
            let fullText = "📨  \(body)"
            let attrStr = NSMutableAttributedString(string: fullText)
            let agentColor = NSColor(red: 0.29, green: 0.56, blue: 1.0, alpha: 1.0)
            let bodyColor = NSColor(red: 0.85, green: 0.92, blue: 1.0, alpha: 1.0)
            let font18 = NSFont.systemFont(ofSize: 18, weight: .medium)

            let nsFullText = fullText as NSString
            let fullRange = NSRange(location: 0, length: nsFullText.length)
            attrStr.addAttribute(.foregroundColor, value: bodyColor, range: fullRange)
            attrStr.addAttribute(.font, value: font18, range: fullRange)

            if let colonRange = fullText.range(of: ": ") {
                let prefixLength = NSRange(fullText.startIndex..<colonRange.upperBound, in: fullText).upperBound
                attrStr.addAttribute(.foregroundColor, value: agentColor, range: NSRange(location: 0, length: prefixLength))
            }

            msgLabel.attributedStringValue = attrStr
            bg.addSubview(msgLabel)

            // Position top-right (relay notification toasts), stacked downward
            let primaryScreen = NSScreen.screens.first(where: { $0.frame.contains(CGPoint.zero) }) ?? NSScreen.screens.first
            if let screen = primaryScreen {
                let sf = screen.frame
                let x = sf.origin.x + sf.size.width - W - 18
                let baseY = sf.origin.y + sf.size.height - H - 30
                let y = baseY - CGFloat(messageSlot) * (H + 8)
                window.setFrameOrigin(NSPoint(x: x, y: y))
            }
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: false)

            // Fade in, show 7s, fade out 1s
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.3
                window.animator().alphaValue = 1.0
            }
            Timer.scheduledTimer(withTimeInterval: 7.0, repeats: false) { [weak self] _ in
                guard let self else { return }
                NSAnimationContext.runAnimationGroup({ ctx in
                    ctx.duration = 1.0
                    self.window.animator().alphaValue = 0.0
                }, completionHandler: {
                    if let data = FileManager.default.contents(atPath: messageStackFile),
                       let str = String(data: data, encoding: .utf8),
                       let count = Int(str.trimmingCharacters(in: .whitespaces)) {
                        let newCount = max(0, count - 1)
                        try? String(newCount).write(toFile: messageStackFile, atomically: true, encoding: .utf8)
                    }
                    NSApp.terminate(nil)
                })
            }
            return
        }

        if mode == "listening" {
            let W: CGFloat = 200
            let H: CGFloat = 40

            window = NSPanel(
                contentRect: NSRect(x: 0, y: 0, width: W, height: H),
                styleMask: [.borderless, .nonactivatingPanel],
                backing: .buffered,
                defer: false
            )
            window.level = .statusBar
            window.isOpaque = false
            window.hasShadow = false
            window.ignoresMouseEvents = true
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]

            let bg = NSView(frame: NSRect(x: 0, y: 0, width: W, height: H))
            bg.wantsLayer = true
            bg.layer?.backgroundColor = NSColor(red: 0.07, green: 0.07, blue: 0.07, alpha: 0.55).cgColor
            bg.layer?.cornerRadius = 10
            bg.layer?.masksToBounds = true
            window.contentView = bg

            let labelH: CGFloat = 22
            let labelY: CGFloat = (H - labelH) / 2

            let micLabel = NSTextField(frame: NSRect(x: 12, y: labelY, width: W - 16, height: labelH))
            micLabel.stringValue = "● Listening…"
            micLabel.textColor = NSColor(red: 1.0, green: 0.85, blue: 0.0, alpha: 1.0)
            micLabel.backgroundColor = .clear
            micLabel.isBordered = false
            micLabel.isEditable = false
            micLabel.isSelectable = false
            micLabel.font = NSFont.systemFont(ofSize: 14, weight: .medium)
            micLabel.alignment = .left
            bg.addSubview(micLabel)

            let primaryScreen = NSScreen.screens.first(where: { $0.frame.contains(CGPoint.zero) }) ?? NSScreen.screens.first
            if let screen = primaryScreen {
                let sf = screen.frame
                let x = sf.origin.x + 18
                let y = sf.origin.y + sf.size.height - H - 30
                window.setFrameOrigin(NSPoint(x: x, y: y))
            }

            window.alphaValue = 1.0
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: false)
            // No timer — stays until process is killed
            return
        }

        if mode == "success" || mode == "error" || mode == "cancelled" {
            let isSuccess = mode == "success"
            let isCancelled = mode == "cancelled"
            let W: CGFloat = 360
            let H: CGFloat = 52

            // Stacking: claim a slot
            let stackFile = "/tmp/vb-toast-stack"
            var slot = 0
            if let data = FileManager.default.contents(atPath: stackFile),
               let str = String(data: data, encoding: .utf8),
               let count = Int(str.trimmingCharacters(in: .whitespaces)) {
                slot = count
            }
            try? String(slot + 1).write(toFile: stackFile, atomically: true, encoding: .utf8)

            window = NSPanel(
                contentRect: NSRect(x: 0, y: 0, width: W, height: H),
                styleMask: [.borderless, .nonactivatingPanel],
                backing: .buffered,
                defer: false
            )
            window.level = .statusBar
            window.isOpaque = false
            window.alphaValue = 0.0  // start invisible for fade-in
            window.hasShadow = true
            window.ignoresMouseEvents = true
            window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]

            // Background — dark rounded rectangle with subtle colored border
            let bg = NSView(frame: NSRect(x: 0, y: 0, width: W, height: H))
            bg.wantsLayer = true
            bg.layer?.backgroundColor = NSColor(red: 0.10, green: 0.10, blue: 0.12, alpha: 0.70).cgColor
            bg.layer?.cornerRadius = 10
            bg.layer?.masksToBounds = true
            // Colored border
            bg.layer?.borderWidth = 0.8
            if isSuccess {
                bg.layer?.borderColor = NSColor(red: 0.2, green: 0.85, blue: 0.4, alpha: 0.6).cgColor
            } else if isCancelled {
                bg.layer?.borderColor = NSColor(red: 1.0, green: 0.75, blue: 0.0, alpha: 0.6).cgColor
            } else {
                bg.layer?.borderColor = NSColor(red: 1.0, green: 0.27, blue: 0.23, alpha: 0.6).cgColor
            }
            window.contentView = bg

            let labelH: CGFloat = 24
            let labelY: CGFloat = (H - labelH) / 2

            let resultLabel = NSTextField(frame: NSRect(x: 20, y: labelY, width: W - 40, height: labelH))
            if isSuccess {
                resultLabel.stringValue = "✓  Delivered → \(target)"
                resultLabel.textColor = NSColor(red: 0.2, green: 0.85, blue: 0.4, alpha: 1.0)
            } else if isCancelled {
                resultLabel.stringValue = "⊘  Cancelled"
                resultLabel.textColor = NSColor(red: 1.0, green: 0.75, blue: 0.0, alpha: 1.0)
            } else {
                resultLabel.stringValue = "✗  Delivery failed"
                resultLabel.textColor = NSColor(red: 1.0, green: 0.27, blue: 0.23, alpha: 1.0)
            }
            resultLabel.backgroundColor = .clear
            resultLabel.isBordered = false
            resultLabel.isEditable = false
            resultLabel.isSelectable = false
            resultLabel.font = NSFont.systemFont(ofSize: 16, weight: .medium)
            resultLabel.alignment = .center
            bg.addSubview(resultLabel)

            // Position: TOP-RIGHT, same spot as recording overlay
            let primaryScreen = NSScreen.screens.first(where: { $0.frame.contains(CGPoint.zero) }) ?? NSScreen.screens.first
            if let screen = primaryScreen {
                let sf = screen.frame
                let x = sf.origin.x + 18
                let y = sf.origin.y + sf.size.height - H - 30
                window.setFrameOrigin(NSPoint(x: x, y: y))
            }

            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: false)

            // Fade in over 0.3s
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.3
                window.animator().alphaValue = 1.0
            }

            // After 2s, fade out over 1.0s, then terminate
            Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
                guard let self else { return }
                NSAnimationContext.runAnimationGroup({ ctx in
                    ctx.duration = 1.0
                    self.window.animator().alphaValue = 0.0
                }, completionHandler: {
                    // Release stack slot
                    if let data = FileManager.default.contents(atPath: stackFile),
                       let str = String(data: data, encoding: .utf8),
                       let count = Int(str.trimmingCharacters(in: .whitespaces)) {
                        let newCount = max(0, count - 1)
                        try? String(newCount).write(toFile: stackFile, atomically: true, encoding: .utf8)
                    }
                    NSApp.terminate(nil)
                })
            }
            return
        }

        window = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: W, height: H),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        window.level = .statusBar
        window.isOpaque = false
        window.hasShadow = true
        window.ignoresMouseEvents = true
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]

        // Dark rounded background
        let bg = NSView(frame: NSRect(x: 0, y: 0, width: W, height: H))
        bg.wantsLayer = true
        bg.layer?.backgroundColor = NSColor(red: 0.07, green: 0.07, blue: 0.07, alpha: 0.88).cgColor
        bg.layer?.cornerRadius = H / 2
        bg.layer?.masksToBounds = true
        window.contentView = bg

        let labelH: CGFloat = 27
        let labelY: CGFloat = (H - labelH) / 2

        // Red dot — pulsing
        dotLabel = NSTextField(frame: NSRect(x: 21, y: labelY, width: 78, height: labelH))
        dotLabel.stringValue = "⏺ REC"
        dotLabel.textColor = NSColor(red: 1.0, green: 0.27, blue: 0.23, alpha: 1.0)
        dotLabel.backgroundColor = .clear
        dotLabel.isBordered = false
        dotLabel.isEditable = false
        dotLabel.isSelectable = false
        dotLabel.font = NSFont.monospacedSystemFont(ofSize: 18, weight: .bold)
        dotLabel.alignment = .left
        bg.addSubview(dotLabel)

        // Timer — monospaced, white
        timerLabel = NSTextField(frame: NSRect(x: 117, y: labelY, width: 87, height: labelH))
        timerLabel.stringValue = "00:00"
        timerLabel.textColor = NSColor(white: 0.9, alpha: 1.0)
        timerLabel.backgroundColor = .clear
        timerLabel.isBordered = false
        timerLabel.isEditable = false
        timerLabel.isSelectable = false
        timerLabel.font = NSFont.monospacedSystemFont(ofSize: 19, weight: .regular)
        timerLabel.alignment = .center
        bg.addSubview(timerLabel)

        // Target — gray arrow + name
        let targetX: CGFloat = 216
        targetLabel = NSTextField(frame: NSRect(x: targetX, y: labelY, width: W - targetX - 18, height: labelH))
        targetLabel.stringValue = "→ \(target)"
        targetLabel.textColor = NSColor(red: 0.29, green: 0.56, blue: 1.0, alpha: 1.0)
        targetLabel.backgroundColor = .clear
        targetLabel.isBordered = false
        targetLabel.isEditable = false
        targetLabel.isSelectable = false
        targetLabel.font = NSFont.systemFont(ofSize: 18, weight: .medium)
        targetLabel.alignment = .left
        bg.addSubview(targetLabel)

        // Position top-left of primary display (consistent with other modes)
        let primaryScreen = NSScreen.screens.first(where: { $0.frame.contains(CGPoint.zero) }) ?? NSScreen.screens.first
        if let screen = primaryScreen {
            let sf = screen.frame
            let x = sf.origin.x + 18
            let y = sf.origin.y + sf.size.height - H - 30
            window.setFrameOrigin(NSPoint(x: x, y: y))
        }

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: false)

        // Pulse + timer tick
        Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.phase.toggle()
            let alpha: CGFloat = self.phase ? 1.0 : 0.35
            self.dotLabel.textColor = NSColor(red: 1.0, green: 0.27, blue: 0.23, alpha: alpha)
        }
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.elapsed += 1
            let m = self.elapsed / 60
            let s = self.elapsed % 60
            self.timerLabel.stringValue = String(format: "%02d:%02d", m, s)
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
