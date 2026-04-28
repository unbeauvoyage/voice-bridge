using System.Net;
using Microsoft.Extensions.Primitives;

namespace VoiceBridge.Features.Compose;

/// <summary>
/// Wires <c>POST /compose</c> into the request pipeline. Reads the multipart
/// form, dispatches to <see cref="ComposeHandler"/>, and maps
/// <see cref="ComposeException"/> to the documented HTTP status + wire body.
/// Mapping table per voice-bridge2/docs/openapi.yaml.
/// </summary>
internal static class ComposeEndpoint
{
    public static IEndpointRouteBuilder MapComposeFeature(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapPost("/compose", HandleAsync)
            .DisableAntiforgery();

        return app;
    }

    private static async Task<IResult> HandleAsync(
        HttpRequest request,
        ComposeHandler handler,
        CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
        {
            return Results.Json(
                new ComposeError(
                    Error: ComposeErrorCode.ValidationFailed.ToWire(),
                    Message: "request must be multipart/form-data",
                    Stage: ComposeStage.Validate.ToWire()),
                statusCode: (int)HttpStatusCode.BadRequest);
        }

        IFormCollection form = await request.ReadFormAsync(cancellationToken);
        ComposeRequest envelope = BuildEnvelope(form);

        try
        {
            ComposeResponse response = await handler.HandleAsync(envelope, cancellationToken);
            return Results.Ok(response);
        }
        catch (ComposeException ex)
        {
            return Results.Json(
                new ComposeError(
                    Error: ex.Code.ToWire(),
                    Message: ex.Message,
                    Stage: ex.Stage.ToWire()),
                statusCode: ToHttpStatus(ex.Code));
        }
    }

    private static ComposeRequest BuildEnvelope(IFormCollection form) =>
        new(
            To: form["to"].ToString(),
            Text: form.TryGetValue("text", out StringValues text) ? text.ToString() : null,
            ReplyTo: form.TryGetValue("replyTo", out StringValues replyTo) ? replyTo.ToString() : null,
            Audio: form.Files.GetFile("audio"),
            Attachments: form.Files.GetFiles("attachments"));

    private static int ToHttpStatus(ComposeErrorCode code) =>
        code switch
        {
            ComposeErrorCode.ValidationFailed => (int)HttpStatusCode.BadRequest,
            ComposeErrorCode.NoSpeech => (int)HttpStatusCode.UnprocessableEntity,
            ComposeErrorCode.AttachmentTooLarge => (int)HttpStatusCode.RequestEntityTooLarge,
            ComposeErrorCode.UnsupportedMime => (int)HttpStatusCode.UnsupportedMediaType,
            ComposeErrorCode.WhisperUnavailable => (int)HttpStatusCode.BadGateway,
            ComposeErrorCode.ContentServiceUnavailable => (int)HttpStatusCode.BadGateway,
            ComposeErrorCode.RelayUnavailable => (int)HttpStatusCode.BadGateway,
            _ => (int)HttpStatusCode.InternalServerError,
        };
}
