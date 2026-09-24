import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setWorkerEnabled } from '@/store/workerSlice';
import { Cpu, Zap, Activity, ChevronDown, CheckCircle2, Clock } from 'lucide-react';

export function WorkerStatus() {
  const dispatch = useAppDispatch();
  const {
    isWorkerEnabled,
    connectionStatus,
    nodeState,
    activityScore,
    idleSeconds,
    currentTask,
    segmentsCompleted,
    clusterStats,
    logMessages,
  } = useAppSelector((state) => state.worker);

  const [isOpen, setIsOpen] = useState(false);

  const isRendering = connectionStatus === 'RENDERING';
  const isIdle = nodeState === 'IDLE';
  const isCandidate = nodeState === 'IDLE_CANDIDATE';
  const isPreempted = connectionStatus === 'PREEMPTED' || connectionStatus === 'PAUSED';

  return (
    <div className="relative">
      {/* Telemetry Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border transition-all cursor-pointer ${
          isRendering
            ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 animate-pulse'
            : isPreempted
            ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
            : isIdle && isWorkerEnabled
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            : isCandidate && isWorkerEnabled
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
            : isWorkerEnabled
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
        }`}
        title="Distributed Rendering Cluster Telemetry & Local Activity State"
      >
        <span className="relative flex h-2 w-2">
          {isWorkerEnabled && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isRendering
                  ? 'bg-purple-400'
                  : isIdle
                  ? 'bg-emerald-400'
                  : isCandidate
                  ? 'bg-amber-400'
                  : 'bg-blue-400'
              }`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isRendering
                ? 'bg-purple-500'
                : isPreempted
                ? 'bg-orange-500'
                : isIdle
                ? 'bg-emerald-500'
                : isCandidate
                ? 'bg-amber-500'
                : isWorkerEnabled
                ? 'bg-blue-500'
                : 'bg-slate-500'
            }`}
          />
        </span>

        <Zap className="w-3.5 h-3.5" />
        <span className="font-medium hidden sm:inline">
          {isRendering
            ? `Rendering (${currentTask?.percent || 0}%)`
            : isPreempted
            ? 'Preempted (Paused)'
            : isWorkerEnabled
            ? `PC: ${nodeState} (${activityScore}/100)`
            : 'Worker Disabled'}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Popover Details Modal */}
      {isOpen && (
        <div className="absolute right-0 top-9 w-88 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl shadow-2xl p-4 z-50 text-slate-800 dark:text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Cpu className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span>Idle-PC Render Node</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-mono">
              Preemptive v1.0
            </span>
          </div>

          {/* Local State & Activity Scoring Card */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Local Node State:</span>
              <span className="font-bold font-mono">
                {isRendering ? (
                  <span className="text-purple-400">RENDERING</span>
                ) : isPreempted ? (
                  <span className="text-orange-400">PREEMPTED</span>
                ) : isIdle ? (
                  <span className="text-emerald-500">IDLE (Ready for work)</span>
                ) : isCandidate ? (
                  <span className="text-amber-500">IDLE_CANDIDATE</span>
                ) : (
                  <span className="text-blue-500">ACTIVE (User at PC)</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">Activity Score:</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      activityScore >= 40
                        ? 'bg-blue-500'
                        : activityScore >= 20
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, activityScore))}%` }}
                  />
                </div>
                <span className="font-mono font-bold">{activityScore}/100</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">Inactivity Counter:</span>
              <span className="font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {idleSeconds}s {idleSeconds >= 60 ? '(≥ 60s idle threshold reached)' : `(${60 - idleSeconds}s until IDLE)`}
              </span>
            </div>
          </div>

          {/* Toggle worker participation */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 mb-3">
            <div>
              <div className="font-medium text-slate-900 dark:text-white">Contribute Idle CPU</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Yields immediately when active (0ms lag)</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isWorkerEnabled}
                onChange={(e) => dispatch(setWorkerEnabled(e.target.checked))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Cluster Telemetry */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/40">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Cluster Fleet</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {Math.max(1, clusterStats.totalWorkers)} Nodes
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/40">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Rendered Segments</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {segmentsCompleted}
              </div>
            </div>
          </div>

          {/* Active Job status if rendering */}
          {currentTask && (
            <div className="bg-purple-500/10 border border-purple-500/30 p-2.5 rounded-lg mb-3">
              <div className="flex justify-between text-[11px] text-purple-700 dark:text-purple-300 mb-1 font-medium">
                <span>Rendering Segment #{currentTask.segmentIndex}</span>
                <span>{currentTask.percent}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-500 dark:bg-purple-400 h-full transition-all duration-200"
                  style={{ width: `${currentTask.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Local logs */}
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Local Node Activity Feed
            </div>
            <div className="bg-slate-100 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400 h-24 overflow-y-auto space-y-1">
              {logMessages.length > 0 ? (
                logMessages.map((msg, idx) => (
                  <div key={idx} className="truncate">
                    {msg}
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-center py-4">Waiting for cluster events...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkerStatus;
