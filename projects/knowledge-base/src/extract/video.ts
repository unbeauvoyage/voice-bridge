import { $ } from 'bun';
import { mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const YT_DLP = '/opt/homebrew/bin/yt-dlp';

export interface VideoExtractResult {
  title: string;
  content: string;
  url: string;
  extractionError?: string;
}

async function isWhisperAvailable(): Promise<boolean> {
  try {
    const result = await $`which whisper`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function extractVideo(url: string): Promise<VideoExtractResult> {
  const tmpDir = join(tmpdir(), `kb-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. Get video title
    const titleResult = await $`${YT_DLP} --get-title --no-playlist ${url}`.quiet();
    const title = titleResult.stdout.toString().trim() || 'Unknown title';

    // 2. Check Whisper availability before downloading
    const hasWhisper = await isWhisperAvailable();
    if (!hasWhisper) {
      return {
        title,
        content: '',
        url,
        extractionError: 'Whisper not installed — run: pip install openai-whisper',
      };
    }

    // 3. Download audio only (best quality audio, no video)
    const audioPath = join(tmpDir, 'audio.%(ext)s');
    await $`${YT_DLP} -x --audio-format mp3 --audio-quality 0 --no-playlist -o ${audioPath} ${url}`.quiet();

    // Find the downloaded file
    const files = await $`ls ${tmpDir}`.quiet();
    const audioFile = files.stdout
      .toString()
      .trim()
      .split('\n')
      .map((f) => join(tmpDir, f))
      .find((f) => f.endsWith('.mp3') || f.includes('audio'));

    if (!audioFile || !existsSync(audioFile)) {
      throw new Error('Audio download failed');
    }

    // 4. Transcribe with Whisper
    await $`whisper ${audioFile} --model small --output_format txt --output_dir ${tmpDir}`.quiet();

    // Find transcript file — Whisper names it after the input file
    const txtFile = audioFile.replace(/\.(mp3|m4a|wav|ogg)$/, '.txt');
    const transcriptFile = existsSync(txtFile) ? txtFile : join(tmpDir, 'audio.txt');

    if (!existsSync(transcriptFile)) {
      throw new Error('Transcription output not found');
    }

    const transcript = await Bun.file(transcriptFile).text();

    return { title, content: transcript.trim(), url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      title: 'Unknown',
      content: '',
      url,
      extractionError: `Video extraction failed: ${message}`,
    };
  } finally {
    await $`rm -rf ${tmpDir}`.quiet().catch(() => {});
  }
}

export function isVideoUrl(url: string): boolean {
  return /vimeo\.com|tiktok\.com|twitter\.com\/.*\/status|x\.com\/.*\/status|instagram\.com|twitch\.tv|dailymotion\.com|facebook\.com\/.*\/videos/.test(
    url,
  );
}
