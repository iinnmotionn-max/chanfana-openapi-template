// Wallet endpoints: a real in-app web3 wallet over the AETHER ledger. Open
// addresses, send/receive AETHER, link a self-custody Sui address, and read
// transaction history. Every value movement is a ledger transfer() — the wallet
// layer never mints or destroys supply.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { requireCreator } from "../engine/creator";
import { createWallet, ensureAetherWallet, linkSui, sendAether, walletList, walletOverview } from "../engine/wallet";

export class WalletList extends OpenAPIRoute {
	public schema = {
		tags: ["Wallet"],
		summary: "All wallets with their address, balance, and linked Sui address",
		responses: {
			"200": { description: "Wallets", ...contentJson({ success: z.boolean(), result: z.array(z.any()) }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await walletList(c.env.DB) };
	}
}

export class AetherWallet extends OpenAPIRoute {
	public schema = {
		tags: ["Wallet"],
		summary: "Aether mints (or returns) its own self-custody web3 wallet",
		responses: {
			"200": { description: "Aether's wallet address", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const w = await ensureAetherWallet(c.env.DB);
		return { success: true, result: w };
	}
}

export class WalletCreate extends OpenAPIRoute {
	public schema = {
		tags: ["Wallet"],
		summary: "Open a new wallet (a zero-balance AETHER account with a fresh 0x address)",
		request: {
			body: contentJson(z.object({ label: z.string().max(60).optional() })),
		},
		responses: {
			"201": { description: "The new wallet", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const wallet = await createWallet(c.env.DB, body.label);
		return c.json({ success: true, result: wallet }, 201);
	}
}

export class WalletGet extends OpenAPIRoute {
	public schema = {
		tags: ["Wallet"],
		summary: "A wallet by owner handle or address: balance, Sui link, and history",
		request: { params: z.object({ ref: z.string().min(1) }) },
		responses: {
			"200": { description: "Wallet overview", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"404": { description: "No such wallet" },
		},
	};

	public async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const result = await walletOverview(c.env.DB, params.ref);
		if ("error" in result) return c.json({ success: false, errors: [{ code: 4041, message: result.error }] }, 404);
		return { success: true, result };
	}
}

export class WalletSend extends OpenAPIRoute {
	public schema = {
		tags: ["Wallet"],
		summary: "Send AETHER between wallets (by owner handle or address)",
		request: {
			body: contentJson(
				z.object({
					from: z.string().min(1),
					to: z.string().min(1),
					amount: z.number().positive(),
					memo: z.string().max(200).default(""),
				}),
			),
		},
		responses: {
			"200": { description: "The recorded transfer", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (unknown wallet, insufficient balance, …)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await sendAether(c.env.DB, body.from, body.to, body.amount, body.memo);
		if ("error" in result) return c.json({ success: false, errors: [{ code: 4009, message: result.error }] }, 400);
		return { success: true, result };
	}
}

export class WalletLink extends OpenAPIRoute {
	public schema = {
		tags: ["Wallet"],
		summary: "Link a self-custody Sui address to a wallet",
		request: {
			body: contentJson(z.object({ ref: z.string().min(1), suiAddress: z.string().min(1) })),
		},
		responses: {
			"200": { description: "The linked wallet", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Invalid Sui address or unknown wallet" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await linkSui(c.env.DB, body.ref, body.suiAddress);
		if ("error" in result) return c.json({ success: false, errors: [{ code: 4009, message: result.error }] }, 400);
		return { success: true, result };
	}
}
