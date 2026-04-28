namespace ContentService.Features.Upload;

/// <summary>
/// Successful upload response. Wire shape mandated by
/// content-service/docs/openapi.yaml — the TS sibling returns the same
/// JSON, byte-for-byte. <c>Id</c> and <c>Sha256</c> are required to be
/// equal (both are the SHA-256 hex digest of the file contents); both are
/// emitted so consumers can use whichever name reads more natural.
/// </summary>
internal sealed record UploadResult(string Id, string Url, string Mime, long Bytes, string Sha256);
