/// AETHER — the colony's AI-credit currency, as a real Sui coin.
///
/// Publishing this module mints a fixed genesis supply of 1,000,000 AETHER
/// (9 decimals) to the publisher's address (the treasury) and hands them the
/// `TreasuryCap`, which controls all future mint/burn. Transfers use Sui's
/// native `Coin<AETHER>` — no custom logic needed.
///
/// This mirrors the off-chain ledger in the Worker (src/engine/token.ts): the
/// Databank is the fast operational ledger; this is the on-chain settlement
/// layer the adapter (src/engine/sui.ts) links to once published.
module aether::aether {
    use sui::coin::{Self, TreasuryCap, Coin};
    use sui::url;

    /// One-time witness. Its name must be the module name in ALL CAPS.
    public struct AETHER has drop {}

    /// 9 decimals — the Sui convention.
    const DECIMALS: u8 = 9;
    /// 1,000,000 whole tokens * 10^9 base units = genesis supply.
    const GENESIS_SUPPLY: u64 = 1_000_000_000_000_000;

    /// Runs once, at publish. Creates the currency, mints the genesis supply to
    /// the publisher (treasury), freezes the metadata, and keeps the
    /// `TreasuryCap` with the publisher for governed mint/burn.
    fun init(witness: AETHER, ctx: &mut TxContext) {
        let (mut treasury, metadata) = coin::create_currency(
            witness,
            DECIMALS,
            b"AETHER",
            b"Aether",
            b"The Lumi colony's AI-credit currency.",
            option::some(url::new_unsafe_from_bytes(b"https://openapi-template.templates.workers.dev/")),
            ctx,
        );

        let genesis = coin::mint(&mut treasury, GENESIS_SUPPLY, ctx);
        transfer::public_transfer(genesis, ctx.sender());
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, ctx.sender());
    }

    /// Mint new AETHER to a recipient. Requires the TreasuryCap (treasury only).
    public entry fun mint(cap: &mut TreasuryCap<AETHER>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let minted = coin::mint(cap, amount, ctx);
        transfer::public_transfer(minted, recipient);
    }

    /// Burn AETHER back to the reserve. Requires the TreasuryCap.
    public entry fun burn(cap: &mut TreasuryCap<AETHER>, coin: Coin<AETHER>) {
        coin::burn(cap, coin);
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(AETHER {}, ctx);
    }
}
