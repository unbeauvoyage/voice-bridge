using System.Text.Json;
using System.Text.RegularExpressions;

namespace MessageRelay.Jsonl;

/// <summary>
/// Extracts relay-level messages from a Claude Code JSONL session file.
/// Mirrors <c>extractMessagesFromSession</c> in <c>routes/messages.ts</c>.
/// <para/>
/// Extracts two categories:
/// <list type="bullet">
/// <item>Incoming: user turns with <c>&lt;channel from="X"...&gt;BODY&lt;/channel&gt;</c> tags.</item>
/// <item>Outgoing: assistant turns with <c>relay_reply</c> tool_use calls.</item>
/// <item>CEO CLI: direct user turns (plain text, no channel tag).</item>
/// </list>
/// </summary>
internal static partial class MessageExtractor
{
    private static readonly string[] SystemContentPrefixes =
    [
        "This session is being continued from a previous conversation",
        "[Image: source:",
        "[Request interrupted",
    ];

    [GeneratedRegex(
        @"<channel\b[^>]*\bfrom=""(?<from>[^""]+)""[^>]*\btype=""(?<type>[^""]+)""[^>]*\bmessage_id=""(?<mid>[^""]+)""[^>]*>(?<body>[\s\S]*?)<\/channel>",
        RegexOptions.ExplicitCapture,
        matchTimeoutMilliseconds: 2000)]
    private static partial Regex ChannelTagRegex();

    /// <summary>
    /// Reads and parses <paramref name="filePath"/>, returning extracted
    /// relay messages for <paramref name="agentName"/>.
    /// </summary>
    public static async Task<IReadOnlyList<ExtractedMessage>> ExtractAsync(
        string filePath,
        string agentName,
        IReadOnlySet<string> knownAgents,
        CancellationToken cancellationToken)
    {
        string raw;
        try
        {
            raw = await File.ReadAllTextAsync(filePath, cancellationToken).ConfigureAwait(false);
        }
        catch (IOException)
        {
            return [];
        }

        List<ExtractedMessage> msgs = [];
        foreach (string line in raw.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            string trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed))
            {
                continue;
            }

            try
            {
                using JsonDocument doc = JsonDocument.Parse(trimmed);
                ProcessRecord(doc.RootElement, agentName, knownAgents, msgs);
            }
            catch (JsonException) { }
        }

        return msgs;
    }

    private static void ProcessRecord(
        JsonElement root,
        string agentName,
        IReadOnlySet<string> knownAgents,
        List<ExtractedMessage> msgs)
    {
        if (!root.TryGetProperty("type", out JsonElement typeElem))
        {
            return;
        }

        string? ts = root.TryGetProperty("timestamp", out JsonElement tsElem)
            ? tsElem.GetString()
            : null;
        if (string.IsNullOrEmpty(ts))
        {
            return;
        }

        string? recordId = root.TryGetProperty("uuid", out JsonElement uuidElem)
            ? uuidElem.GetString()
            : null;

        string recType = typeElem.GetString() ?? string.Empty;

        if (string.Equals(recType, "user", StringComparison.Ordinal))
        {
            ProcessUserRecord(root, agentName, knownAgents, msgs, ts, recordId ?? Guid.NewGuid().ToString());
        }
        else if (string.Equals(recType, "assistant", StringComparison.Ordinal))
        {
            ProcessAssistantRecord(root, agentName, msgs, ts);
        }
    }

    private static void ProcessUserRecord(
        JsonElement root,
        string agentName,
        IReadOnlySet<string> knownAgents,
        List<ExtractedMessage> msgs,
        string ts,
        string recordId)
    {
        if (!root.TryGetProperty("message", out JsonElement msgElem) ||
            !msgElem.TryGetProperty("content", out JsonElement contentElem) ||
            contentElem.ValueKind != JsonValueKind.String)
        {
            return;
        }

        string rawText = contentElem.GetString() ?? string.Empty;

        foreach (string prefix in SystemContentPrefixes)
        {
            if (rawText.StartsWith(prefix, StringComparison.Ordinal))
            {
                return;
            }
        }

        if (rawText.Contains("<channel", StringComparison.Ordinal))
        {
            ExtractChannelMessages(rawText, agentName, knownAgents, msgs, ts);
        }
        else if (rawText.Trim().Length >= 3)
        {
            string id = $"ui-{recordId}";
            msgs.Add(new ExtractedMessage(
                Id: id[..Math.Min(64, id.Length)],
                From: "ceo",
                To: agentName,
                Type: "message",
                Body: rawText.Trim(),
                Ts: ts,
                Delivered: true));
        }
    }

    private static void ExtractChannelMessages(
        string rawText,
        string agentName,
        IReadOnlySet<string> knownAgents,
        List<ExtractedMessage> msgs,
        string ts)
    {
        foreach (Match m in ChannelTagRegex().Matches(rawText))
        {
            string from = m.Groups["from"].Value;
            string msgType = m.Groups["type"].Value;
            string messageId = m.Groups["mid"].Value;
            string body = m.Groups["body"].Value.Trim();

            if (string.IsNullOrEmpty(from) ||
                string.Equals(from, agentName, StringComparison.Ordinal) ||
                !knownAgents.Contains(from))
            {
                continue;
            }

            string id = $"ch-{messageId}";
            msgs.Add(new ExtractedMessage(
                Id: id[..Math.Min(64, id.Length)],
                From: from,
                To: agentName,
                Type: msgType,
                Body: body,
                Ts: ts,
                Delivered: true));
        }
    }

    private static void ProcessAssistantRecord(
        JsonElement root,
        string agentName,
        List<ExtractedMessage> msgs,
        string ts)
    {
        if (!root.TryGetProperty("message", out JsonElement msgElem) ||
            !msgElem.TryGetProperty("content", out JsonElement contentElem) ||
            contentElem.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (JsonElement item in contentElem.EnumerateArray())
        {
            if (!item.TryGetProperty("type", out JsonElement itemTypeElem) ||
                !string.Equals(itemTypeElem.GetString(), "tool_use", StringComparison.Ordinal))
            {
                continue;
            }

            string toolName = item.TryGetProperty("name", out JsonElement nameElem)
                ? nameElem.GetString() ?? string.Empty
                : string.Empty;

            bool isRelay = string.Equals(toolName, "relay_reply", StringComparison.Ordinal) ||
                           toolName.EndsWith("__relay_reply", StringComparison.Ordinal) ||
                           string.Equals(toolName, "mcp__plugin_relay_channel__send", StringComparison.Ordinal);
            if (!isRelay || !item.TryGetProperty("input", out JsonElement inputElem))
            {
                continue;
            }

            string? to = inputElem.TryGetProperty("to", out JsonElement toElem) ? toElem.GetString() : null;
            string? body = inputElem.TryGetProperty("message", out JsonElement bodyElem) ? bodyElem.GetString() : null;
            string msgType = inputElem.TryGetProperty("type", out JsonElement typeElem) ? typeElem.GetString() ?? "message" : "message";

            if (string.IsNullOrEmpty(to) || string.IsNullOrEmpty(body))
            {
                continue;
            }

            string rawId = item.TryGetProperty("id", out JsonElement idElem)
                ? idElem.GetString() ?? Guid.NewGuid().ToString()
                : Guid.NewGuid().ToString();

            msgs.Add(new ExtractedMessage(
                Id: rawId,
                From: agentName,
                To: to,
                Type: msgType,
                Body: body,
                Ts: ts,
                Delivered: true));
        }
    }

    internal sealed record ExtractedMessage(
        string Id,
        string From,
        string To,
        string Type,
        string Body,
        string Ts,
        bool Delivered);
}
