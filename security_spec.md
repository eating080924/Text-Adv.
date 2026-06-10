# Security Specification & Threat Model (PVP World Real-Time Combat)

This specification defines the strict security boundary for real-time multiplayer PvP interactions in **文字領域傳說 (Legend of the Text Realm)**.

## 1. Data Invariants

1. **Identity Protection**: A user's player shape can ONLY be written, modified, or set by the user themselves. `request.auth.uid == playerId`.
2. **Faction Boundaries**: A player cannot modify their faction value once registered on the world map.
3. **Attack Validation**: An attack can only be written to another player's subcollection if:
    - The sender is authenticated.
    - The `attackerUid` in the payload matches `request.auth.uid`.
    - The `damage` is a positive integer, bounded by a reasonable limit (e.g., <= 10,000) to prevent overflow/one-shot exploits.
4. **Anti-DOS Rate Limits**: All written strings and ID sizes are strictly restricted to avoid database storage exhaustion.

---

## 2. The "Dirty Dozen" Payloads (Exploit Payloads)

These payloads are designed to attack the system's identity, state, and permissions. In a fully secured Firestore environment, these must result in `PERMISSION_DENIED`.

1. **Exploit 01 (Identity Theft)**: Writing to `/world_players/victim_uid` with `request.auth.uid = attacker_uid`.
2. **Exploit 02 (Infinite Stats Poisoning)**: Setting `atk` to `999999` or `hp` to `10000000`.
3. **Exploit 03 (Evasion Fraud)**: Injecting extremely high `evasion` values to become untouchable.
4. **Exploit 04 (Ghost Attacks)**: Writing to target's attacks with `attackerUid` set to another player's UID.
5. **Exploit 05 (Negative Damage Vampirism)**: Setting `damage` to `-5000` to heal the target or exploit math.
6. **Exploit 06 (Massive Payload Overflow)**: Adding huge junk strings (100KB) inside properties to cause DOS.
7. **Exploit 07 (Fake Level Escalation)**: Modifying level manually from the client to level 100.
8. **Exploit 08 (Invisible Mode Bypass)**: Setting `isInWorld` status of another player to false to kick them out of game.
9. **Exploit 09 (Allied Damage Inject)**: Forcing damage on an allied player (same faction) which should be disallowed.
10. **Exploit 10 (Time-Spoofing Stun)**: Sending highly outdated or future timestamps (`Date.now() + 1000000`) to confuse local clocks.
11. **Exploit 11 (Double Process Write)**: Writing to another player's main state instead of their `attacks` subcollection.
12. **Exploit 12 (Unauthorized Read Spraying)**: Reading other players' private attacks subcollections.

---

## 3. Test Runner Simulation

The rules in `firestore.rules` will enforce that:
- `get` on `/world_players/{playerId}` is allowed for any authenticated user.
- `write` on `/world_players/{playerId}` is only allowed if `request.auth.uid == playerId` and matches validation.
- `write` on `/world_players/{playerId}/attacks/{attackId}` is allowed if authenticated and `incoming().attackerUid == request.auth.uid`.
- `read` on `/world_players/{playerId}/attacks/{attackId}` is only allowed for the target player (`request.auth.uid == playerId`).
