import { z } from "zod";

export const jobEvent = z.object({
  job: z.enum(["build", "release"]),
  runId: z.string().uuid(),
  buildId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  releaseId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  state: z.enum(["succeeded", "failed"]),
  failure: z.enum(["dependency", "validation", "deployment"]).optional()
}).strict().superRefine((value, ctx) => {
  if (value.state === "failed" && !value.failure) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["failure"], message: "required when failed" });
  }
  if (value.state === "succeeded" && value.failure) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["failure"], message: "omit when succeeded" });
  }
});

export type JobEvent = z.infer<typeof jobEvent>;

export function decide(event: JobEvent) {
  if (event.state === "succeeded") return { capture: false as const, state: "healthy" as const };
  return {
    capture: true as const,
    state: "needs_attention" as const,
    title: `${event.job} job failed: ${event.failure}`,
    message: `Build ${event.buildId}, release ${event.releaseId}, run ${event.runId}`,
    fingerprint: [event.job, event.failure ?? "unknown"]
  };
}
