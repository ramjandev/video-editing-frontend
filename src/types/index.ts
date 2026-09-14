export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: UserRole;
  createdAt?: string;
}

export interface AdminUser extends User {
  projectCount: number;
  assetCount: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalProjects: number;
  totalAssets: number;
  totalVersions: number;
  roleCounts: Record<UserRole, number>;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface Asset {
  _id: string;
  original_url: string;
  preview_url: string;
  thumbnail_sprite_url?: string;
  duration: number;
  type: "video" | "audio" | "image" | "text" | "export";
  content?: string;
  public_id: string;
}

export interface Keyframe {
  t: number;
  scale?: number;
  x?: number;
  y?: number;
}

export interface Effect {
  type: string;
  duration?: number;
  params?: Record<string, any>;
}

export interface Clip {
  id: string;
  assetId: string;
  asset: Asset;
  startTime: number;
  endTime: number;
  trimIn: number;
  trimOut: number;
  volume?: number;
  muted?: boolean;
  effects?: Effect[];
  keyframes?: Keyframe[];
}

export interface Track {
  id: string;
  type: "video" | "audio" | "text";
  clips: Clip[];
}

export interface SceneGraph {
  projectId: string;
  duration: number;
  fps: number;
  resolution: { w: number; h: number };
  tracks: Track[];
}

export interface Project {
  _id: string;
  title: string;
  duration: number;
  fps: number;
  thumbnail_url?: string;
  resolution: { w: number; h: number };
  latestVersion?: number;
}

export interface ClusterStats {
  totalWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  totalSegmentsRendered: number;
  workers?: Array<{
    socketId: string;
    userName: string;
    status: 'IDLE' | 'BUSY';
    cores: number;
    jobsCompleted: number;
  }>;
}
