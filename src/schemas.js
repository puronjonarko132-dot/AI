import { z } from "zod";

const styleSchema = z.object({
  roastMode: z.boolean().optional(),
  debateMode: z.boolean().optional(),
  intensity: z.number().int().min(1).max(5).optional(),
  persona: z.enum(["jarvis", "mentor", "sparring", "chill"]).optional(),
  responseFormat: z.enum(["quick", "standard", "deep"]).optional(),
  allowProfanity: z.boolean().optional(),
  goals: z.array(z.string().min(1).max(200)).max(8).optional(),
});

export const chatSchema = z.object({
  sessionId: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  stream: z.boolean().optional().default(true),
  style: styleSchema.optional(),
});

export const ingestSchema = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(100),
});
