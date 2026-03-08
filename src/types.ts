import { z } from "zod/v4";

export const StreamInfoSchema = z.object({
  mimetype: z.string().optional(),
  extension: z.string().optional(),
  charset: z.string().optional(),
  filename: z.string().optional(),
  localPath: z.string().optional(),
  url: z.string().optional(),
});
export type StreamInfo = z.infer<typeof StreamInfoSchema>;

export const ConvertResultSchema = z.object({
  markdown: z.string(),
  title: z.string().optional(),
});
export type ConvertResult = z.infer<typeof ConvertResultSchema>;

export const ConvertOptionsSchema = z.object({
  llmClient: z.any().optional(),
  llmModel: z.string().optional(),
  llmPrompt: z.string().optional(),
  exiftoolPath: z.string().optional(),
  styleMap: z.string().optional(),
  keepDataUris: z.boolean().optional(),
});
export type ConvertOptions = z.infer<typeof ConvertOptionsSchema>;
