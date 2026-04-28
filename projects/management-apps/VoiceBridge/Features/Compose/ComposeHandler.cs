using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using VoiceBridge.Features.Compose.Clients;

namespace VoiceBridge.Features.Compose;

/// <summary>
/// Orchestrates POST /compose. Mirrors voice-bridge2/server/compose/orchestrator.ts:
/// validate → parallel(transcribe, uploads) → compose body → POST relay.
/// All-or-nothing: any sub-step failure throws <see cref="ComposeException"/>;
/// the endpoint maps to 4xx/5xx with stage-tagged <see cref="ComposeError"/>.
/// </summary>
[SuppressMessage("Performance", "CA1812:Avoid uninstantiated internal classes", Justification = "Instantiated via DI (AddScoped<ComposeHandler>).")]
internal sealed partial class ComposeHandler
{
    private readonly IWhisperClient whisper;
    private readonly IContentServiceClient contentService;
    private readonly IRelaySendClient relay;
    private readonly TimeProvider time;
    private readonly ILogger<ComposeHandler> logger;

    public ComposeHandler(
        IWhisperClient whisper,
        IContentServiceClient contentService,
        IRelaySendClient relay,
        TimeProvider time,
        ILogger<ComposeHandler> logger)
    {
        ArgumentNullException.ThrowIfNull(whisper);
        ArgumentNullException.ThrowIfNull(contentService);
        ArgumentNullException.ThrowIfNull(relay);
        ArgumentNullException.ThrowIfNull(time);
        ArgumentNullException.ThrowIfNull(logger);

        this.whisper = whisper;
        this.contentService = contentService;
        this.relay = relay;
        this.time = time;
        this.logger = logger;
    }

    public async Task<ComposeResponse> HandleAsync(ComposeRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        long startTimestamp = Stopwatch.GetTimestamp();
        bool hadAudio = request.Audio is not null;
        string outcome = "unknown";

        using Activity? parent = StartParentActivity(request, hadAudio);

        try
        {
            ComposeResponse response = await RunPipelineAsync(request, cancellationToken);
            outcome = "delivered";
            parent?.SetTag("outcome", outcome);
            return response;
        }
        catch (ComposeException ex)
        {
            outcome = ex.Code.ToWire();
            parent?.SetTag("outcome", outcome);
            parent?.SetStatus(ActivityStatusCode.Error, ex.Message);
            LogComposeFailure(logger, ex.Code.ToWire(), ex.Stage.ToWire(), ex);
            throw;
        }
        finally
        {
            RecordMetrics(outcome, hadAudio, startTimestamp);
        }
    }

    private async Task<ComposeResponse> RunPipelineAsync(ComposeRequest request, CancellationToken cancellationToken)
    {
        ValidateEnvelope(request);

        Task<string?> transcribeTask = TranscribeIfPresentAsync(request.Audio, cancellationToken);
        Task<IReadOnlyList<ComposeAttachment>> uploadTask = UploadAllAsync(request.Attachments, cancellationToken);
        await Task.WhenAll(transcribeTask, uploadTask);

        string? transcript = await transcribeTask;
        IReadOnlyList<ComposeAttachment> uploaded = await uploadTask;

        string body = ComposeBody(request.Text, transcript, uploaded);
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new ComposeException(
                ComposeErrorCode.NoSpeech,
                ComposeStage.Transcribe,
                "audio produced no transcript and no other content was provided");
        }

        RelaySendResult sendResult = await SendToRelayAsync(request.To, body, cancellationToken);
        string ts = time.GetUtcNow().ToString("O", CultureInfo.InvariantCulture);

        return new ComposeResponse(
            Delivered: true,
            To: request.To,
            Transcript: transcript,
            AttachmentUrls: uploaded,
            Body: body,
            MessageId: sendResult.Id,
            Ts: ts);
    }

    private static Activity? StartParentActivity(ComposeRequest request, bool hadAudio)
    {
        Activity? parent = ComposeTelemetry.ActivitySource.StartActivity("compose", ActivityKind.Server);
        parent?.SetTag("to", request.To);
        parent?.SetTag("has_text", !string.IsNullOrEmpty(request.Text));
        parent?.SetTag("has_audio", hadAudio);
        parent?.SetTag("attachment_count", request.Attachments.Count);
        return parent;
    }

    private async Task<RelaySendResult> SendToRelayAsync(string to, string body, CancellationToken cancellationToken)
    {
        using Activity? activity = ComposeTelemetry.ActivitySource.StartActivity("compose.relay", ActivityKind.Internal);
        return await relay.SendAsync(
            from: "ceo",
            to: to,
            body: body,
            messageType: "message",
            cancellationToken);
    }

    private static void RecordMetrics(string outcome, bool hadAudio, long startTimestamp)
    {
        double elapsedMs = Stopwatch.GetElapsedTime(startTimestamp).TotalMilliseconds;
        ComposeTelemetry.ComposeRequests.Add(
            1,
            new KeyValuePair<string, object?>("outcome", outcome),
            new KeyValuePair<string, object?>("had_audio", hadAudio));
        ComposeTelemetry.ComposeDurationMs.Record(
            elapsedMs,
            new KeyValuePair<string, object?>("outcome", outcome),
            new KeyValuePair<string, object?>("had_audio", hadAudio));
    }

    private static void ValidateEnvelope(ComposeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.To))
        {
            throw new ComposeException(
                ComposeErrorCode.ValidationFailed,
                ComposeStage.Validate,
                "field 'to' is required");
        }

        bool hasText = !string.IsNullOrWhiteSpace(request.Text);
        bool hasAudio = request.Audio is not null;
        bool hasAttachments = request.Attachments.Count > 0;

        if (!hasText && !hasAudio && !hasAttachments)
        {
            throw new ComposeException(
                ComposeErrorCode.ValidationFailed,
                ComposeStage.Validate,
                "at least one of text, audio, or attachments is required");
        }
    }

    private async Task<string?> TranscribeIfPresentAsync(IFormFile? audio, CancellationToken cancellationToken)
    {
        if (audio is null)
        {
            return null;
        }

        using Activity? activity = ComposeTelemetry.ActivitySource.StartActivity("compose.transcribe", ActivityKind.Internal);
        activity?.SetTag("audio.bytes", audio.Length);
        activity?.SetTag("audio.mime", audio.ContentType);

        await using Stream stream = audio.OpenReadStream();
        string transcript = await whisper.TranscribeAsync(
            stream,
            mime: audio.ContentType ?? "application/octet-stream",
            filename: audio.FileName.Length > 0 ? audio.FileName : "audio.bin",
            cancellationToken);

        return transcript.Trim();
    }

    private async Task<IReadOnlyList<ComposeAttachment>> UploadAllAsync(
        IReadOnlyList<IFormFile> attachments,
        CancellationToken cancellationToken)
    {
        if (attachments.Count == 0)
        {
            return [];
        }

        Task<ComposeAttachment>[] uploads = new Task<ComposeAttachment>[attachments.Count];
        for (int i = 0; i < attachments.Count; i++)
        {
            uploads[i] = UploadOneAsync(attachments[i], cancellationToken);
        }

        ComposeAttachment[] uploaded = await Task.WhenAll(uploads);
        return uploaded;
    }

    private async Task<ComposeAttachment> UploadOneAsync(IFormFile file, CancellationToken cancellationToken)
    {
        using Activity? activity = ComposeTelemetry.ActivitySource.StartActivity("compose.upload", ActivityKind.Internal);
        activity?.SetTag("attachment.bytes", file.Length);
        activity?.SetTag("attachment.mime", file.ContentType);

        await using Stream stream = file.OpenReadStream();
        return await contentService.UploadAsync(
            stream,
            mime: file.ContentType ?? "application/octet-stream",
            filename: file.FileName.Length > 0 ? file.FileName : "attachment.bin",
            cancellationToken);
    }

    private static string ComposeBody(string? text, string? transcript, IReadOnlyList<ComposeAttachment> uploaded)
    {
        string body = string.IsNullOrEmpty(text) ? string.Empty : text;

        if (!string.IsNullOrWhiteSpace(transcript))
        {
            body = body.Length > 0 ? $"{body}\n\n{transcript}" : transcript;
        }

        foreach (ComposeAttachment attachment in uploaded)
        {
            string marker = $"[Attachment: {attachment.Url}]";
            body = body.Length > 0 ? $"{body}\n\n{marker}" : marker;
        }

        return body;
    }

    [LoggerMessage(EventId = 2001, Level = LogLevel.Warning, Message = "Compose pipeline failed: {Code} at stage {Stage}")]
    private static partial void LogComposeFailure(ILogger logger, string code, string stage, Exception exception);
}
