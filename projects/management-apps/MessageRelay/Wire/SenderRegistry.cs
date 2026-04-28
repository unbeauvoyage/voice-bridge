namespace MessageRelay.Wire;

/// <summary>
/// Determines whether a sender is permitted to POST to /send. Mirrors the
/// TypeScript <c>ALWAYS_ALLOWED_SENDERS</c> + port-file guard in
/// <c>routes/messages.ts</c>.
/// </summary>
internal static class SenderRegistry
{
    private static readonly string DefaultDiscoveryDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".claude",
        "relay-channel");

    /// <summary>
    /// Returns <see langword="true"/> when <paramref name="senderName"/> is in
    /// the always-allowed set (<c>ceo</c>) or has a registered port file at
    /// <c>&lt;discoveryDir&gt;/&lt;senderName&gt;.port</c>.
    /// </summary>
    /// <param name="senderName">The validated sender name from the request.</param>
    /// <param name="discoveryDir">
    /// Override the default discovery directory. When <see langword="null"/> or
    /// empty, falls back to <c>~/.claude/relay-channel/</c>.
    /// </param>
    public static bool IsAllowed(string senderName, string? discoveryDir = null)
    {
        if (string.Equals(senderName, "ceo", StringComparison.Ordinal))
        {
            return true;
        }

        string dir = !string.IsNullOrEmpty(discoveryDir) ? discoveryDir : DefaultDiscoveryDir;
        return new FileInfo(Path.Combine(dir, $"{senderName}.port")).Exists;
    }
}
