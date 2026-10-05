import { api, WS_URL } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToast } from "@/store/uiSlice";
import type { AdminUser, PlatformStats } from "@/types";
import { Film, Users, Server } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import AdminHeader from "./admin/AdminHeader";
import type { NavigationTab } from "./admin/NavigationTabs";
import NavigationTabs from "./admin/NavigationTabs";
import BodyContent from "./timeline/BodyContent";
import ClusterActivityTab from "./admin/ClusterActivityTab";

export type ActiveTab = "users" | "stats" | "cluster";

export function AdminPanel() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((s) => s.ui.isAdminPanelOpen);
  const currentUser = useAppSelector((s) => s.auth.user);
  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("users");
  const socketRef = useRef<Socket | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get<PlatformStats>("/admin/stats"),
        api.get<AdminUser[]>("/admin/users"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (err: any) {
      if (!silent) {
        dispatch(
          addToast({
            type: "error",
            message: err?.response?.data?.message || "Failed to load admin data",
          }),
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // 1. Initial immediate fetch
    fetchData(false);

    // 2. Real-time WebSocket connection
    const socket = io(`${WS_URL}/rendering-ws`, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsLiveConnected(true);
      socket.emit("admin:subscribe");
    });

    socket.on("disconnect", () => {
      setIsLiveConnected(false);
    });

    // Real-time server push for platform statistics
    socket.on("admin:platform_stats", (newStats: PlatformStats) => {
      setStats(newStats);
    });

    // Real-time server push for updated user records
    socket.on("admin:users_update", (newUsers: AdminUser[]) => {
      setUsers(newUsers);
    });

    // 3. Fallback auto-sync interval (every 8 seconds silent polling)
    const interval = setInterval(() => {
      fetchData(true);
    }, 8000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.emit("admin:unsubscribe");
        socket.disconnect();
      }
      setIsLiveConnected(false);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Only show cluster logs to Admin & Super Admin
  const tabs: NavigationTab[] = [
    {
      id: "users",
      label: "User Management",
      icon: Users,
      count: users.length,
    },
    {
      id: "stats",
      label: "Platform Stats",
      icon: Film,
    },
    ...(isAdmin
      ? [
          {
            id: "cluster",
            label: "Render Cluster & Live Logs",
            icon: Server,
          },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        <AdminHeader
          loading={loading}
          fetchData={() => fetchData(false)}
          isLiveConnected={isLiveConnected}
        />
        <NavigationTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as ActiveTab)}
        />
        {activeTab === "cluster" ? (
          <ClusterActivityTab />
        ) : (
          <BodyContent
            activeTab={activeTab}
            stats={stats}
            users={users}
            loading={loading}
            fetchData={() => fetchData(true)}
          />
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
