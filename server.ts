import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface ActivePlayer {
  id: string;
  name: string;
  class: string;
  faction: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  pvpKills: number;
  pvpDeaths: number;
  isInWorld: boolean;
  lastActive: number;
}

interface AttackEvent {
  attackerUid: string;
  attackerName: string;
  damage: number;
  timestamp: number;
}

const activePlayers = new Map<string, ActivePlayer>();
const attackMailbox = new Map<string, AttackEvent[]>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS headers for local/cross iframe calls
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API: PVP System Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activePlayersCount: activePlayers.size });
  });

  // API: Player heartbeat and sync state
  app.post("/api/pvp/heartbeat", (req, res) => {
    try {
      const { player } = req.body;
      if (!player || !player.id) {
        return res.status(400).json({ error: "Missing player info" });
      }

      // Add/Update player in server memory
      const pData: ActivePlayer = {
        id: player.id,
        name: player.charName || player.name || player.id || "冒險者",
        class: player.class,
        faction: player.faction,
        level: player.level || 1,
        hp: Math.max(0, player.hp),
        maxHp: player.maxHp || 100,
        mp: Math.max(0, player.mp),
        maxMp: player.maxMp || 100,
        atk: player.meleeAtk || 10,
        def: player.physDef || 5,
        pvpKills: player.pvpKills || 0,
        pvpDeaths: player.pvpDeaths || 0,
        isInWorld: !!player.isInWorld,
        lastActive: Date.now(),
      };

      if (pData.isInWorld) {
        activePlayers.set(pData.id, pData);
      } else {
        activePlayers.delete(pData.id);
      }

      // Evict stale players (inactive for more than 10 seconds)
      const now = Date.now();
      for (const [id, value] of activePlayers.entries()) {
        if (now - value.lastActive > 10000) {
          activePlayers.delete(id);
          attackMailbox.delete(id);
        }
      }

      // Return list of all other players active in the world
      const otherPlayersInWorld = Array.from(activePlayers.values())
        .filter((p) => p.id !== player.id && p.isInWorld);

      res.json({
        success: true,
        players: otherPlayersInWorld,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Retrieve all other active players in world
  app.get("/api/pvp/players/:myId", (req, res) => {
    try {
      const { myId } = req.params;
      const now = Date.now();

      // Evict stale players
      for (const [id, value] of activePlayers.entries()) {
        if (now - value.lastActive > 10000) {
          activePlayers.delete(id);
          attackMailbox.delete(id);
        }
      }

      const otherPlayersInWorld = Array.from(activePlayers.values())
        .filter((p) => p.id !== myId && p.isInWorld);

      res.json({
        success: true,
        players: otherPlayersInWorld,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Attack target
  app.post("/api/pvp/attack", (req, res) => {
    try {
      const { targetId, attack } = req.body;
      if (!targetId || !attack || !attack.attackerUid) {
        return res.status(400).json({ error: "Missing parameter" });
      }

      // Put the attack into the target's mailbox
      const mbox = attackMailbox.get(targetId) || [];
      mbox.push({
        attackerUid: attack.attackerUid,
        attackerName: attack.attackerName || "神祕玩家",
        damage: Number(attack.damage) || 0,
        timestamp: Date.now(),
      });
      attackMailbox.set(targetId, mbox);

      // Also verify if target is loaded in memory and deduct their hp locally on server to make it dual-authoritative
      const targetPlayer = activePlayers.get(targetId);
      if (targetPlayer) {
        targetPlayer.hp = Math.max(0, targetPlayer.hp - (Number(attack.damage) || 0));
        activePlayers.set(targetId, targetPlayer);
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Read and retrieve incoming attack events
  app.get("/api/pvp/attacks/:playerId", (req, res) => {
    try {
      const { playerId } = req.params;
      const mbox = attackMailbox.get(playerId) || [];
      
      // Flush mailbox
      attackMailbox.set(playerId, []);

      res.json({
        success: true,
        attacks: mbox,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API: Manual reset (useful on restart)
  app.post("/api/pvp/reset", (req, res) => {
    activePlayers.clear();
    attackMailbox.clear();
    res.json({ success: true, message: "PVP room reset" });
  });

  // Vite Integration for Development vs Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`PVP matchmaking running in-memory.`);
  });
}

startServer();
