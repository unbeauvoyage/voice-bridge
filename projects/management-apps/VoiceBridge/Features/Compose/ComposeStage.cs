namespace VoiceBridge.Features.Compose;

/// <summary>
/// Orchestration phase that failed, surfaced via the <c>stage</c> field of a
/// /compose failure response. Wire literals via
/// <see cref="ComposeStageExtensions.ToWire"/>.
/// </summary>
internal enum ComposeStage
{
    Validate,
    Transcribe,
    Upload,
    Deliver,
}
