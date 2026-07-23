--!strict
-- AetherBridge — InMotion RP's server-side link to the Lumi AETHER economy.
--
-- Place this ModuleScript in ServerScriptService (server-only: never in
-- ReplicatedStorage, or clients could read the endpoint). The shared secret
-- must NOT live in this file — put it in a StringValue at
-- ServerStorage.RP_SHARED_SECRET so it stays out of published source.
--
-- Requires: Game Settings → Security → "Allow HTTP Requests" = ON.
--
-- Grants go through the Worker's POST /rp/grant, which moves AETHER
-- treasury → player on the conserved ledger. The game asks; it can never mint.

local HttpService = game:GetService("HttpService")
local ServerStorage = game:GetService("ServerStorage")

local AetherBridge = {}

-- Your deployed Worker URL (no trailing slash), e.g. "https://lumi.<you>.workers.dev"
AetherBridge.BaseUrl = "https://YOUR-WORKER.workers.dev"

local function sharedSecret(): string
	local v = ServerStorage:FindFirstChild("RP_SHARED_SECRET")
	if v and v:IsA("StringValue") then
		return v.Value
	end
	return ""
end

-- Credit AETHER to a player for in-city work. Returns (granted, balance) or
-- (nil, errorMessage). Never throws; a city that can't reach the bridge keeps
-- running and pays nothing rather than pretending.
function AetherBridge.grant(userId: number, name: string, amount: number, reason: string): (number?, string | number)
	local secret = sharedSecret()
	if secret == "" then
		return nil, "RP_SHARED_SECRET StringValue missing in ServerStorage — bridge off"
	end
	local ok, response = pcall(function()
		return HttpService:PostAsync(
			AetherBridge.BaseUrl .. "/rp/grant",
			HttpService:JSONEncode({
				userId = userId,
				name = name,
				amount = amount,
				reason = reason,
				secret = secret,
			}),
			Enum.HttpContentType.ApplicationJson
		)
	end)
	if not ok then
		return nil, tostring(response)
	end
	local decoded = HttpService:JSONDecode(response)
	if not decoded.success then
		return nil, "grant rejected"
	end
	return decoded.result.granted, decoded.result.balance
end

-- Read a player's AETHER balance (for leaderstats / ATM UIs). Returns balance
-- or nil if the player has no wallet yet (they get one on first grant).
function AetherBridge.balance(userId: number): number?
	local ok, response = pcall(function()
		return HttpService:GetAsync(AetherBridge.BaseUrl .. "/rp/player/" .. tostring(userId))
	end)
	if not ok then
		return nil
	end
	local decoded = HttpService:JSONDecode(response)
	if decoded.success then
		return decoded.result.balance
	end
	return nil
end

return AetherBridge
