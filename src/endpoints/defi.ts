// The DeFi realm endpoints: the AETHER liquidity layer — a Cetus-style AMM
// pool, yield vaults, and lending — all backed by the real token ledger. Every
// AETHER movement flows through transfer()/reward(), so the fixed genesis
// supply is conserved and the Guardian sweep stays green.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { requireCreator } from "../engine/creator";
import {
	addLiquidity,
	borrow,
	defiOverview,
	removeLiquidity,
	repay,
	swap,
	vaultDeposit,
	vaultWithdraw,
} from "../engine/defi";

// Shared 400 helper for engine {error} results.
function fail(c: AppContext, message: string) {
	return c.json({ success: false, errors: [{ code: 4009, message }] }, 400);
}

export class DefiOverview extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "DeFi overview: pools (price/APR), vaults, loans, TVL, recent events",
		responses: {
			"200": { description: "DeFi overview", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await defiOverview(c.env.DB) };
	}
}

export class DefiAddLiquidity extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "Add liquidity to the AETHER/SUI pool and mint LP tokens",
		request: {
			body: contentJson(
				z.object({
					owner: z.string().min(1),
					aether: z.number().positive(),
					quote: z.number().positive(),
				}),
			),
		},
		responses: {
			"200": { description: "LP minted and pool state", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (insufficient balance, unknown account, …)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await addLiquidity(c.env.DB, body.owner, body.aether, body.quote);
		if ("error" in result) return fail(c, result.error);
		return { success: true, result };
	}
}

export class DefiRemoveLiquidity extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "Burn LP tokens and withdraw the pro-rata AETHER and quote",
		request: {
			body: contentJson(
				z.object({
					owner: z.string().min(1),
					lp: z.number().positive(),
				}),
			),
		},
		responses: {
			"200": { description: "AETHER and quote returned", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (no liquidity, insufficient position, …)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await removeLiquidity(c.env.DB, body.owner, body.lp);
		if ("error" in result) return fail(c, result.error);
		return { success: true, result };
	}
}

export class DefiSwap extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "Swap on the AETHER/SUI pool (constant product, x*y=k with fee)",
		request: {
			body: contentJson(
				z.object({
					owner: z.string().min(1),
					direction: z.enum(["aether_in", "quote_in"]),
					amountIn: z.number().positive(),
				}),
			),
		},
		responses: {
			"200": { description: "Amount out and price after", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (no liquidity, insufficient balance, …)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await swap(c.env.DB, body.owner, body.direction, body.amountIn);
		if ("error" in result) return fail(c, result.error);
		return { success: true, result };
	}
}

export class DefiVaultDeposit extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "Deposit AETHER into a yield vault",
		request: {
			body: contentJson(
				z.object({
					owner: z.string().min(1),
					amount: z.number().positive(),
				}),
			),
		},
		responses: {
			"200": { description: "Vault deposit result", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (insufficient balance, unknown account, …)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await vaultDeposit(c.env.DB, body.owner, body.amount);
		if ("error" in result) return fail(c, result.error);
		return { success: true, result };
	}
}

export class DefiVaultWithdraw extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "Withdraw vault principal plus treasury-paid yield",
		request: {
			body: contentJson(
				z.object({
					owner: z.string().min(1),
					amount: z.number().positive(),
				}),
			),
		},
		responses: {
			"200": { description: "Withdrawn amount and yield", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (insufficient vault principal, …)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await vaultWithdraw(c.env.DB, body.owner, body.amount);
		if ("error" in result) return fail(c, result.error);
		return { success: true, result };
	}
}

export class DefiBorrow extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "Borrow (synthetic) quote against locked AETHER collateral at 50% LTV",
		request: {
			body: contentJson(
				z.object({
					owner: z.string().min(1),
					collateral: z.number().positive(),
					borrow: z.number().positive(),
				}),
			),
		},
		responses: {
			"200": { description: "Loan opened", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (exceeds 50% LTV, insufficient balance, …)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await borrow(c.env.DB, body.owner, body.collateral, body.borrow);
		if ("error" in result) return fail(c, result.error);
		return { success: true, result };
	}
}

export class DefiRepay extends OpenAPIRoute {
	public schema = {
		tags: ["DeFi"],
		summary: "Repay a loan and unlock the AETHER collateral",
		request: {
			body: contentJson(
				z.object({
					loanId: z.number().int().positive(),
				}),
			),
		},
		responses: {
			"200": { description: "Collateral returned", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (no open loan)" },
		},
	};

	public async handle(c: AppContext) {
		const denied = requireCreator(c);
		if (denied) return denied;

		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await repay(c.env.DB, body.loanId);
		if ("error" in result) return fail(c, result.error);
		return { success: true, result };
	}
}
