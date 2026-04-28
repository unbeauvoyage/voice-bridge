using System.Diagnostics.CodeAnalysis;

namespace VoiceBridge.Features.Compose;

/// <summary>
/// Result row for a single uploaded attachment. Contract mirrors
/// content-service-ts /upload response: url, mime, bytes, sha256.
/// </summary>
[SuppressMessage("Design", "CA1054:URI parameters should not be strings", Justification = "Url is a wire-level JSON field; string is the serialized representation.")]
[SuppressMessage("Design", "CA1056:URI properties should not be strings", Justification = "Url is a wire-level JSON field; string is the serialized representation.")]
internal sealed record ComposeAttachment(string Url, string Mime, long Bytes, string Sha256);
