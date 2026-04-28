using System.Text.Json;

namespace MessageRelay.Wire;

/// <summary>
/// Read-only access to the relay channel discovery directory
/// (<c>~/.claude/relay-channel/</c>). Port files follow the naming convention
/// <c>&lt;agentName&gt;.port</c> and contain a JSON object with at minimum
/// <c>{ "port": number }</c> and optionally <c>{ "cwd": string }</c>.
/// Mirrors <c>relay-utils.ts</c>: <c>DISCOVERY_DIR</c>, <c>listChannels</c>,
/// <c>buildProjectToAgentMap</c>.
/// </summary>
internal static class DiscoveryDirectory
{
    internal static readonly string DefaultPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".claude",
        "relay-channel");

    /// <summary>
    /// Resolves the discovery directory: <c>RELAY_DISCOVERY_DIR</c> env override
    /// → <c>~/.claude/relay-channel/</c> default.
    /// </summary>
    public static string Resolve(IConfiguration? configuration = null)
    {
        string? env = configuration?["RELAY_DISCOVERY_DIR"];
        return !string.IsNullOrEmpty(env) ? env : DefaultPath;
    }

    /// <summary>
    /// Lists all valid agent names that have a <c>.port</c> file in
    /// <paramref name="dir"/>. Invalid names and I/O errors are silently skipped.
    /// </summary>
    public static IReadOnlyList<string> ListAgentNames(string dir)
    {
        if (!Directory.Exists(dir))
        {
            return [];
        }

        List<string> result = [];
        try
        {
            foreach (string file in Directory.GetFiles(dir, "*.port"))
            {
                string name = Path.GetFileNameWithoutExtension(file);
                if (AgentName.IsValid(name))
                {
                    result.Add(name);
                }
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }

        return result;
    }

    /// <summary>
    /// Reads the port entry for <paramref name="agentName"/>. Returns
    /// <see langword="null"/> on missing file, I/O error, or malformed JSON.
    /// </summary>
    public static async Task<PortEntry?> ReadPortEntryAsync(
        string dir,
        string agentName,
        CancellationToken cancellationToken)
    {
        string path = Path.Combine(dir, $"{agentName}.port");
        try
        {
            string json = await File.ReadAllTextAsync(path, cancellationToken).ConfigureAwait(false);
            using JsonDocument doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("port", out JsonElement portElem) ||
                portElem.ValueKind != JsonValueKind.Number)
            {
                return null;
            }

            int port = portElem.GetInt32();
            string? cwd = doc.RootElement.TryGetProperty("cwd", out JsonElement cwdElem)
                ? cwdElem.GetString()
                : null;
            return new PortEntry(agentName, port, cwd);
        }
        catch (FileNotFoundException) { return null; }
        catch (IOException) { return null; }
        catch (JsonException) { return null; }
    }

    /// <summary>
    /// Lists all port entries from the discovery directory. Silently skips
    /// any file that cannot be parsed.
    /// </summary>
    public static async Task<IReadOnlyList<PortEntry>> ListPortEntriesAsync(
        string dir,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> names = ListAgentNames(dir);
        List<PortEntry> result = new(names.Count);
        foreach (string name in names)
        {
            PortEntry? entry = await ReadPortEntryAsync(dir, name, cancellationToken).ConfigureAwait(false);
            if (entry is not null)
            {
                result.Add(entry);
            }
        }

        return result;
    }

    internal sealed record PortEntry(string Agent, int Port, string? Cwd);
}
