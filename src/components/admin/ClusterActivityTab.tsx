import React, { useState, useEffect, useRef } from 'react';
import { api, WS_URL } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import type { ClusterStats, ClusterLogEntry, NodeState } from '@/types';
import { io, Socket } from 'socket.io-client';
import {
  Cpu,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
  Terminal,
  Server,
  PauseCircle,
  Search,
} from 'lucide-react';

export const ClusterActivityTab: React.FC = () => {
  const currentUser = useAppSelector((s) => s.auth.user);
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [logs, setLogs] = useState<ClusterLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const logTerminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [nodesRes, logsRes] = await Promise.all([
        api.get<ClusterStats>('/admin/rendering/nodes'),
        api.get<{ total: number; logs: ClusterLogEntry[] }>('/admin/rendering/logs'),
      ]);
      setStats(nodesRes.data);
      setLogs(logsRes.data.logs || []);
    } catch (err) {
      console.error('Failed to load admin cluster data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();

    // Connect to WebSocket for real-time live log stream
    const socket = io(`${WS_URL}/rendering-ws`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('admin:subscribe');
    });

    socket.on('admin:initial_telemetry', (data: { stats: ClusterStats; logs: ClusterLogEntry[] }) => {
      setStats(data.stats);
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs);
      }
    });

    socket.on('admin:stats_update', (newStats: ClusterStats) => {
      setStats(newStats);
    });

    socket.on('admin:cluster_log', (newLog: ClusterLogEntry) => {
      setLogs((prev) => [newLog, ...prev.slice(0, 200)]);
    });

    const interval = setInterval(fetchData, 8000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.emit('admin:unsubscribe');
        socket.disconnect();
      }
    };
  }, [isAdmin]);

  // Auto-scroll log console
  useEffect(() => {
    if (autoScroll && logTerminalRef.current) {
      logTerminalRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const handleClearLogs = async () => {
    try {
      await api.post('/admin/rendering/clear-logs');
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Restricted Access</h3>
        <p className="text-sm">Only system administrators can inspect cluster node activity and logs.</p>
      </div>
    );
  }

  const getStateBadge = (state: NodeState) => {
    switch (state) {
      case 'IDLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            IDLE (Ready)
          </span>
        );
      case 'IDLE_CANDIDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            IDLE_CANDIDATE
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            ACTIVE (User at PC)
          </span>
        );
      case 'RENDERING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            RENDERING
          </span>
        );
      case 'PREEMPTED':
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <PauseCircle className="w-3 h-3 text-orange-400" />
            PREEMPTED (Paused)
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            OFFLINE
          </span>
        );
    }
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'warn':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'error':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'info':
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'ALL') {
      if (filterType === 'STATE_CHANGE' && log.eventType !== 'STATE_CHANGE') return false;
      if (filterType === 'PREEMPTED' && log.eventType !== 'PREEMPTED') return false;
      if (
        filterType === 'JOB_LIFECYCLE' &&
        !['JOB_ASSIGNED', 'JOB_PROGRESS', 'JOB_COMPLETED', 'JOB_FAILED'].includes(log.eventType)
      ) {
        return false;
      }
      if (filterType === 'NODE_TIMEOUT' && log.eventType !== 'NODE_TIMEOUT') return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.workerId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-140px)]">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              Idle-PC Distributed Render Cluster
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Telemetry
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Admin Real-Time Monitoring: Node Inactivity, Activity Scores, Instant Preemption & Event Logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold border border-slate-700 text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Cluster Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Nodes</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats?.totalWorkers || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-950/60 shadow-sm">
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Idle Ready</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats?.idleWorkers || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200 dark:border-amber-950/60 shadow-sm">
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Candidates (30-59s)</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats?.candidateWorkers || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-blue-200 dark:border-blue-950/60 shadow-sm">
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Active Users</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {stats?.activeWorkers || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-purple-200 dark:border-purple-950/60 shadow-sm">
          <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">Rendering Now</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {stats?.busyWorkers || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-orange-200 dark:border-orange-950/60 shadow-sm">
          <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">Preempted / Paused</span>
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">
            {stats?.preemptedWorkers || 0}
          </div>
        </div>
      </div>

      {/* Connected Nodes Fleet Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
            <Cpu className="w-4 h-4 text-blue-500" />
            Active Worker Node Fleet
          </div>
          <span className="text-xs text-slate-500">
            Heartbeat timeout window: 15s • Inactivity threshold: 60s
          </span>
        </div>

        {(!stats?.workers || stats.workers.length === 0) ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No worker nodes connected currently. Open the application in another browser tab to simulate an idle node.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Node / Contributor</th>
                  <th className="px-4 py-3 font-semibold">Current State</th>
                  <th className="px-4 py-3 font-semibold">Activity Score</th>
                  <th className="px-4 py-3 font-semibold">Inactivity Timer</th>
                  <th className="px-4 py-3 font-semibold">Hardware</th>
                  <th className="px-4 py-3 font-semibold">Completed Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.workers.map((worker) => (
                  <tr key={worker.socketId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {worker.userName}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">{worker.socketId}</div>
                    </td>
                    <td className="px-4 py-3">{getStateBadge(worker.state)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              worker.activityScore >= 40
                                ? 'bg-blue-500'
                                : worker.activityScore >= 20
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, worker.activityScore))}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                          {worker.activityScore}/100
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {worker.idleSeconds}s idle
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {worker.cores} Cores • {worker.memoryGb || 8} GB
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {worker.jobsCompleted} segments
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Real-Time Cluster Event & State Log Console */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl text-slate-200">
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-sm text-white">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Live Cluster Event & Inactivity Logs (Admin Only)
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              {['ALL', 'STATE_CHANGE', 'PREEMPTED', 'JOB_LIFECYCLE', 'NODE_TIMEOUT'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterType(tab)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    filterType === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'ALL'
                    ? 'All Events'
                    : tab === 'STATE_CHANGE'
                    ? 'Idle/Active'
                    : tab === 'PREEMPTED'
                    ? 'Preemptions'
                    : tab === 'JOB_LIFECYCLE'
                    ? 'Jobs'
                    : 'Timeouts'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                autoScroll ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-semibold transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>

        {/* Terminal log output */}
        <div
          ref={logTerminalRef}
          className="p-4 font-mono text-xs max-h-[350px] min-h-[220px] overflow-y-auto space-y-2 select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 text-center py-10">
              No cluster event logs matching the selected filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 p-2 rounded hover:bg-slate-900/60 border border-transparent hover:border-slate-800/80 transition-colors"
              >
                <span className="text-slate-500 shrink-0 text-[10px] mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 border ${getLogLevelClass(
                    log.level,
                  )}`}
                >
                  {log.eventType}
                </span>

                <span className="text-blue-400 font-semibold shrink-0">
                  [{log.userName}]
                </span>

                <span className="text-slate-300 break-words flex-1 leading-relaxed">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ClusterActivityTab;
