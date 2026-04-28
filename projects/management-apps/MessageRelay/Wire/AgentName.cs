using System.Text.RegularExpressions;

namespace MessageRelay.Wire;

/// <summary>
/// Agent identifier validation. Same regex used at every input boundary in
/// the TypeScript canonical message-relay (<c>AGENT_NAME_RE</c> in
/// <c>relay-utils.ts</c>). Spec: <c>components.schemas.AgentName</c>.
/// </summary>
internal static partial class AgentName
{
    [GeneratedRegex(
        pattern: "^[a-zA-Z0-9_-]{1,64}$",
        options: RegexOptions.CultureInvariant,
        matchTimeoutMilliseconds: 500)]
    private static partial Regex Pattern();

    public static bool IsValid(string? candidate)
        => candidate is not null && Pattern().IsMatch(candidate);
}
