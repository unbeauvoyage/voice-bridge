import Cocoa

struct ToastEntry {
    let from: String
    let body: String
    let ts: Double
}

class ToastOverlayDelegate: NSObject, NSApplicationDelegate {
    var panel: NSPanel!
    var stackView: NSStackView!
    var timer: Timer?
    var shownIds = Set<String>()  // track by "from:ts" to avoid re-adding

    func applicationDidFinishLaunching(_ n: Notification) {
        let sf = NSScreen.main?.frame ?? NSRect(x:0,y:0,width:1440,height:900)
        let W: CGFloat = 480
        // Position: right side, near top
        let panelRect = NSRect(x: sf.origin.x + sf.size.width - W - 18,
                               y: sf.origin.y + 60,  // bottom anchor, grows up
                               width: W, height: 10)  // height grows dynamically

        panel = NSPanel(contentRect: panelRect,
                        styleMask: [.nonactivatingPanel, .borderless],
                        backing: .buffered, defer: false)
        panel.level = .floating
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.ignoresMouseEvents = true
        panel.isMovable = false

        stackView = NSStackView()
        stackView.orientation = .vertical
        stackView.alignment = .trailing
        stackView.spacing = 8
        stackView.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stackView)
        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            stackView.topAnchor.constraint(equalTo: container.topAnchor),
        ])
        panel.contentView = container

        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        panel.orderFront(nil)
    }

    func refresh() {
        let now = Date().timeIntervalSince1970
        var entries: [ToastEntry] = []

        var toastDuration: Double = 15.0
        if let data = try? Data(contentsOf: URL(fileURLWithPath: "/Users/riseof/environment/projects/voice-bridge/daemon/settings.json")),
           let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let d = obj["toast_duration"] as? Double {
            toastDuration = d
        }

        if let content = try? String(contentsOfFile: "/tmp/vb-toast-queue.jsonl", encoding: .utf8) {
            for line in content.components(separatedBy: "\n") {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else { continue }
                guard let data = trimmed.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let from = obj["from"] as? String,
                      let body = obj["body"] as? String,
                      let ts = obj["ts"] as? Double else { continue }
                let age = now - ts
                if age < toastDuration {
                    entries.append(ToastEntry(from: from, body: body, ts: ts))
                }
            }
        }

        // Remove old subviews
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }

        if entries.isEmpty {
            panel.orderOut(nil)
            return
        }

        // Build cards newest-first (highest ts at top)
        let sorted = entries.sorted { $0.ts > $1.ts }
        for entry in sorted {
            let card = makeCard(from: entry.from, body: entry.body)
            stackView.addArrangedSubview(card)
        }

        // Resize panel to fit stack
        panel.contentView?.layoutSubtreeIfNeeded()
        let totalH = stackView.fittingSize.height + 16
        let sf = NSScreen.main?.frame ?? NSRect(x:0,y:0,width:1440,height:900)
        let newFrame = NSRect(
            x: sf.origin.x + sf.size.width - 480 - 18,
            y: sf.origin.y + 80,
            width: 480, height: totalH
        )
        panel.setFrame(newFrame, display: true, animate: false)
        panel.orderFront(nil)
    }

    func makeCard(from: String, body: String) -> NSView {
        let card = NSView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.wantsLayer = true
        card.layer?.backgroundColor = NSColor(red: 0.05, green: 0.08, blue: 0.15, alpha: 0.88).cgColor
        card.layer?.cornerRadius = 12

        let label = NSTextField(wrappingLabelWithString: "")
        label.isEditable = false
        label.isBordered = false
        label.backgroundColor = .clear
        label.translatesAutoresizingMaskIntoConstraints = false

        // Colored agent name + body
        let fullText = NSMutableAttributedString()
        let nameAttrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor(red: 0.4, green: 0.7, blue: 1.0, alpha: 1.0),
            .font: NSFont.systemFont(ofSize: 15, weight: .semibold)
        ]
        let bodyAttrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor(red: 0.88, green: 0.92, blue: 1.0, alpha: 1.0),
            .font: NSFont.systemFont(ofSize: 15, weight: .regular)
        ]
        fullText.append(NSAttributedString(string: from + ": ", attributes: nameAttrs))
        fullText.append(NSAttributedString(string: body, attributes: bodyAttrs))
        label.attributedStringValue = fullText

        card.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 14),
            label.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
            label.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
            label.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -10),
            card.widthAnchor.constraint(equalToConstant: 480),
        ])
        return card
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = ToastOverlayDelegate()
app.delegate = delegate
app.run()
