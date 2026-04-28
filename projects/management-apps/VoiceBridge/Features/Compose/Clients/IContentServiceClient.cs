namespace VoiceBridge.Features.Compose.Clients;

/// <summary>
/// Uploads one attachment to content-service. Returns the recorded
/// <see cref="ComposeAttachment"/>. Throws <see cref="ComposeException"/>
/// with code AttachmentTooLarge / UnsupportedMime / ContentServiceUnavailable
/// per content-service /upload contract.
/// </summary>
internal interface IContentServiceClient
{
    public Task<ComposeAttachment> UploadAsync(
        Stream content,
        string mime,
        string filename,
        CancellationToken cancellationToken);
}
