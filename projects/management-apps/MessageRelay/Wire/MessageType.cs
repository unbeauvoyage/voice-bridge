using System.Collections.Frozen;

namespace MessageRelay.Wire;

/// <summary>
/// Wire-format message-type constants. Mirrors the TypeScript enum in
/// <c>message-relay/src/types.ts</c>. Spec: <c>components.schemas.MessageType</c>.
/// </summary>
internal static class MessageType
{
    public const string Message = "message";
    public const string Done = "done";
    public const string WaitingForInput = "waiting-for-input";
    public const string Escalate = "escalate";
    public const string Status = "status";
    public const string Voice = "voice";
    public const string PermissionResult = "permission-result";

    private static readonly FrozenSet<string> ValidTypes = new[]
    {
        Message, Done, WaitingForInput, Escalate, Status, Voice, PermissionResult,
    }.ToFrozenSet(StringComparer.Ordinal);

    public static bool IsValid(string? candidate)
        => candidate is not null && ValidTypes.Contains(candidate);
}
