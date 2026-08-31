import path from "node:path";
import { readFile } from "node:fs/promises";
import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

const migrationsPath = path.join(__dirname, "..", "migrations");
const migrations = await readD1Migrations(migrationsPath);

// The route table, read from source at config time (Node) and handed to the
// Worker as a binding. Tests inside workerd have no filesystem, but the one
// thing that must never drift — every writing route being classified in
// policy.ts — can only be checked against the actual registrations.
const indexSource = await readFile(path.join(__dirname, "..", "src", "index.ts"), "utf8");

export default defineWorkersConfig({
	esbuild: {
		target: "esnext",
	},
	test: {
		setupFiles: ["./tests/apply-migrations.ts"],
		poolOptions: {
			workers: {
				singleWorker: true,
				wrangler: {
					configPath: "../wrangler.jsonc",
				},
				miniflare: {
					compatibilityFlags: ["experimental", "nodejs_compat"],
					bindings: {
						MIGRATIONS: migrations,
						INDEX_SOURCE: indexSource,
						// The RP bridge is secret-gated; give tests a known secret so
						// both the happy path and the 401 path are exercised.
						RP_SHARED_SECRET: "test-rp-secret",
						// Local-agent bridge: bound so both the 401 path and the
						// happy path are exercised.
						LOCAL_AGENT_SECRET: "test-agent-secret",
						// An OPEN rotation window on both bridges — the outgoing
						// secrets are still accepted, and every call made on them is
						// recorded. Tests assert that overlap actually works.
						LOCAL_AGENT_SECRET_PREVIOUS: "old-agent-secret",
						RP_SHARED_SECRET_PREVIOUS: "old-rp-secret",
						// The control-plane lock. Bound so tests can exercise BOTH
						// sides: with the key, and (by omitting the header) without.
						CREATOR_KEY: "test-creator-key",
						// A vault id is a label, not a credential — bound so the export
						// can be asserted to stamp it without granting anything.
						OBSIDIAN_VAULT_ID: "b3eb17c55ee39515",
					},
				},
			},
		},
	},
});
