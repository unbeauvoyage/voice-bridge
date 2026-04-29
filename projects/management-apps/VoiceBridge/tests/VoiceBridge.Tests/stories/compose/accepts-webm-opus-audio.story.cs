using System.Net;
using System.Net.Http.Headers;
using VoiceBridge.Tests.Fixtures;
using Xunit;

namespace VoiceBridge.Tests.Stories.Compose;

/// <summary>
/// User story: CEO records audio in a browser (MediaRecorder default MIME is
/// "audio/webm;codecs=opus" — with codec parameter) and posts it to
/// voice-bridge-dotnet's /compose. The service must NOT throw a
/// System.FormatException from new MediaTypeHeaderValue("audio/webm;codecs=opus").
/// <para/>
/// RED (pre-fix): returns 500 because WhisperClient throws FormatException
/// when constructing new MediaTypeHeaderValue(mime) — the constructor rejects
/// MIME strings that include parameters (";codecs=opus").
/// <para/>
/// GREEN (post-fix): WhisperClient uses MediaTypeHeaderValue.Parse(mime) which
/// accepts parameters. The request may still fail at the whisper network call
/// (whisper-server may not be running in CI), but it must NOT return 500
/// with FormatException — it returns 503 (WhisperUnavailable) or 200.
/// </summary>
public sealed class AcceptsWebmOpusAudioStory(ComposeFixture fixture)
    : IClassFixture<ComposeFixture>
{
    [Fact]
    public async Task CeoUploadsWebmOpusAudioWithoutFormatException()
    {
        // Given CEO's browser records audio using MediaRecorder
        // Which produces "audio/webm;codecs=opus" as Content-Type
        // When CEO posts /compose with that audio blob
        // Then voice-bridge-dotnet must NOT throw a FormatException (which produces HTTP 500)
        // And the response must be either 200 OK or a well-formed compose error (not 500 internal server error)

        const string Recipient = "chief-of-staff";
        const string WebmOpusMime = "audio/webm;codecs=opus";

        using HttpClient client = fixture.CreateClient();
        using MultipartFormDataContent form = new();

        form.Add(new StringContent(Recipient), "to");
        form.Add(new StringContent("hello chief"), "text");

        // Minimal valid WebM container (EBML header only — enough bytes to
        // satisfy non-null audio; whisper will reject the content but the
        // MediaTypeHeaderValue construction must not throw first).
        byte[] stubWebm = BuildMinimalEbmlHeader();
        ByteArrayContent audio = new(stubWebm);
        audio.Headers.ContentType = MediaTypeHeaderValue.Parse(WebmOpusMime);
        form.Add(audio, "audio", "audio.webm");

        CancellationToken cancellationToken = TestContext.Current.CancellationToken;

        // When voice-bridge-dotnet receives POST /compose
        HttpResponseMessage response = await client.PostAsync(
            new Uri("/compose", UriKind.Relative), form, cancellationToken);

        string body = await response.Content.ReadAsStringAsync(cancellationToken);

        // Then the service must not 500 from a FormatException.
        // It may 503 (WhisperUnavailable) if whisper isn't running in CI —
        // that is acceptable and expected. What is NOT acceptable is 500
        // caused by the MediaTypeHeaderValue constructor rejecting the codec parameter.
        Assert.True(
            response.StatusCode != HttpStatusCode.InternalServerError,
            $"Expected non-500 from /compose with audio/webm;codecs=opus. " +
            $"Got 500 — likely System.FormatException from new MediaTypeHeaderValue(mime). Body: {body}");
    }

    /// <summary>
    /// Builds the minimal 4-byte EBML magic that identifies a WebM container.
    /// Whisper will reject it as invalid audio, but the test assertion is on
    /// the HTTP status code (not the transcript content).
    /// </summary>
    private static byte[] BuildMinimalEbmlHeader() =>
        [0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00];
}
