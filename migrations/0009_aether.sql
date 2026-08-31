-- Migration number: 0009 	 2026-07-07T05:00:00.000Z
-- AETHER: a second core intelligence — the markets scholar — with a full DNA
-- profile ("swab"). Because bots inherit the merged DNA of every active agent,
-- Aether's traits now flow into every new bot the colony breeds.

INSERT INTO agents (name, role, dna) VALUES
    ('aether', 'markets-scholar', '{"curiosity":0.95,"discipline":0.9,"patience":0.7,"risk":0.35,"rigor":0.9}');

-- Training quest: Lumi and Aether study the trading curriculum.
INSERT INTO quests (title, detail, skill, xp_reward, metric, target) VALUES
    ('Study hall', 'Study three lessons from the trading curriculum.', 'insight', 120, 'lessons', 3);
