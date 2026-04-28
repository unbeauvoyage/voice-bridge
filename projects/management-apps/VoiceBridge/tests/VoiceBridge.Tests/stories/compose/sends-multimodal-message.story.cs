using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using VoiceBridge.Tests.Fixtures;
using Xunit;

namespace VoiceBridge.Tests.Stories.Compose;

/// <summary>
/// User story: CEO posts a multimodal compose envelope (text + audio + one
/// PNG attachment) addressed to chief-of-staff to voice-bridge-dotnet's
/// /compose. The service transcribes the audio via whisper, uploads the
/// attachment to content-service, composes a body with all three modalities,
/// and delivers it to the relay as a single "ceo → chief-of-staff" message.
/// <para/>
/// Today (RED): /compose endpoint is not implemented — the test must fail at
/// the 200-OK assertion because the request returns 404.
/// <para/>
/// After implementation (GREEN against TS peers): voice-bridge-dotnet routes
/// to relay-ts + content-service-ts via the env vars supplied by
/// <see cref="ComposeFixture"/>.
/// <para/>
/// Later (GREEN against .NET peers, no test change): same fixture, same
/// test; only the VBTEST_* env vars flip to the .NET endpoints once
/// relay-dotnet POST /send + content-service-dotnet POST /upload land.
/// </summary>
public sealed class SendsMultimodalMessageStory(ComposeFixture fixture)
    : IClassFixture<ComposeFixture>
{
    [Fact]
    public async Task CeoSendsTextAudioAndAttachmentToChiefOfStaff()
    {
        // Given the CEO is composing a message addressed to chief-of-staff
        // And has typed "hello chief"
        // And recorded a 1-second audio clip
        // And selected one PNG attachment
        const string Recipient = "chief-of-staff";
        const string TextLiteral = "hello chief";
        const string AttachmentMarker = "[Attachment:";

        using HttpClient client = fixture.CreateClient();
        using MultipartFormDataContent form = new();

        form.Add(new StringContent(Recipient), "to");
        form.Add(new StringContent(TextLiteral), "text");

        byte[] wav = BuildSilenceWav(durationSeconds: 1, sampleRate: 16_000);
        ByteArrayContent audio = new(wav);
        audio.Headers.ContentType = new MediaTypeHeaderValue("audio/wav");
        form.Add(audio, "audio", "audio.wav");

        byte[] png = BuildOnePixelPng();
        ByteArrayContent attachment = new(png);
        attachment.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(attachment, "attachments", "tiny.png");

        CancellationToken cancellationToken = TestContext.Current.CancellationToken;

        // When voice-bridge-dotnet receives POST /compose
        HttpResponseMessage response = await client.PostAsync(
            new Uri("/compose", UriKind.Relative), form, cancellationToken);

        string responseJson = await response.Content.ReadAsStringAsync(cancellationToken);

        // Then the response is 200 OK with delivered:true and a body containing
        // all three modalities. Parse as JSON so the assertions are robust to
        // pretty-printed dev formatting (BackendDefaults.WriteIndented = true
        // when ASPNETCORE_ENVIRONMENT is Development).
        Assert.True(
            response.StatusCode == HttpStatusCode.OK,
            $"Expected 200 OK from /compose; got {(int)response.StatusCode} {response.StatusCode}. Body: {responseJson}");

        using JsonDocument doc = JsonDocument.Parse(responseJson);
        JsonElement root = doc.RootElement;

        Assert.True(root.GetProperty("delivered").GetBoolean(), "delivered must be true");
        Assert.Equal(Recipient, root.GetProperty("to").GetString());

        string? composedBody = root.GetProperty("body").GetString();
        Assert.NotNull(composedBody);
        Assert.Contains(TextLiteral, composedBody, StringComparison.Ordinal);
        Assert.Contains(AttachmentMarker, composedBody, StringComparison.Ordinal);
    }

    private static byte[] BuildSilenceWav(int durationSeconds, int sampleRate)
    {
        const short ChannelCount = 1;
        const short BitsPerSample = 16;
        int byteRate = sampleRate * ChannelCount * BitsPerSample / 8;
        short blockAlign = (short)(ChannelCount * BitsPerSample / 8);
        int dataLength = byteRate * durationSeconds;

        using MemoryStream stream = new(44 + dataLength);
        using BinaryWriter writer = new(stream, Encoding.ASCII, leaveOpen: false);

        writer.Write(Encoding.ASCII.GetBytes("RIFF"));
        writer.Write(36 + dataLength);
        writer.Write(Encoding.ASCII.GetBytes("WAVE"));
        writer.Write(Encoding.ASCII.GetBytes("fmt "));
        writer.Write(16);
        writer.Write((short)1);
        writer.Write(ChannelCount);
        writer.Write(sampleRate);
        writer.Write(byteRate);
        writer.Write(blockAlign);
        writer.Write(BitsPerSample);
        writer.Write(Encoding.ASCII.GetBytes("data"));
        writer.Write(dataLength);
        writer.Write(new byte[dataLength]);

        writer.Flush();
        return stream.ToArray();
    }

    private static byte[] BuildOnePixelPng()
    {
        byte[] signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

        byte[] ihdrData =
        [
            0x00, 0x00, 0x00, 0x01,
            0x00, 0x00, 0x00, 0x01,
            0x08,
            0x06,
            0x00,
            0x00,
            0x00,
        ];

        byte[] rawScanline = [0x00, 0xFF, 0x00, 0x00, 0x00];
        byte[] idatData = ZlibCompress(rawScanline);

        using MemoryStream stream = new();
        using BinaryWriter writer = new(stream, Encoding.ASCII, leaveOpen: false);

        writer.Write(signature);
        WriteChunk(writer, "IHDR", ihdrData);
        WriteChunk(writer, "IDAT", idatData);
        WriteChunk(writer, "IEND", []);

        writer.Flush();
        return stream.ToArray();
    }

    private static void WriteChunk(BinaryWriter writer, string typeCode, byte[] data)
    {
        writer.Write(BigEndianBytes((uint)data.Length));
        byte[] typeBytes = Encoding.ASCII.GetBytes(typeCode);
        writer.Write(typeBytes);
        writer.Write(data);

        byte[] crcInput = new byte[typeBytes.Length + data.Length];
        Buffer.BlockCopy(typeBytes, 0, crcInput, 0, typeBytes.Length);
        Buffer.BlockCopy(data, 0, crcInput, typeBytes.Length, data.Length);
        writer.Write(BigEndianBytes(Crc32(crcInput)));
    }

    private static byte[] BigEndianBytes(uint value) =>
        [(byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value];

    private static uint Crc32(byte[] input)
    {
        uint[] table = BuildCrc32Table();
        uint crc = 0xFFFFFFFFu;
        foreach (byte b in input)
        {
            crc = table[(crc ^ b) & 0xFF] ^ (crc >> 8);
        }
        return crc ^ 0xFFFFFFFFu;
    }

    private static uint[] BuildCrc32Table()
    {
        uint[] table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            uint c = n;
            for (int k = 0; k < 8; k++)
            {
                c = ((c & 1u) != 0u) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1);
            }
            table[n] = c;
        }
        return table;
    }

    private static byte[] ZlibCompress(byte[] input)
    {
        using MemoryStream output = new();
        output.WriteByte(0x78);
        output.WriteByte(0x9C);
        using (DeflateStream deflate = new(output, CompressionLevel.Optimal, leaveOpen: true))
        {
            deflate.Write(input, 0, input.Length);
        }
        uint adler = Adler32(input);
        output.WriteByte((byte)(adler >> 24));
        output.WriteByte((byte)(adler >> 16));
        output.WriteByte((byte)(adler >> 8));
        output.WriteByte((byte)adler);
        return output.ToArray();
    }

    private static uint Adler32(byte[] input)
    {
        const uint Modulus = 65521u;
        uint a = 1;
        uint b = 0;
        foreach (byte x in input)
        {
            a = (a + x) % Modulus;
            b = (b + a) % Modulus;
        }
        return (b << 16) | a;
    }
}
