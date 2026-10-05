import { useAppDispatch } from "@/store/hooks";
import { setAdminPanelOpen } from "@/store/uiSlice";
import { RefreshCw, ShieldAlert, X } from "lucide-react";
export type ActiveTab = "users" | "stats";

interface Props {
  loading: boolean;
  fetchData: () => void;
  isLiveConnected?: boolean;
}
const AdminHeader: React.FC<Props> = ({ loading, fetchData, isLiveConnected }) => {
  const dispatch = useAppDispatch();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-600/10 dark:bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">
              Admin Control Center
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30">
              ADMIN
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            User role management and platform metrics (2 Roles: USER & ADMIN)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 select-none"
          title={isLiveConnected ? "Real-time WebSocket & 8s auto-sync active" : "Auto-sync polling active (every 8s)"}
        >
          <span className={`w-2 h-2 rounded-full ${isLiveConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
          <span>{isLiveConnected ? "Live Sync" : "Auto Sync"}</span>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          title="Refresh now"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => dispatch(setAdminPanelOpen(false))}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default AdminHeader;
