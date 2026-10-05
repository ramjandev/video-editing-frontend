import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface UiState {
  toasts: Toast[];
  isProjectManagerOpen: boolean;
  isAdminPanelOpen: boolean;
  isTranscriptionModalOpen: boolean;
  transcriptionSourceMediaId: string | null;
}

const initialState: UiState = {
  toasts: [],
  isProjectManagerOpen: false,
  isAdminPanelOpen: false,
  isTranscriptionModalOpen: false,
  transcriptionSourceMediaId: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    addToast: (state, action: PayloadAction<Omit<Toast, "id">>) => {
      state.toasts.push({ ...action.payload, id: `toast_${Date.now()}_${Math.random()}` });
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts: (state) => {
      state.toasts = [];
    },
    toggleProjectManager: (state) => {
      state.isProjectManagerOpen = !state.isProjectManagerOpen;
    },
    setProjectManagerOpen: (state, action: PayloadAction<boolean>) => {
      state.isProjectManagerOpen = action.payload;
    },
    toggleAdminPanel: (state) => {
      state.isAdminPanelOpen = !state.isAdminPanelOpen;
    },
    setAdminPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.isAdminPanelOpen = action.payload;
    },
    setTranscriptionModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isTranscriptionModalOpen = action.payload;
    },
    openTranscriptionForMedia: (state, action: PayloadAction<string | null>) => {
      state.transcriptionSourceMediaId = action.payload;
      state.isTranscriptionModalOpen = true;
    },
  },
});

export const {
  addToast,
  removeToast,
  clearToasts,
  toggleProjectManager,
  setProjectManagerOpen,
  toggleAdminPanel,
  setAdminPanelOpen,
  setTranscriptionModalOpen,
  openTranscriptionForMedia,
} = uiSlice.actions;
export default uiSlice.reducer;
