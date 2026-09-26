# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.
## Native browser voice

This blueprint pins `@timbal-ai/timbal-sdk` **0.18.0** and ships
`POST /api/workforce/:id/voice/session` (also mounted without `/api`). It inherits
`timbalAuth` and its request-scoped client: platform authorization is applied to
that caller and the current org/project/revision. Projects with open access retain
the platform's configured service identity; add a product-specific workforce
allowlist or caller authorization if your app needs a narrower policy.

The route sends `{ transport: "livekit" }` through the SDK and returns short-lived
caller connection material, with `Cache-Control: private, no-store`. No LiveKit
browser dependency is needed in this API. The Agent's `voice_config` supplies
providers and call behavior; arbitrary browser configuration is not forwarded.
The raw SDK `voice.rtc()` method is used for this proxy so platform HTTP error
statuses/bodies and the session-id header survive (SDK 0.18.0's typed
`voice.createSession()` helper turns HTTP failures into plain `Error`). This is a
LiveKit connection-material request, never an SDP offer or audio proxy.

In a frontend with SDK 0.18.0 and `livekit-client@^2.22.3`, use:

```typescript
import { authFetch } from "@timbal-ai/timbal-react";
import { LiveKitVoiceSession } from "@timbal-ai/timbal-sdk/voice/livekit";

const session = await LiveKitVoiceSession.start({
  connect: signal => authFetch(
    `/api/workforce/${encodeURIComponent(agentId)}/voice/session`,
    { method: "POST", signal },
  ),
  signal: abortController.signal, // abort on unmount or pending-start cancellation
  onStatus: setCallStatus,
  onError: error => showCallError(error.message),
});
```

These identifiers represent your page's selection/state handlers. Start from a
user gesture, catch startup rejection, prevent duplicate starts, and offer
`session.resumeAudio()` from a click if autoplay is blocked. Treat `ready` as
readiness; a room join alone does not prove the agent started. With no greeting,
show “Ready — start speaking”.

Use deployed Agents or Studio preview (`TIMBAL_STUDIO`); standalone local
framework servers do not mint platform LiveKit caller tokens. Connection material
is created per call, never on page load, and must not be cached or logged. Confirm
a real spoken transcript and audible reply before claiming voice works; a 200
response or passing text tests is not a voice round trip.
