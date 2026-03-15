import { z } from "zod";

const styleSchema = z.object({
  roastMode: z.boolean().optional().default(true),
  debateMode: z.boolean().optional().default(true),
  intensity: z.number().int().min(1).max(5).optional().default(2),
  persona: z
    .enum(["jarvis", "mentor", "sparring", "chill"])
    .optional()
    .default("jarvis"),
  responseFormat: z
    .enum(["quick", "standard", "deep"])
    .optional()
    .default("standard"),
  allowProfanity: z.boolean().optional().default(false),
  goals: z.array(z.string().min(1).max(200)).max(8).optional().default([]),
});

export const chatSchema = z.object({
  sessionId: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  stream: z.boolean().optional().default(true),
  style: styleSchema.optional().default({
    roastMode: true,
    debateMode: true,
    intensity: 2,
    persona: "jarvis",
    responseFormat: "standard",
    allowProfanity: false,
    goals: [],
  }),
});

export const ingestSchema = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(100),
});
