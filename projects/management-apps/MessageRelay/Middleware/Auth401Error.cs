namespace MessageRelay.Middleware;

/// <summary>
/// Wire body for 401 Unauthorized responses from the relay secret guard.
/// Shape: <c>{ "error": "..." }</c> — no id, no status (spec: <c>paths./send 401</c>).
/// </summary>
internal sealed record Auth401Error(string Error);
