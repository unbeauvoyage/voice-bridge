/**
 * Returns true if the transcript tail contains >=2 occurrences of "cancel",
 * meaning the user wants to discard the recording.
 *
 * Looks at the last 10 whitespace-delimited tokens, rejoins them, and uses
 * word-boundary matching so punctuation / em-dashes between tokens don't hide
 * matches (Whisper can produce "cancel, cancel" or "cancel—cancel").
 */
export function isCancelCommand(transcript: string): boolean {
  const tail = transcript.trim().split(/\s+/).slice(-10).join(' ')
  const matches = tail.match(/\bcancel\b/gi) ?? []
  return matches.length > 1
}
