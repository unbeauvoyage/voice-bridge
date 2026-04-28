namespace VoiceBridge.Features.Compose;

/// <summary>
/// Single failure-channel for the /compose orchestrator. Carries both the
/// machine-readable <see cref="ComposeErrorCode"/> and the
/// <see cref="ComposeStage"/> that surfaced it, so the endpoint can map to
/// the correct HTTP status + wire response without re-classifying. Mirrors
/// voice-bridge2/server/compose/envelope.ts's StageError.
/// </summary>
internal sealed class ComposeException : Exception
{
    public ComposeException()
    {
        Code = ComposeErrorCode.ValidationFailed;
        Stage = ComposeStage.Validate;
    }

    public ComposeException(string message)
        : base(message)
    {
        Code = ComposeErrorCode.ValidationFailed;
        Stage = ComposeStage.Validate;
    }

    public ComposeException(string message, Exception innerException)
        : base(message, innerException)
    {
        Code = ComposeErrorCode.ValidationFailed;
        Stage = ComposeStage.Validate;
    }

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
