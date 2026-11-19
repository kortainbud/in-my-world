import type { CharacterRecord } from "@/lib/engine/characters";
import type { PlanId } from "@/config/plans";
import type { Category } from "@/config/site";
import type {
  ChecklistItem,
  StoryFormat,
  CharacterSpec,
  DurationPreset,
  StageState,
  StoryPlan,
  Timeline,
  VisualStyle,
} from "@/lib/engine/types";

export interface User {
  id: string;
  email: string | null;
  passwordHash: string | null;
  createdAt: string;
}

export interface Profile {
  userId: string;
  displayName: string;
  handle: string;
  createdAt: string;
}

export interface Session {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface Subscription {
  userId: string;
  planId: PlanId;
  status: "active" | "canceled" | "past_due";
  provider: "none" | string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export type CreditKind =
  | "grant_signup"
  | "grant_monthly"
  | "purchase"
  | "debit_generation"
  | "refund_generation"
  | "dev_grant";

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  kind: CreditKind;
  jobId?: string;
  paymentId?: string;
  note: string;
  createdAt: string;
}

export type ProjectStatus = "queued" | "processing" | "awaiting_render" | "rendering" | "completed" | "failed";

export interface Project {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  style: VisualStyle;
  durationPreset: DurationPreset;
  aspect: "9:16";
  mode: "auto";
  voice: string | null;
  castIds: string[];
  category: Category;
  visibility: "private" | "public";
  status: ProjectStatus;
  jobId: string;
  storyId?: string;
  videoId?: string;
  parentProjectId?: string;
  /** Storytelling format (A: strange world, B: mystery series, C: impossible choice). */
  format?: StoryFormat;
  /** Episodes of one series share a seriesId; episode 1's project id. */
  seriesId?: string;
  episode?: number;
  /** Previous episode this one continues. */
  previousProjectId?: string;
  views: number;
  shares?: number;
  createdAt: string;
  updatedAt: string;
}

/** Per-viewer playback summary used for retention metrics. */
export interface ViewerStat {
  /** Project id, or sample id. */
  targetId: string;
  viewer: string;
  plays: number;
  /** Total seconds watched across plays. */
  watched: number;
  /** Furthest point reached, in seconds. */
  furthest: number;
  completed: boolean;
  reached3s: boolean;
  firstAt: string;
  lastAt: string;
}

export interface Story {
  id: string;
  projectId: string;
  source: "anthropic" | "dev-template";
  model?: string;
  plan: StoryPlan;
  /** Resolved cast after the characters stage. */
  cast?: CharacterSpec[];
  refs?: Record<string, string>;
  /** Generated (non-library) characters, saveable to the user's library. */
  generatedCharacterIds?: string[];
  timeline?: Timeline;
  /** Editorial checklist results. */
  checklist?: ChecklistItem[];
  checklistSource?: "editor" | "structure";
  revised?: boolean;
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  projectId: string;
  userId: string;
  status: ProjectStatus;
  stages: StageState[];
  attempts: number;
  maxAttempts: number;
  error?: string;
  creditCost: number;
  idempotencyKey?: string;
  exportHeight: 720 | 1080;
  watermark: boolean;
  engine: { story: string; voice: string; render: string };
  renderLease?: { agentId: string; expiresAt: string };
  renderProgress?: { phase: string; framesDone: number; framesTotal: number; updatedAt: string };
  previews: { scene: number; mediaKey: string }[];
  refunded: boolean;
  /** Narration audio produced by the voice stage, per scene. */
  audio?: { scene: number; narration?: { mediaKey: string; duration: number }; dialogue?: { mediaKey: string; duration: number } }[];
  /** Narration recorded by the render agent's browser (Kokoro) before rendering. */
  browserVoice?: { narrator: string; recorded: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface Video {
  id: string;
  projectId: string;
  mediaKey: string;
  thumbKey: string;
  width: number;
  height: number;
  durationSec: number;
  sizeBytes: number;
  videoCodec: string;
  audioCodec: string;
  engine: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  provider: "stripe" | "solana";
  kind: "subscription" | "credits";
  itemId: string;
  status: "pending" | "succeeded" | "failed" | "expired";
  amountCents: number;
  currency: string;
  credits: number;
  /** Stripe checkout session id, or the Solana transaction signature once paid. */
  providerRef?: string;
  /** Solana: token, amount in base units, recipient, unique reference key, quote expiry. */
  crypto?: { token: "USDC" | "SOL"; amount: string; decimals: number; mint?: string; receiver: string; reference: string; cluster: string; expiresAt: string; usdRate?: number };
  fulfilledAt?: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  chain: "solana" | "evm";
  address: string;
  /** Wallets are linked for identity / sign-in only. Paying with crypto is a separate payment provider. */
  purpose: "identity";
  linkedAt: string;
}

export interface WalletNonce {
  nonce: string;
  chain: "solana" | "evm";
  address: string;
  purpose: "link" | "signin";
  userId?: string;
  message: string;
  expiresAt: string;
}

export interface DB {
  version: 1;
  users: User[];
  profiles: Profile[];
  sessions: Session[];
  subscriptions: Subscription[];
  credits: CreditTransaction[];
  projects: Project[];
  stories: Story[];
  jobs: GenerationJob[];
  videos: Video[];
  characters: CharacterRecord[];
  payments: Payment[];
  wallets: Wallet[];
  walletNonces: WalletNonce[];
  viewerStats: ViewerStat[];
  /** View counters for static sample videos (keyed by sample id). */
  sampleViews: Record<string, number>;
}

export function emptyDB(): DB {
  return {
    version: 1,
    users: [],
    profiles: [],
    sessions: [],
    subscriptions: [],
    credits: [],
    projects: [],
    stories: [],
    jobs: [],
    videos: [],
    characters: [],
    payments: [],
    wallets: [],
    walletNonces: [],
    sampleViews: {},
    viewerStats: [],
  };
}

export interface PasswordReset {
  userId: string;
  createdAt: string;
  expiresAt: string;
}
