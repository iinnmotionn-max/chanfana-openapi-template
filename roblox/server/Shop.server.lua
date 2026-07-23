--!strict
-- Shop — sell anything in InMotion RP for AETHER.
--
-- Place this Script in ServerScriptService next to AetherBridge. Wire your
-- shop UI to the BuyItem RemoteFunction; the purchase only succeeds if the
-- ledger accepts the spend (no client-side money, nothing to exploit).
--
-- The catalog is server-authoritative: clients send an item id, never a price.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local AetherBridge = require(ServerScriptService:WaitForChild("AetherBridge"))

-- item id → price in AETHER. Edit freely; the treasury absorbs every sale.
local CATALOG: { [string]: number } = {
	["coffee"] = 2,
	["bike"] = 40,
	["car"] = 250,
	["apartment-week"] = 120,
}

local buyItem = Instance.new("RemoteFunction")
buyItem.Name = "BuyItem"
buyItem.Parent = ReplicatedStorage

-- Returns { ok = boolean, balance = number?, error = string? } to the client.
buyItem.OnServerInvoke = function(player: Player, itemId: unknown)
	if type(itemId) ~= "string" or CATALOG[itemId] == nil then
		return { ok = false, error = "unknown item" }
	end
	local price = CATALOG[itemId]
	local ok, balanceOrErr = AetherBridge.spend(player.UserId, price, "shop:" .. itemId)
	if not ok then
		return { ok = false, error = tostring(balanceOrErr) }
	end

	-- Payment confirmed on the ledger — NOW deliver the goods.
	-- (Replace this with your own give-item logic: tools, vehicles, deeds…)
	local stats = player:FindFirstChild("leaderstats")
	local aether = stats and stats:FindFirstChild("AETHER")
	if aether and aether:IsA("IntValue") and type(balanceOrErr) == "number" then
		aether.Value = math.floor(balanceOrErr)
	end
	print(("[InMotionRP] %s bought %s for %d AETHER"):format(player.Name, itemId, price))
	return { ok = true, balance = balanceOrErr }
end
