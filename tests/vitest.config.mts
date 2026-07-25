import path from "node:path";
import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

const migrationsPath = path.join(__dirname, "..", "migrations");
const migrations = await readD1Migrations(migrationsPath);

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
					},
				},
			},
		},
	},
});
