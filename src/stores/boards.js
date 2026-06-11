import { defineStore } from "pinia";
import {
  createBoard as insertBoard,
  createDefaultColumns,
  getBoard,
  getBoardCards,
  getBoardColumns,
  listBoardsForCurrentUser
} from "../services/boardRepository";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { useAuthStore } from "./auth";

const boardsRlsMessage = "Boards could not be loaded. Check Supabase RLS policies for boards and board_members.";

export const useBoardsStore = defineStore("boards", {
  state: () => ({
    boards: [],
    columns: [],
    selectedBoardId: null,
    boardSettings: {
      language: "en",
      conflictStrategy: "versioned",
      visibility: "private"
    },
    loading: false,
    errorMessage: "",
    setupRequired: !isSupabaseConfigured
  }),
  getters: {
    selectedBoard: (state) => state.boards.find((board) => board.id === state.selectedBoardId) || null,
    boardById: (state) => (boardId) => state.boards.find((board) => board.id === boardId),
    columnById: (state) => (columnId) => state.columns.find((column) => column.id === columnId),
    columnNames: (state) => state.columns.map((column) => column.title)
  },
  actions: {
    setError(error) {
      this.errorMessage = error?.message || "";
    },
    async loadBoards() {
      if (this.setupRequired) return;
      const authStore = useAuthStore();
      await authStore.initialize();
      if (authStore.session.status !== "authenticated" || !authStore.currentUserId) {
        this.boards = [];
        this.selectedBoardId = null;
        this.setError(new Error("Sign in before loading boards."));
        return;
      }
      this.loading = true;
      const { data, error } = await listBoardsForCurrentUser();
      this.boards = data || [];
      if (!this.selectedBoardId && this.boards.length) this.selectedBoardId = this.boards[0].id;
      if (this.selectedBoardId && !this.boards.some((board) => board.id === this.selectedBoardId)) this.selectedBoardId = this.boards[0]?.id || null;
      this.setError(error?.message === boardsRlsMessage ? new Error(boardsRlsMessage) : error);
      this.loading = false;
    },
    async createBoard(title, description) {
      if (this.setupRequired) return { error: new Error("Supabase is not configured.") };
      const authStore = useAuthStore();
      await authStore.initialize();
      if (authStore.session.status !== "authenticated" || !authStore.currentUserId) return { error: new Error("Sign in before creating a board.") };
      const { data, error } = await insertBoard(title.trim(), description?.trim() || "");
      this.setError(error);
      if (error) return { error };
      await this.loadBoards();
      this.selectedBoardId = data.id;
      return { board: data };
    },
    async loadBoard(boardId) {
      if (this.setupRequired || !boardId) return { board: null };
      const { data, error } = await getBoard(boardId);
      this.setError(error);
      if (data && !this.boards.some((board) => board.id === data.id)) this.boards.push(data);
      if (data) this.selectedBoardId = data.id;
      return { board: data, error };
    },
    async loadColumns(boardId = this.selectedBoardId) {
      if (this.setupRequired || !boardId) return;
      const { data, error } = await getBoardColumns(boardId);
      this.columns = data || [];
      this.setError(error);
    },
    async loadBoardCards(boardId = this.selectedBoardId) {
      if (this.setupRequired || !boardId) return { data: [] };
      return getBoardCards(boardId);
    },
    async ensureDefaultColumns(boardId = this.selectedBoardId) {
      if (this.setupRequired || !boardId) return { error: new Error("Supabase is not configured.") };
      const { data, error } = await createDefaultColumns(boardId);
      if (!error) this.columns = data || [];
      this.setError(error);
      return { columns: data, error };
    },
    selectBoard(boardId) {
      this.selectedBoardId = boardId || null;
    }
  }
});
