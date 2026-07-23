--!strict
-- Paychecks — InMotion RP's baseline economy loop.
--
-- Place this Script in ServerScriptService next to the AetherBridge
-- ModuleScript. Every PAY_INTERVAL seconds, each player on the city server
-- earns a paycheck of AETHER through the bridge, and their leaderstats show
-- the live ledger balance. If the bridge is offline the city keeps running —
-- paychecks simply queue up as "0 this cycle" and a warning is logged once.

local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")

local AetherBridge = require(ServerScriptService:WaitForChild("AetherBridge"))

local PAY_INTERVAL = 600 -- seconds between paychecks (10 min)
local PAY_AMOUNT = 25 -- AETHER per paycheck; treasury-capped server-side

local warned = false

local function setupLeaderstats(player: Player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player

	local aether = Instance.new("IntValue")
	aether.Name = "AETHER"
	aether.Value = AetherBridge.balance(player.UserId) or 0
	aether.Parent = stats
end

local function pay(player: Player)
	local granted, balanceOrErr = AetherBridge.grant(player.UserId, player.Name, PAY_AMOUNT, "paycheck")
	if granted == nil then
		if not warned then
			warn("[InMotionRP] paycheck skipped: " .. tostring(balanceOrErr))
			warned = true
		end
		return
	end
	warned = false
	local stats = player:FindFirstChild("leaderstats")
	local aether = stats and stats:FindFirstChild("AETHER")
	if aether and aether:IsA("IntValue") and type(balanceOrErr) == "number" then
		aether.Value = math.floor(balanceOrErr)
	end
end

Players.PlayerAdded:Connect(setupLeaderstats)
for _, player in Players:GetPlayers() do
	setupLeaderstats(player)
end

task.spawn(function()
	while true do
		task.wait(PAY_INTERVAL)
		for _, player in Players:GetPlayers() do
			pay(player)
		end
	end
end)
