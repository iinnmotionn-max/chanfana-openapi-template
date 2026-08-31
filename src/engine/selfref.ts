// A handle on our own request pipeline, so the system can attack itself.
//
// The guard probe has to exercise the REAL path — routing, handler order, the
// works — because a guard that exists in the source but not in the served
// route is exactly the failure it's hunting. Two ways to get that:
//
//   HTTP back to our own hostname. Rejected: it doesn't loop back under the
//   test runner (the probe silently scores 0 and proves nothing), it burns a
//   subrequest per route, and it depends on DNS and zone routing being healthy
//   — a probe that fails for unrelated reasons is worse than no probe.
//
//   Dispatch straight through the app's fetch handler. Same routing, same
//   middleware, same handlers, no network. That's this.
//
// src/index.ts registers the handler once at module load. Keeping the handle
// here rather than importing the app avoids an import cycle: index.ts pulls in
// the endpoints, which pull in the engine — the engine must not pull back.

export type SelfHandler = (req: Request, env: unknown) => Promise<Response>;

let handler: SelfHandler | null = null;

export function setSelfHandler(h: SelfHandler): void {
	handler = h;
}

// Dispatch a request through our own router. Throws when unregistered rather
// than returning something reassuring — an un-run probe must never read as a
// pass.
export async function selfFetch(req: Request, env: unknown): Promise<Response> {
	if (!handler) throw new Error("self handler not registered — src/index.ts must call setSelfHandler()");
	return handler(req, env);
}

export function selfHandlerReady(): boolean {
	return handler !== null;
}
