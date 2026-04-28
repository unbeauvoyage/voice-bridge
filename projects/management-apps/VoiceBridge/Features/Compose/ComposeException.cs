using System.Diagnostics.CodeAnalysis;

namespace VoiceBridge.Features.Compose;

/// <summary>
/// Single failure-channel for the /compose orchestrator. Carries both the
/// machine-readable <see cref="ComposeErrorCode"/> and the
/// <see cref="ComposeStage"/> that surfaced it, so the endpoint can map to
/// the correct HTTP status + wire response without re-classifying. Mirrors
/// voice-bridge2/server/compose/envelope.ts's StageError.
/// </summary>
[SuppressMessage("Design", "CA1032:ImplementStandardExceptionConstructors",
    Justification = "Domain-specific ctor only. CA1032/RCS1194 stubs would silently default Code to ValidationFailed.")]
[SuppressMessage("Roslynator", "RCS1194:ImplementExceptionConstructors",
    Justification = "Domain-specific ctor only. CA1032/RCS1194 stubs would silently default Code to ValidationFailed.")]
internal sealed class ComposeException : Exception
{
    public ComposeException(ComposeErrorCode code, ComposeStage stage, string message)
        : base(message)
    {
        Code = code;
        Stage = stage;
    }

    public ComposeException(ComposeErrorCode code, ComposeStage stage, string message, Exception inner)
        : base(message, inner)
    {
        Code = code;
        Stage = stage;
    }

    public ComposeErrorCode Code { get; }

    public ComposeStage Stage { get; }
}
