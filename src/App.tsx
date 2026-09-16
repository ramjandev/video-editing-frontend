import { useEffect, useState } from "react";
import { AssetLibrary } from "./components/AssetLibrary";
import { Player } from "./components/Player";
import { Timeline } from "./components/Timeline";
import { ExportModal } from "./components/ExportModal";
import { PreviewModal } from "./components/PreviewModal";
import { AuthModal } from "./components/AuthModal";
import { WorkerStatus } from "./components/WorkerStatus";
import { Toast } from "./components/Toast";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ProjectManager } from "./components/ProjectManager";
import { AdminPanel } from "./components/AdminPanel";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { loadAssets, createProject, exportVideo, triggerAutosave } from "./store/thunks";
import { undo, redo, resetEditor } from "./store/editorSlice";
import { openAuthModal, logout, fetchCurrentUser } from "./store/authSlice";
import { toggleProjectManager, toggleAdminPanel, addToast } from "./store/uiSlice";
import { renderWorker } from "./services/renderWorker";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Moon,
  Sun,
  Shield,
  LogOut,
  Download,
} from "lucide-react";

function App() {
  const dispatch = useAppDispatch();
  const { activeProjectId, sceneGraph, past, future } = useAppSelector((state) => state.editor);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });
  const [zoomPercent, setZoomPercent] = useState(60);
  const [projectTitle, setProjectTitle] = useState("Template 2025-08-29");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Initial sync on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      dispatch(fetchCurrentUser());
    }
    renderWorker.init();
    return () => {
      renderWorker.destroy();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      dispatch(loadAssets());
      if (!activeProjectId) {
        dispatch(createProject(undefined));
      }
    }
  }, [dispatch, isAuthenticated, user?.id, activeProjectId]);

  useEffect(() => {
    if (!sceneGraph || !activeProjectId) return;
    const interval = setInterval(() => {
      dispatch(triggerAutosave());
    }, 30000);
    return () => clearInterval(interval);
  }, [dispatch, sceneGraph, activeProjectId]);

  const handleExport = () => {
    if (!sceneGraph || sceneGraph.tracks.every((t) => t.clips.length === 0)) {
      dispatch(addToast({ type: "warning", message: "Add some clips to the timeline before exporting." }));
      return;
    }
    dispatch(exportVideo());
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleZoomIn = () => setZoomPercent((prev) => Math.min(200, prev + 10));
  const handleZoomOut = () => setZoomPercent((prev) => Math.max(20, prev - 10));

  const getUserInitial = (u?: { firstName?: string; email?: string } | null) => {
    if (!u) return "U";
    if (typeof u.firstName === "string" && u.firstName.trim().length > 0) {
      return u.firstName.trim().charAt(0).toUpperCase();
    }
    if (typeof u.email === "string" && u.email.trim().length > 0) {
      return u.email.trim().charAt(0).toUpperCase();
    }
    return "U";
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const isAdminOrSuperAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden font-sans select-none ${isDarkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      {/* Overlays */}
      <ExportModal />
      <AuthModal />
      <ProjectManager />
      <AdminPanel />
      <Toast />
      {isPreviewOpen && <PreviewModal onClose={() => setIsPreviewOpen(false)} />}

      {!isAuthenticated ? (
        /* Gatekeeper Screen */
        <div className="h-full w-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative">
          <button
            onClick={toggleTheme}
            className="absolute top-6 right-6 p-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-md"
            title="Toggle Light / Dark Mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center text-center">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
              VideoStudio
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Sign in to start creating professional video templates.
            </p>
            <div className="w-full space-y-3">
              <button
                onClick={() => dispatch(openAuthModal("login"))}
                className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => dispatch(openAuthModal("register"))}
                className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Main Platform Layout */
        <>
          {/* Top Bar Matching Create Template.png */}
          <header className="h-14 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-30 shadow-xs">
            {/* Left: ← Editor | Template Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => dispatch(toggleProjectManager())}
                className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white hover:text-sky-500 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Editor</span>
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-transparent focus:outline-none focus:border-b focus:border-sky-500 py-0.5 px-1 max-w-[200px]"
              />
            </div>

            {/* Center: Zoom Controls (-) 60% (+) & Undo/Redo */}
            <div className="flex items-center gap-4">
              {/* Cluster telemetry for Admin */}
              {isAdminOrSuperAdmin && <WorkerStatus />}

              {/* Zoom pill */}
              <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-2 py-1 gap-2 text-xs font-mono">
                <button
                  onClick={handleZoomOut}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-slate-700 dark:text-slate-300 font-medium min-w-[36px] text-center">
                  {zoomPercent}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Undo / Redo */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => dispatch(undo())}
                  disabled={!canUndo}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => dispatch(redo())}
                  disabled={!canRedo}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right: Update/Export Button & Dark Theme Toggle */}
            <div className="flex items-center gap-3">
              {isAdminOrSuperAdmin && (
                <button
                  onClick={() => dispatch(toggleAdminPanel())}
                  className="px-2.5 py-1.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl border border-purple-300 dark:border-purple-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              )}

              <button
                onClick={handleExport}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                title="Export & Render Video Project"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Video</span>
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* User Dropdown */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    {getUserInitial(user)}
                  </button>
                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 text-xs"
                      onMouseLeave={() => setIsUserMenuOpen(false)}
                    >
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="font-semibold text-slate-800 dark:text-white truncate">
                          {user.email}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          dispatch(logout());
                          dispatch(resetEditor());
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors text-left cursor-pointer mt-1"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Main Editor Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Rail & Asset Library */}
            <AssetLibrary />

            {/* Center Player & Timeline */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900">
              <div className="flex-1 flex items-center justify-center relative min-h-[300px] overflow-hidden">
                <Player zoomScale={zoomPercent / 100} />
              </div>
              <div className="h-[280px] shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <Timeline />
              </div>
            </div>

            {/* Right Properties Panel */}
            <PropertiesPanel />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
