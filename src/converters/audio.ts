import { converter, anyOf, byMime, byExt } from "../converter.js";
import { exiftoolMetadata } from "./exiftool.js";

const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".mp4"];
const ACCEPTED_MIME_PREFIXES = ["audio/x-wav", "audio/mpeg", "video/mp4"];

const AUDIO_METADATA_FIELDS = [
  "Title",
  "Artist",
  "Author",
  "Band",
  "Album",
  "Genre",
  "Track",
  "DateTimeOriginal",
  "CreateDate",
  "NumChannels",
  "SampleRate",
  "AvgBytesPerSec",
  "BitsPerSample",
];

export const audioConverter = converter(
  "Audio",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    let md = "";

    // Extract metadata via exiftool
    const metadata = await exiftoolMetadata(ctx.buffer, ctx.opts.exiftoolPath);
    const metaLines: string[] = [];
    for (const field of AUDIO_METADATA_FIELDS) {
      if (metadata[field]) {
        metaLines.push(`- **${field}:** ${metadata[field]}`);
      }
    }
    if (metaLines.length) {
      md += "# Audio Metadata\n\n" + metaLines.join("\n") + "\n";
    }

    // Note: speech transcription via speech_recognition is not ported
    // (requires pocketsphinx or Google Speech API)

    return { markdown: md.trim() };
  },
);
