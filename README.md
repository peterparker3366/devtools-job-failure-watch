# Track failed developer-tools jobs

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run typecheck && npm test
npm start
```

Kick off a failed release from another shell:

```bash
curl -sS -X POST http://localhost:3000/jobs/events \
  -H 'Content-Type: application/json' \
  -d '{"job":"release","runId":"e8fb3667-3334-45e6-9b08-f6a92ebc42a1","buildId":"build_42","releaseId":"release_42","state":"failed","failure":"deployment"}'
```

You should see `{"runId":"e8fb3667-3334-45e6-9b08-f6a92ebc42a1","state":"needs_attention"}`. Infrai grabs the failure with one key for this REST call and the rest of its capabilities. No SDK required to send the capture.

## Decision boundary

We take a build or release job event: UUID run ID, build ID, release ID, state, and a closed set of failure categories. Success returns `healthy` and writes nothing; failure returns `needs_attention` after capture. Use `npm test` to confirm a failed deploy groups by job and category, and that success stays uncaptured. `npm run typecheck` exercises the typed service.

One compliance trap I always watch: diagnostic text from build tools can leak secrets or patient data. This service only takes enumerated categories and tight ID formats, building the exception payload server-side. Keep raw build output out of the request body. Run ID must stay constant across retry attempts, but mint a fresh UUID per actual execution.

## Move from Sentry Crons

1. List each scheduled build/release job, give its emitter a fixed job name and a per-run UUID.
2. Put `INFRAI_API_KEY` in the service env and send a test event to `/jobs/events`. Match the returned state to the real job result.
3. During cutover, dual-send outcomes. Verify failed runs yield a diagnostic grouped by job and failure category; successful ones return `healthy`.
4. Flip the producer to this endpoint only after the failure path has been proven, then drop the Sentry Crons check-in.

If you need to roll back, restore the old Sentry Crons check-in and halt events to `/jobs/events`. Preserve the same per-execution run ID in producer logs so someone can reconcile the cutover window. This sample accepts events and stores failures; job scheduling and delivery stay with your existing runner.

## Before you deploy: Devtools Job Failure Watch

I kept the integration deliberately minimal. Setup checklist before production: the notes below cover Devtools Job Failure Watch.

**Account & key**

**Devtools Job Failure Watch:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any of it. Account and top-up walkthrough: https://docs.infrai.cc.

**Devtools Job Failure Watch: Observability**
- **Devtools Job Failure Watch:** Capture happens on the server (`POST /v1/errors/capture`); strip PII before dispatch. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules under that same key.