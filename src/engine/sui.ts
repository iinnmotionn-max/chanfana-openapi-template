// Sui settlement adapter for the Aether token. The Databank ledger
// (token.ts) is the fast operational layer; this links it to the AETHER coin
// published on the Sui blockchain (sui/aether/sources/aether.move).
//
// It reads on-chain config from the Worker environment (set as wrangler vars /
// secrets after you publish the Move package). With nothing configured it
// reports "not linked" — the off-chain ledger stays the source of truth, and
// nothing here ever fabricates an on-chain link that doesn't exist.

const RPC: Record<string, string> = {
	mainnet: "https://fullnode.mainnet.sui.io:443",
	testnet: "https://fullnode.testnet.sui.io:443",
	devnet: "https://fullnode.devnet.sui.io:443",
	localnet: "http://127.0.0.1:9000",
};

export interface SuiChainStatus {
	linked: boolean;
	network: string;
	packageId: string | null;
	coinType: string | null;
	treasuryCap: string | null;
	rpcUrl: string | null;
	explorer: string | null;
	note: string;
}

function envStr(env: unknown, key: string): string | null {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" && v.length > 0 ? v : null;
}

// Pure, offline-safe: reflects configuration only. Publishing on Sui is a
// signed, gas-paying transaction the operator runs with their own wallet — see
// docs/AETHER_SUI.md — so this never attempts to sign or spend anything.
export function suiChainStatus(env: unknown): SuiChainStatus {
	const network = (envStr(env, "SUI_NETWORK") ?? "testnet").toLowerCase();
	const packageId = envStr(env, "AETHER_PACKAGE_ID");
	const treasuryCap = envStr(env, "AETHER_TREASURY_CAP");
	// The coin type is <package>::aether::AETHER once published.
	const coinType = packageId ? `${packageId}::aether::AETHER` : null;
	const rpcUrl = RPC[network] ?? RPC.testnet;
	const linked = Boolean(packageId);
	return {
		linked,
		network,
		packageId,
		coinType,
		treasuryCap,
		rpcUrl,
		explorer: packageId ? `https://suiscan.xyz/${network}/object/${packageId}` : null,
		note: linked
			? `Linked to AETHER on Sui ${network}. Ledger settles against ${coinType}.`
			: "Not linked to Sui yet — publish sui/aether then set AETHER_PACKAGE_ID. The Databank ledger is the source of truth until then.",
	};
}
