// JXA floating recording indicator — launched by wake_word.py, killed to dismiss.
// Run via: osascript -l JavaScript /path/to/overlay.js
ObjC.import('AppKit');
ObjC.import('QuartzCore');

var app = $.NSApplication.sharedApplication;
// Accessory policy: no dock icon, no menu bar takeover
app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);

// --- Window ---
var win = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer(
  $.NSMakeRect(0, 0, 152, 32),
  $.NSWindowStyleMaskBorderless,
  $.NSBackingStoreBuffered,
  false
);
win.setLevel($.NSStatusWindowLevel);
win.setAlphaValue(0.90);
win.setOpaque(false);
win.setHasShadow(true);
win.setIgnoresMouseEvents(true);
// Show on all spaces / full-screen
win.setCollectionBehavior(
  $.NSWindowCollectionBehaviorCanJoinAllSpaces |
  $.NSWindowCollectionBehaviorStationary
);

// --- Background: dark rounded rect ---
var bgView = $.NSView.alloc.initWithFrame($.NSMakeRect(0, 0, 152, 32));
bgView.setWantsLayer(true);
bgView.layer.setBackgroundColor($.NSColor.colorWithRedGreenBlueAlpha(0.08, 0.08, 0.08, 0.92).CGColor);
bgView.layer.setCornerRadius(16.0);
bgView.layer.setMasksToBounds(true);
win.setContentView(bgView);

// --- Label ---
var label = $.NSTextField.alloc.initWithFrame($.NSMakeRect(0, 0, 152, 32));
label.setStringValue('  \u25CF  Recording\u2026');
label.setTextColor($.NSColor.colorWithRedGreenBlueAlpha(1.0, 0.27, 0.23, 1.0));
label.setBackgroundColor($.NSColor.clearColor);
label.setBordered(false);
label.setEditable(false);
label.setSelectable(false);
label.setAlignment($.NSTextAlignmentCenter);
label.setFont($.NSFont.boldSystemFontOfSize(13));
bgView.addSubview(label);

// --- Position: top-right, just below menu bar ---
var screen = $.NSScreen.mainScreen;
var sf = screen.frame;
var margin = 18;
var menuBarH = 30;
var wx = sf.size.width - 152 - margin;
var wy = sf.size.height - 32 - menuBarH - margin;
win.setFrameOrigin($.NSMakePoint(wx, wy));
app.activateIgnoringOtherApps(false);
win.makeKeyAndOrderFront(null);

// --- Pulse animation via NSTimer ---
var phase = [0];
var pulseColors = [
  $.NSColor.colorWithRedGreenBlueAlpha(1.0, 0.27, 0.23, 1.0),
  $.NSColor.colorWithRedGreenBlueAlpha(1.0, 0.60, 0.50, 1.0)
];
var delegate = $.NSObject.alloc.init;
// Schedule a repeating timer before entering run loop
$.NSTimer.scheduledTimerWithTimeIntervalRepeatsBlock(0.6, true, function() {
  phase[0] ^= 1;
  label.setTextColor(pulseColors[phase[0]]);
});

app.run;
