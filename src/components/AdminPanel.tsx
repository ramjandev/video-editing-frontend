import { api } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToast } from "@/store/uiSlice";
import type { AdminUser } from "@/types";
import { Film, Users, Server } from "lucide-react";
import { useEffect, useState } from "react";
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

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("users");

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersRes = await api.get<AdminUser[]>("/admin/users");
      setUsers(usersRes.data);
    } catch (err: any) {
      dispatch(
        addToast({
          type: "error",
          message: err?.response?.data?.message || "Failed to load admin data",
        }),
      );
    } finally {
      setLoading(false);
    }
  };

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
        <AdminHeader loading={loading} fetchData={fetchData} />
        <NavigationTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as ActiveTab)}
        />
        {activeTab === "cluster" ? (
          <ClusterActivityTab />
        ) : (
          <BodyContent activeTab={activeTab} />
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
