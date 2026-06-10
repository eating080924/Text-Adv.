import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  addDoc 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Player, Faction } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let app: any = null;
export let db: any = null;
export let auth: any = null;
export let isFirebaseAvailable = false;

// Initialize Firebase only if we have non-empty credentials
if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
    auth = getAuth(app);
    isFirebaseAvailable = true;
    console.log("Firebase initialized successfully for real-time PvP!");
    
    // Auto-sign in anonymously if firebase is ready & we aren't signed in yet
    signInAnonymously(auth).catch((err: any) => {
      console.warn("Firebase Anonymous sign-in failed:", err);
    });
  } catch (error) {
    console.warn("Firebase initialization encountered an error:", error);
    isFirebaseAvailable = false;
  }
} else {
  console.log("Firebase credentials are not set up. Falling back to local Express state-sync container.");
}

// REST endpoints for local Express sync
const API_URL = ""; // Relative to the host

export interface RemotePlayer {
  id: string;
  name: string;
  class: string;
  faction: Faction;
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

export interface AttackMessage {
  attackerUid: string;
  attackerName: string;
  damage: number;
  timestamp: number;
}

/**
 * Sends a heartbeat to register/update player presence and retrieves other online players
 */
export async function syncHeartbeat(
  player: Player & { charName?: string },
  callback: (players: RemotePlayer[]) => void
): Promise<void> {
  if (isFirebaseAvailable && db) {
    // ----------------------------------------------------
    // TYPE A: FIREBASE SOURCE OF TRUTH
    // ----------------------------------------------------
    const uid = player.id;
    const playerDocRef = doc(db, 'world_players', uid);
    
    const payload = {
      id: uid,
      name: player.charName || player.id || "冒險者",
      class: player.class,
      faction: player.faction,
      level: player.level,
      hp: Math.max(0, player.hp),
      maxHp: player.maxHp,
      mp: Math.max(0, player.mp),
      maxMp: player.maxMp,
      atk: player.meleeAtk || 10,
      def: player.physDef || 5,
      pvpKills: player.pvpKills || 0,
      pvpDeaths: player.pvpDeaths || 0,
      isInWorld: !!player.isInWorld,
      lastActive: Date.now(),
    };

    try {
      if (player.isInWorld) {
        await setDoc(playerDocRef, payload, { merge: true });
      } else {
        await setDoc(playerDocRef, { ...payload, isInWorld: false }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `world_players/${uid}`);
    }
  } else {
    // ----------------------------------------------------
    // TYPE B: EXPRESS SERVER SOURCE OF TRUTH
    // ----------------------------------------------------
    try {
      const response = await fetch(`${API_URL}/api/pvp/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player }),
      });
      const data = await response.json();
      if (data && data.success && Array.isArray(data.players)) {
        callback(data.players);
      }
    } catch (err) {
      console.warn("Express server heartbeat failed:", err);
    }
  }
}

/**
 * Starts a real-time listener on active world players
 */
export function listenToActivePlayers(
  myId: string,
  onUpdate: (players: RemotePlayer[]) => void
): () => void {
  if (isFirebaseAvailable && db) {
    // Listen to world_players with Firestore subscription
    const playersColRef = collection(db, 'world_players');
    return onSnapshot(playersColRef, (snapshot) => {
      const now = Date.now();
      const updatedList: RemotePlayer[] = [];
      snapshot.forEach((pDoc) => {
        const u = pDoc.data() as RemotePlayer;
        // Exclude self and verify player is recently active on world map
        if (u.id !== myId && u.isInWorld && (now - u.lastActive < 12000)) {
          updatedList.push(u);
        }
      });
      onUpdate(updatedList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'world_players');
    });
  } else {
    // Fallback polling loop for Express
    const fetchPlayers = async () => {
      try {
        const response = await fetch(`${API_URL}/api/pvp/players/${myId}`);
        const data = await response.json();
        if (data && data.success && Array.isArray(data.players)) {
          onUpdate(data.players);
        }
      } catch (err) {
        console.warn("Express fetch active players poll failed:", err);
      }
    };

    fetchPlayers();
    const interval = setInterval(fetchPlayers, 2000);
    return () => clearInterval(interval);
  }
}

/**
 * Submits an attack onto a target candidate
 */
export async function sendAttack(
  targetId: string,
  attackerUid: string,
  attackerName: string,
  damage: number
): Promise<void> {
  const attackObj = {
    attackerUid,
    attackerName,
    damage,
    timestamp: Date.now(),
  };

  if (isFirebaseAvailable && db) {
    try {
      const attacksColRef = collection(db, 'world_players', targetId, 'attacks');
      await addDoc(attacksColRef, attackObj);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `world_players/${targetId}/attacks`);
    }
  } else {
    try {
      await fetch(`${API_URL}/api/pvp/attack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, attack: attackObj }),
      });
    } catch (err) {
      console.warn("Express sendAttack failed:", err);
    }
  }
}

/**
 * Listens to incoming attacks aimed at this player
 */
export function listenToIncomingAttacks(
  myId: string,
  onAttackReceived: (attack: AttackMessage) => void
): () => void {
  if (isFirebaseAvailable && db) {
    const attacksColRef = collection(db, 'world_players', myId, 'attacks');
    return onSnapshot(attacksColRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const attack = change.doc.data() as AttackMessage;
          onAttackReceived(attack);
          // Auto-delete the received attack immediately to act as a FIFO message mailbox
          try {
            await deleteDoc(change.doc.ref);
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, `world_players/${myId}/attacks/${change.doc.id}`);
          }
        }
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `world_players/${myId}/attacks`);
    });
  } else {
    // Fallback regular poll on Express server
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/pvp/attacks/${myId}`);
        const data = await response.json();
        if (data && data.success && Array.isArray(data.attacks)) {
          data.attacks.forEach((attack: AttackMessage) => {
            onAttackReceived(attack);
          });
        }
      } catch (err) {
        console.warn("Express fetch attacks poll failed:", err);
      }
    }, 1000);
    return () => clearInterval(interval);
  }
}
