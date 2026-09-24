import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ClusterStats, NodeState } from '@/types';

export interface RenderTask {
  jobId: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  duration: number;
  percent: number;
  status: 'rendering' | 'encoding' | 'uploading' | 'completed' | 'failed' | 'paused';
}

export interface WorkerState {
  isWorkerEnabled: boolean;
  connectionStatus:
    | 'DISCONNECTED'
    | 'CONNECTING'
    | 'ACTIVE'
    | 'IDLE_CANDIDATE'
    | 'IDLE'
    | 'RENDERING'
    | 'PREEMPTED'
    | 'PAUSED'
    | 'OFFLINE';
  nodeState: NodeState;
  activityScore: number;
  idleSeconds: number;
  currentTask: RenderTask | null;
  segmentsCompleted: number;
  clusterStats: ClusterStats;
  logMessages: string[];
}

const initialEnabled = typeof window !== 'undefined' ? localStorage.getItem('worker_opt_in') !== 'false' : true;
const initialCompleted = typeof window !== 'undefined' ? parseInt(localStorage.getItem('worker_completed_count') || '0', 10) : 0;

const initialState: WorkerState = {
  isWorkerEnabled: initialEnabled,
  connectionStatus: 'DISCONNECTED',
  nodeState: 'ACTIVE',
  activityScore: 50,
  idleSeconds: 0,
  currentTask: null,
  segmentsCompleted: initialCompleted,
  clusterStats: {
    totalWorkers: 0,
    idleWorkers: 0,
    busyWorkers: 0,
    totalSegmentsRendered: 0,
  },
  logMessages: [],
};

const workerSlice = createSlice({
  name: 'worker',
  initialState,
  reducers: {
    setWorkerEnabled(state, action: PayloadAction<boolean>) {
      state.isWorkerEnabled = action.payload;
      localStorage.setItem('worker_opt_in', String(action.payload));
      if (!action.payload) {
        state.connectionStatus = 'DISCONNECTED';
        state.currentTask = null;
      }
    },
    setConnectionStatus(state, action: PayloadAction<WorkerState['connectionStatus']>) {
      state.connectionStatus = action.payload;
    },
    setNodeTelemetry(
      state,
      action: PayloadAction<{ nodeState: NodeState; activityScore: number; idleSeconds: number }>,
    ) {
      state.nodeState = action.payload.nodeState;
      state.activityScore = action.payload.activityScore;
      state.idleSeconds = action.payload.idleSeconds;
      if (state.connectionStatus !== 'RENDERING' && state.connectionStatus !== 'DISCONNECTED' && state.connectionStatus !== 'CONNECTING') {
        state.connectionStatus = action.payload.nodeState as any;
      }
    },
    setCurrentTask(state, action: PayloadAction<RenderTask | null>) {
      state.currentTask = action.payload;
    },
    updateTaskProgress(state, action: PayloadAction<{ percent: number; status?: RenderTask['status'] }>) {
      if (state.currentTask) {
        state.currentTask.percent = action.payload.percent;
        if (action.payload.status) {
          state.currentTask.status = action.payload.status;
        }
      }
    },
    completeCurrentTask(state) {
      state.segmentsCompleted += 1;
      localStorage.setItem('worker_completed_count', String(state.segmentsCompleted));
      state.currentTask = null;
      state.connectionStatus = 'IDLE';
    },
    setClusterStats(state, action: PayloadAction<ClusterStats>) {
      state.clusterStats = action.payload;
    },
    addWorkerLog(state, action: PayloadAction<string>) {
      state.logMessages.unshift(`[${new Date().toLocaleTimeString()}] ${action.payload}`);
      if (state.logMessages.length > 25) {
        state.logMessages.pop();
      }
    },
  },
});

export const {
  setWorkerEnabled,
  setConnectionStatus,
  setNodeTelemetry,
  setCurrentTask,
  updateTaskProgress,
  completeCurrentTask,
  setClusterStats,
  addWorkerLog,
} = workerSlice.actions;

export default workerSlice.reducer;
