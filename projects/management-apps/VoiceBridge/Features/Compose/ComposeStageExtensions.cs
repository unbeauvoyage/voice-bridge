namespace VoiceBridge.Features.Compose;

internal static class ComposeStageExtensions
{
    public static string ToWire(this ComposeStage stage) =>
        stage switch
        {
            ComposeStage.Validate => "validate",
            ComposeStage.Transcribe => "transcribe",
            ComposeStage.Upload => "upload",
            ComposeStage.Deliver => "deliver",
            _ => throw new ArgumentOutOfRangeException(nameof(stage), stage, message: null),
        };
}
