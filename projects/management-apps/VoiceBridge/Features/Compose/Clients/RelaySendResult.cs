namespace VoiceBridge.Features.Compose.Clients;

/// <summary>
/// Result of a relay <c>POST /send</c> — carries the assigned message id and
/// the relay's delivery status (<c>delivered</c> or <c>queued</c>).
/// </summary>
internal sealed record RelaySendResult(string Id, string Status);
