using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MessageRelay.Jsonl;

/// <summary>
/// Parses a JSONL session file into typed dashboard events. Mirrors
/// <c>processLine</c> in <c>jsonlWatcher.ts</c>, producing the same event
/// shapes broadcast over the <c>/dashboard</c> WebSocket.
/// </summary>
internal static partial class EventParser
{
    [GeneratedRegex(@"\bfrom=""(?<from>[^""]+)""", RegexOptions.ExplicitCapture, matchTimeoutMilliseconds: 500)]
    private static partial Regex FromAttrRegex();

    [GeneratedRegex(@"\btype=""(?<type>[^""]+)""", RegexOptions.ExplicitCapture, matchTimeoutMilliseconds: 500)]
    private static partial Regex TypeAttrRegex();

    [GeneratedRegex(@">(?<body>[\s\S]*?)<\/channel>", RegexOptions.ExplicitCapture, matchTimeoutMilliseconds: 500)]
    private static partial Regex ChannelBodyRegex();

    /// <summary>
    /// Reads <paramref name="filePath"/>, parses the last <paramref name="maxLines"/>
    /// lines, and calls <paramref name="emit"/> for each recognized event.
    /// </summary>
    public static async Task ParseAsync(
        string filePath,
        string sessionId,
        int maxLines,
        Action<ParsedEvent> emit,
        CancellationToken cancellationToken)
    {
        string raw;
        try
        {
            raw = await File.ReadAllTextAsync(filePath, cancellationToken).ConfigureAwait(false);
        }
        catch (IOException)
        {
            return;
        }

        string[] lines = raw.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        IEnumerable<string> recent = maxLines > 0 && lines.Length > maxLines
            ? lines[^maxLines..]
            : lines;

        foreach (string line in recent)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            try
            {
                using JsonDocument doc = JsonDocument.Parse(line.Trim());
                ProcessLine(doc.RootElement, sessionId, emit);
            }
            catch (JsonException) { }
        }
    }

    private static void ProcessLine(JsonElement root, string sessionId, Action<ParsedEvent> emit)
    {
        if (!root.TryGetProperty("type", out JsonElement typeElem))
        {
            return;
        }

        string recType = typeElem.GetString() ?? string.Empty;
        string sid = root.TryGetProperty("sessionId", out JsonElement sidElem)
            ? sidElem.GetString() ?? sessionId
            : sessionId;

        string uuid = root.TryGetProperty("uuid", out JsonElement uuidElem)
            ? uuidElem.GetString() ?? string.Empty
            : string.Empty;
        string? parentUuid = root.TryGetProperty("parentUuid", out JsonElement puuidElem)
            ? puuidElem.GetString()
            : null;
        bool isSidechain = root.TryGetProperty("isSidechain", out JsonElement scElem) &&
                           scElem.ValueKind == JsonValueKind.True;
        long ts = ResolveTimestamp(root);

        if (string.Equals(recType, "user", StringComparison.Ordinal))
        {
            EmitUserEvents(root, sid, uuid, parentUuid, isSidechain, ts, emit);
        }
        else if (string.Equals(recType, "assistant", StringComparison.Ordinal))
        {
            EmitAssistantEvents(root, sid, uuid, parentUuid, isSidechain, ts, emit);
        }
        else if (string.Equals(recType, "queue-operation", StringComparison.Ordinal))
        {
            EmitQueueOperationEvent(root, sid, ts, emit);
        }
    }

    private static long ResolveTimestamp(JsonElement root)
    {
        if (root.TryGetProperty("timestamp", out JsonElement tsElem) &&
            tsElem.ValueKind == JsonValueKind.String)
        {
            string? tsStr = tsElem.GetString();
            if (DateTimeOffset.TryParse(
                    tsStr,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal,
                    out DateTimeOffset dto))
            {
                return dto.ToUnixTimeMilliseconds();
            }
        }

        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    private static void EmitUserEvents(
        JsonElement root,
        string sid,
        string uuid,
        string? parentUuid,
        bool isSidechain,
        long ts,
        Action<ParsedEvent> emit)
    {
        if (!root.TryGetProperty("message", out JsonElement msgElem) ||
            !msgElem.TryGetProperty("content", out JsonElement contentElem))
        {
            return;
        }

        string? cwd = root.TryGetProperty("cwd", out JsonElement cwdElem) ? cwdElem.GetString() : null;
        string? gitBranch = root.TryGetProperty("gitBranch", out JsonElement gbElem) ? gbElem.GetString() : null;

        if (contentElem.ValueKind == JsonValueKind.String)
        {
            EmitUserTextEvent(contentElem.GetString() ?? string.Empty, sid, uuid, parentUuid, isSidechain, ts, cwd, gitBranch, emit);
        }
        else if (contentElem.ValueKind == JsonValueKind.Array)
        {
            EmitUserArrayEvents(contentElem, sid, uuid, parentUuid, isSidechain, ts, cwd, gitBranch, emit);
        }
    }

    private static void EmitUserTextEvent(
        string text,
        string sid,
        string uuid,
        string? parentUuid,
        bool isSidechain,
        long ts,
        string? cwd,
        string? gitBranch,
        Action<ParsedEvent> emit)
    {
        emit(new ParsedEvent("jsonl_user_message", new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["sessionId"] = sid, ["uuid"] = uuid, ["parentUuid"] = parentUuid,
            ["isSidechain"] = isSidechain, ["ts"] = ts, ["text"] = text,
            ["cwd"] = cwd, ["gitBranch"] = gitBranch,
        }));
    }

    private static void EmitUserArrayEvents(
        JsonElement contentElem,
        string sid,
        string uuid,
        string? parentUuid,
        bool isSidechain,
        long ts,
        string? cwd,
        string? gitBranch,
        Action<ParsedEvent> emit)
    {
        foreach (JsonElement item in contentElem.EnumerateArray())
        {
            if (!item.TryGetProperty("type", out JsonElement itypeElem))
            {
                continue;
            }

            string itype = itypeElem.GetString() ?? string.Empty;

            if (string.Equals(itype, "tool_result", StringComparison.Ordinal))
            {
                string toolUseId = item.TryGetProperty("tool_use_id", out JsonElement tuiElem)
                    ? tuiElem.GetString() ?? string.Empty : string.Empty;
                bool isError = item.TryGetProperty("is_error", out JsonElement ieElem) &&
                               ieElem.ValueKind == JsonValueKind.True;
                emit(new ParsedEvent("jsonl_tool_result", new Dictionary<string, object?>(StringComparer.Ordinal)
                {
                    ["sessionId"] = sid, ["uuid"] = uuid, ["ts"] = ts,
                    ["toolUseId"] = toolUseId, ["isError"] = isError, ["result"] = string.Empty,
                }));
            }
            else if (string.Equals(itype, "text", StringComparison.Ordinal))
            {
                string text = item.TryGetProperty("text", out JsonElement textElem)
                    ? textElem.GetString() ?? string.Empty : string.Empty;
                EmitUserTextEvent(text, sid, uuid, parentUuid, isSidechain, ts, cwd, gitBranch, emit);
            }
        }
    }

    private static void EmitAssistantEvents(
        JsonElement root,
        string sid,
        string uuid,
        string? parentUuid,
        bool isSidechain,
        long ts,
        Action<ParsedEvent> emit)
    {
        if (!root.TryGetProperty("message", out JsonElement msgElem))
        {
            return;
        }

        EmitTokenUsage(msgElem, sid, uuid, ts, emit);
        EmitAssistantContent(msgElem, sid, uuid, parentUuid, isSidechain, ts, emit);
    }

    private static void EmitTokenUsage(
        JsonElement msgElem,
        string sid,
        string uuid,
        long ts,
        Action<ParsedEvent> emit)
    {
        if (!msgElem.TryGetProperty("usage", out JsonElement usageElem))
        {
            return;
        }

        int GetInt(string prop) => usageElem.TryGetProperty(prop, out JsonElement e) ? e.GetInt32() : 0;

        emit(new ParsedEvent("jsonl_token_usage", new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["sessionId"] = sid, ["uuid"] = uuid, ["ts"] = ts,
            ["inputTokens"] = GetInt("input_tokens"),
            ["outputTokens"] = GetInt("output_tokens"),
            ["cacheCreationTokens"] = GetInt("cache_creation_input_tokens"),
            ["cacheReadTokens"] = GetInt("cache_read_input_tokens"),
        }));
    }

    private static void EmitAssistantContent(
        JsonElement msgElem,
        string sid,
        string uuid,
        string? parentUuid,
        bool isSidechain,
        long ts,
        Action<ParsedEvent> emit)
    {
        if (!msgElem.TryGetProperty("content", out JsonElement contentElem) ||
            contentElem.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (JsonElement item in contentElem.EnumerateArray())
        {
            EmitAssistantContentItem(item, sid, uuid, parentUuid, isSidechain, ts, emit);
        }
    }

    private static void EmitAssistantContentItem(
        JsonElement item,
        string sid,
        string uuid,
        string? parentUuid,
        bool isSidechain,
        long ts,
        Action<ParsedEvent> emit)
    {
        if (!item.TryGetProperty("type", out JsonElement itypeElem))
        {
            return;
        }

        string itype = itypeElem.GetString() ?? string.Empty;

        if (string.Equals(itype, "text", StringComparison.Ordinal))
        {
            string text = item.TryGetProperty("text", out JsonElement textElem)
                ? textElem.GetString() ?? string.Empty : string.Empty;
            emit(new ParsedEvent("jsonl_assistant_text", new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["sessionId"] = sid, ["uuid"] = uuid, ["parentUuid"] = parentUuid,
                ["isSidechain"] = isSidechain, ["ts"] = ts, ["text"] = text,
            }));
        }
        else if (string.Equals(itype, "thinking", StringComparison.Ordinal))
        {
            string thinking = item.TryGetProperty("thinking", out JsonElement thinkElem)
                ? thinkElem.GetString() ?? string.Empty : string.Empty;
            emit(new ParsedEvent("jsonl_assistant_thinking", new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["sessionId"] = sid, ["uuid"] = uuid, ["parentUuid"] = parentUuid,
                ["isSidechain"] = isSidechain, ["ts"] = ts, ["text"] = thinking,
            }));
        }
        else if (string.Equals(itype, "tool_use", StringComparison.Ordinal))
        {
            EmitToolUseEvent(item, sid, uuid, parentUuid, isSidechain, ts, emit);
        }
    }

    private static void EmitToolUseEvent(
        JsonElement item,
        string sid,
        string uuid,
        string? parentUuid,
        bool isSidechain,
        long ts,
        Action<ParsedEvent> emit)
    {
        string toolUseId = item.TryGetProperty("id", out JsonElement idElem)
            ? idElem.GetString() ?? string.Empty : string.Empty;
        string toolName = item.TryGetProperty("name", out JsonElement nameElem)
            ? nameElem.GetString() ?? string.Empty : string.Empty;
        object? inputObj = item.TryGetProperty("input", out JsonElement inputElem)
            ? inputElem.Clone()
            : null;

        emit(new ParsedEvent("jsonl_tool_use", new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["sessionId"] = sid, ["uuid"] = uuid, ["parentUuid"] = parentUuid,
            ["isSidechain"] = isSidechain, ["ts"] = ts,
            ["toolUseId"] = toolUseId, ["toolName"] = toolName, ["input"] = inputObj,
        }));

        bool isRelay = string.Equals(toolName, "relay_reply", StringComparison.Ordinal) ||
                       toolName.EndsWith("__relay_reply", StringComparison.Ordinal);
        if (isRelay && item.TryGetProperty("input", out JsonElement relayInput))
        {
            EmitRelayMessageEvent(relayInput, sid, ts, emit);
        }
    }

    private static void EmitRelayMessageEvent(
        JsonElement relayInput,
        string sid,
        long ts,
        Action<ParsedEvent> emit)
    {
        string? to = relayInput.TryGetProperty("to", out JsonElement toElem) ? toElem.GetString() : null;
        string? body = relayInput.TryGetProperty("message", out JsonElement bodyElem) ? bodyElem.GetString() : null;
        string msgType = relayInput.TryGetProperty("type", out JsonElement msgTypeElem)
            ? msgTypeElem.GetString() ?? "message" : "message";

        if (string.IsNullOrEmpty(to) || string.IsNullOrEmpty(body))
        {
            return;
        }

        emit(new ParsedEvent("jsonl_relay_message", new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["sessionId"] = sid, ["from"] = sid, ["to"] = to,
            ["body"] = body, ["msgType"] = msgType, ["direction"] = "out", ["ts"] = ts,
        }));
    }

    private static void EmitQueueOperationEvent(
        JsonElement root,
        string sid,
        long ts,
        Action<ParsedEvent> emit)
    {
        if (!root.TryGetProperty("operation", out JsonElement opElem) ||
            !string.Equals(opElem.GetString(), "enqueue", StringComparison.Ordinal))
        {
            return;
        }

        if (!root.TryGetProperty("content", out JsonElement contentElem) ||
            contentElem.ValueKind != JsonValueKind.String)
        {
            return;
        }

        string content = contentElem.GetString() ?? string.Empty;
        Match fromMatch = FromAttrRegex().Match(content);
        if (!fromMatch.Success)
        {
            return;
        }

        Match typeMatch = TypeAttrRegex().Match(content);
        Match bodyMatch = ChannelBodyRegex().Match(content);

        emit(new ParsedEvent("jsonl_relay_message", new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["sessionId"] = sid,
            ["from"] = fromMatch.Groups["from"].Value,
            ["to"] = sid,
            ["body"] = bodyMatch.Success ? bodyMatch.Groups["body"].Value.Trim() : content,
            ["msgType"] = typeMatch.Success ? typeMatch.Groups["type"].Value : "message",
            ["direction"] = "in",
            ["ts"] = ts,
        }));
    }

    internal sealed record ParsedEvent(string Type, IReadOnlyDictionary<string, object?> Data);
}
