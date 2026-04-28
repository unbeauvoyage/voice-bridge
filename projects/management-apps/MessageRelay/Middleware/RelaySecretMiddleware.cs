using System.Collections.Frozen;
using System.Security.Cryptography;
using System.Text;

namespace MessageRelay.Middleware;

/// <summary>
/// Timing-safe auth guard for protected paths. Mirrors the TypeScript
/// <c>onRequest</c> hook in <c>relay-routes.ts</c> — rejects with 401
/// when <c>RELAY_SECRET</c> is set and the <c>X-Relay-Secret</c> header
/// is missing or wrong.
/// </summary>
internal static partial class RelaySecretMiddleware
{
    private static readonly FrozenSet<string> ProtectedPaths =
        new[] { "/send", "/status" }.ToFrozenSet(StringComparer.Ordinal);

    public static WebApplication UseRelaySecretGuard(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        string secret = app.Configuration["RELAY_SECRET"] ?? string.Empty;
        if (string.IsNullOrEmpty(secret))
        {
            Log.UnauthenticatedStartup(app.Logger);
        }

        app.Use(async (HttpContext context, Func<Task> next) =>
        {
            if (!string.IsNullOrEmpty(secret)
                && ProtectedPaths.Contains(context.Request.Path.Value ?? string.Empty))
            {
                string? rawHeader = context.Request.Headers["X-Relay-Secret"];
                string provided = rawHeader ?? string.Empty;
                if (!TimingSafeEquals(provided, secret))
                {
                    IResult result = Results.Json(
                        new Auth401Error("Unauthorized — X-Relay-Secret header required"),
                        statusCode: StatusCodes.Status401Unauthorized);
                    await result.ExecuteAsync(context).ConfigureAwait(false);
                    return;
                }
            }

            await next().ConfigureAwait(false);
        });

        return app;
    }

    private static bool TimingSafeEquals(string a, string b)
    {
        byte[] aBytes = Encoding.UTF8.GetBytes(a);
        byte[] bBytes = Encoding.UTF8.GetBytes(b);
        return aBytes.Length == bBytes.Length
            && CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }

    private static partial class Log
    {
        [LoggerMessage(
            EventId = 100,
            Level = LogLevel.Warning,
            Message = "RELAY_SECRET not set — relay is unauthenticated. Set RELAY_SECRET env var to enable sender auth.")]
        public static partial void UnauthenticatedStartup(ILogger logger);
    }
}
