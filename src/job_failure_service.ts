import { createServer } from "node:http";
import { ZodError } from "zod";
import { captureFailure, InfraiError } from "./error_capture.js";
import { decide, jobEvent } from "./job_decision.js";

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/jobs/events") {
    response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
    return;
  }
  try {
    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 16_384) {
        response.writeHead(413).end(JSON.stringify({ error: "Request too large" }));
        return;
      }
    }
    const event = jobEvent.parse(JSON.parse(raw));
    const decision = decide(event);
    if (decision.capture) {
      await captureFailure({
        title: decision.title,
        message: decision.message,
        fingerprint: decision.fingerprint,
        exception: `${event.job}:${event.failure}`
      }, event.runId);
    }
    response.writeHead(200).end(JSON.stringify({ runId: event.runId, state: decision.state }));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid job event" }));
    } else if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.code }));
    } else {
      console.error(error);
      response.writeHead(502).end(JSON.stringify({ error: "Capture unavailable" }));
    }
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Job event service listening on ${process.env.PORT ?? 3000}`);
});
