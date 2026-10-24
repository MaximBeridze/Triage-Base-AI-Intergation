import { z } from "zod";
export const TicketSchema = z.strictObject({
  ticket: z
    .string()
    .trim()
    .min(1, "Enter a ticket.")
    .max(20000, "Ticket must be at most 20,000 characters."),
  model: z.string().min(1).max(100).optional(),
});
export const TriageSchema = z.strictObject({
  category: z.enum(["billing", "technical_bug", "account", "feature_request"]),
  priority: z.enum(["low", "medium", "high"]),
  summary: z.string().trim().min(1).max(300),
  suggested_action: z.string().trim().min(1).max(500),
});
export type TriageResult = z.infer<typeof TriageSchema>;
const probability = z.number().min(0).max(1);
export const DecisionResultSchema = TriageSchema.pick({
  category: true,
  priority: true,
}).extend({
  summary: z.null(),
  suggested_action: z.null(),
  probabilities: z.strictObject({
    category: z.strictObject({
      billing: probability,
      technical_bug: probability,
      account: probability,
      feature_request: probability,
    }),
    priority: z.strictObject({
      low: probability,
      medium: probability,
      high: probability,
    }),
  }),
});
export const DisplayResultSchema = z.union([
  TriageSchema,
  DecisionResultSchema,
]);
export type DisplayResult = z.infer<typeof DisplayResultSchema>;
export const requestJsonSchema = z.toJSONSchema(TicketSchema);
export const responseJsonSchema = z.toJSONSchema(TriageSchema);
