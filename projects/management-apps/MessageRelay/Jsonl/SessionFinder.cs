using System.Text.Json;
using MessageRelay.Wire;

namespace MessageRelay.Jsonl;

/// <summary>
/// Locates JSONL session files for a given agent. Mirrors the session-discovery
/// logic in <c>jsonlWatcher.ts</c>: <c>buildSessionToAgentMap</c> +
/// <c>findHistoricalSessionFiles</c>.
/// <para/>
/// Claude Code stores per-session JSONL files under
/// <c>~/.claude/projects/{encoded-cwd}/{sessionId}.jsonl</c> where
/// <c>encoded-cwd</c> replaces the leading <c>/</c> with <c>-</c> and all
/// remaining <c>/</c> with <c>-</c>. Session metadata lives in
/// <c>~/.claude/sessions/{pid}.json</c>.
/// </summary>
internal static class SessionFinder
{
    private static readonly string ClaudeRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".claude");

    internal static readonly string ProjectsRoot = Path.Combine(ClaudeRoot, "projects");
    private static readonly string SessionsDir = Path.Combine(ClaudeRoot, "sessions");

    /// <summary>
    /// Finds all JSONL files for <paramref name="agentName"/>, newest first.
    /// Combines cwd-matched sessions from <c>~/.claude/sessions/</c> with a
    /// historical scan limited to <paramref name="daysBack"/> days.
    /// </summary>
    public static async Task<IReadOnlyList<SessionFile>> FindForAgentAsync(
        string agentName,
        CancellationToken cancellationToken,
        int daysBack = 30)
    {
        if (!AgentName.IsValid(agentName))
        {
            return [];
        }

        DateTimeOffset cutoff = DateTimeOffset.UtcNow.AddDays(-daysBack);
        List<SessionFile> result = [];
        HashSet<string> seen = new(StringComparer.Ordinal);

        IReadOnlyList<string> agentCwds = await GetAgentCwdsAsync(agentName, cancellationToken)
            .ConfigureAwait(false);
        CollectCwdMatches(agentCwds, cutoff, seen, result);

        IReadOnlyDictionary<string, string> sessionMap =
            await BuildSessionToAgentMapAsync(cancellationToken).ConfigureAwait(false);
        await CollectSessionMatchesAsync(agentName, sessionMap, cutoff, seen, result, cancellationToken)
            .ConfigureAwait(false);

        result.Sort(static (a, b) => b.LastWriteUtc.CompareTo(a.LastWriteUtc));
        return result;
    }

    private static void CollectCwdMatches(
        IReadOnlyList<string> cwds,
        DateTimeOffset cutoff,
        HashSet<string> seen,
        List<SessionFile> result)
    {
        foreach (string cwd in cwds)
        {
            string encoded = EncodeCwd(cwd);
            string projDir = Path.Combine(ProjectsRoot, encoded);
            if (!Directory.Exists(projDir))
            {
                continue;
            }

            AppendJsonlFiles(projDir, cutoff, seen, result);
        }
    }

    private static async Task CollectSessionMatchesAsync(
        string agentName,
        IReadOnlyDictionary<string, string> sessionMap,
        DateTimeOffset cutoff,
        HashSet<string> seen,
        List<SessionFile> result,
        CancellationToken cancellationToken)
    {
        if (!Directory.Exists(ProjectsRoot))
        {
            return;
        }

        foreach (KeyValuePair<string, string> kv in sessionMap)
        {
            if (!string.Equals(kv.Value, agentName, StringComparison.Ordinal))
            {
                continue;
            }

            cancellationToken.ThrowIfCancellationRequested();
            string jsonlName = $"{kv.Key}.jsonl";
            AppendNamedJsonlFile(jsonlName, cutoff, seen, result);
        }

        await Task.CompletedTask.ConfigureAwait(false);
    }

    private static void AppendJsonlFiles(
        string projDir,
        DateTimeOffset cutoff,
        HashSet<string> seen,
        List<SessionFile> result)
    {
        try
        {
            foreach (string jsonl in Directory.GetFiles(projDir, "*.jsonl"))
            {
                if (seen.Contains(jsonl))
                {
                    continue;
                }

                try
                {
                    FileInfo fi = new(jsonl);
                    if (fi.LastWriteTimeUtc >= cutoff.UtcDateTime)
                    {
                        result.Add(new SessionFile(jsonl, fi.LastWriteTimeUtc));
                        seen.Add(jsonl);
                    }
                }
                catch (IOException) { }
            }
        }
        catch (IOException) { }
    }

    private static void AppendNamedJsonlFile(
        string jsonlName,
        DateTimeOffset cutoff,
        HashSet<string> seen,
        List<SessionFile> result)
    {
        try
        {
            foreach (string projDir in Directory.GetDirectories(ProjectsRoot))
            {
                string candidate = Path.Combine(projDir, jsonlName);
                if (seen.Contains(candidate))
                {
                    continue;
                }

                try
                {
                    FileInfo fi = new(candidate);
                    if (fi.Exists && fi.LastWriteTimeUtc >= cutoff.UtcDateTime)
                    {
                        result.Add(new SessionFile(candidate, fi.LastWriteTimeUtc));
                        seen.Add(candidate);
                    }
                }
                catch (IOException) { }
            }
        }
        catch (IOException) { }
    }

    /// <summary>
    /// Reads <c>~/.claude/sessions/*.json</c> and returns a map of
    /// sessionId → agentName.
    /// </summary>
    public static async Task<IReadOnlyDictionary<string, string>> BuildSessionToAgentMapAsync(
        CancellationToken cancellationToken)
    {
        Dictionary<string, string> map = new(StringComparer.Ordinal);
        if (!Directory.Exists(SessionsDir))
        {
            return map;
        }

        string[] files;
        try
        {
            files = Directory.GetFiles(SessionsDir, "*.json");
        }
        catch (IOException)
        {
            return map;
        }

        foreach (string file in files)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await TryAddSessionEntryAsync(file, map, cancellationToken).ConfigureAwait(false);
        }

        return map;
    }

    private static async Task TryAddSessionEntryAsync(
        string file,
        Dictionary<string, string> map,
        CancellationToken cancellationToken)
    {
        try
        {
            string json = await File.ReadAllTextAsync(file, cancellationToken).ConfigureAwait(false);
            using JsonDocument doc = JsonDocument.Parse(json);
            JsonElement root = doc.RootElement;

            if (!root.TryGetProperty("sessionId", out JsonElement sidElem) ||
                sidElem.ValueKind != JsonValueKind.String)
            {
                return;
            }

            if (!root.TryGetProperty("name", out JsonElement nameElem) ||
                nameElem.ValueKind != JsonValueKind.String)
            {
                return;
            }

            string? sessionId = sidElem.GetString();
            string? name = nameElem.GetString();
            if (!string.IsNullOrEmpty(sessionId) && AgentName.IsValid(name))
            {
                map[sessionId] = name ?? string.Empty;
            }
        }
        catch (IOException) { }
        catch (JsonException) { }
    }

    /// <summary>
    /// Encodes a cwd path to the directory name format Claude Code uses:
    /// leading <c>/</c> → <c>-</c>, remaining <c>/</c> → <c>-</c>.
    /// </summary>
    public static string EncodeCwd(string cwd)
    {
        return cwd.StartsWith('/')
            ? "-" + cwd[1..].Replace('/', '-')
            : cwd.Replace('/', '-');
    }

    private static async Task<IReadOnlyList<string>> GetAgentCwdsAsync(
        string agentName,
        CancellationToken cancellationToken)
    {
        if (!Directory.Exists(SessionsDir))
        {
            return [];
        }

        string[] files;
        try
        {
            files = Directory.GetFiles(SessionsDir, "*.json");
        }
        catch (IOException)
        {
            return [];
        }

        HashSet<string> cwds = new(StringComparer.Ordinal);
        foreach (string file in files)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await TryAddCwdAsync(file, agentName, cwds, cancellationToken).ConfigureAwait(false);
        }

        return [.. cwds];
    }

    private static async Task TryAddCwdAsync(
        string file,
        string agentName,
        HashSet<string> cwds,
        CancellationToken cancellationToken)
    {
        try
        {
            string json = await File.ReadAllTextAsync(file, cancellationToken).ConfigureAwait(false);
            using JsonDocument doc = JsonDocument.Parse(json);
            JsonElement root = doc.RootElement;

            if (!root.TryGetProperty("name", out JsonElement nameElem) ||
                !string.Equals(nameElem.GetString(), agentName, StringComparison.Ordinal))
            {
                return;
            }

            if (root.TryGetProperty("cwd", out JsonElement cwdElem) &&
                cwdElem.ValueKind == JsonValueKind.String)
            {
                string? cwd = cwdElem.GetString();
                if (!string.IsNullOrEmpty(cwd))
                {
                    cwds.Add(cwd);
                }
            }
        }
        catch (IOException) { }
        catch (JsonException) { }
    }

    internal sealed record SessionFile(string Path, DateTime LastWriteUtc);
}
