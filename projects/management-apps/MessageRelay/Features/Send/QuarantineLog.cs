using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MessageRelay.Features.Send;

/// <summary>
/// Appends a JSONL entry to <c>quarantine.jsonl</c> when a sender is rejected
/// with 403. Mirrors the TypeScript <c>appendFileSync(QUARANTINE_JSONL, ...)</c>
/// call in <c>routes/messages.ts</c>. Write failures are swallowed — the relay
/// must not crash because a log write failed.
/// </summary>
internal static class QuarantineLog
{
    private static readonly string DefaultLogDir = Path.Combine(AppContext.BaseDirectory, "logs");

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static async Task AppendAsync(
        string? logDir,
        string from,
        string to,
        string type,
        string ip,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(timeProvider);

        try
        {
            string dir = !string.IsNullOrEmpty(logDir) ? logDir : DefaultLogDir;
            Directory.CreateDirectory(dir);
            string ts = timeProvider.GetUtcNow().ToString("o", CultureInfo.InvariantCulture);
            string line = JsonSerializer.Serialize(
                new Entry(ts, from, to, type, ip, "sender not registered — no port file"),
                JsonOpts) + "\n";
            await File.AppendAllTextAsync(
                Path.Combine(dir, "quarantine.jsonl"),
                line,
                Encoding.UTF8,
                cancellationToken).ConfigureAwait(false);
        }
        catch (IOException) { /* fs failure — must not crash relay */ }
        catch (UnauthorizedAccessException) { /* fs failure — must not crash relay */ }
        catch (JsonException) { /* serialization failure — must not crash relay */ }
        catch (OperationCanceledException) { /* shutdown cancellation — swallow */ }
    }

    private sealed record Entry(
        string Ts,
        string From,
        string To,
        string Type,
        string Ip,
        string Reason);
}
