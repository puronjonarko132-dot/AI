import { z } from "zod";

export const chatSchema = z.object({
  sessionId: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  stream: z.boolean().optional().default(true),
});

export const ingestSchema = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(100),
});
