import { defineStore } from "pinia";
import { boards, columns } from "../data/mockData";

export const useBoardsStore = defineStore("boards", {
  state: () => ({
    boards: JSON.parse(JSON.stringify(boards)),
    columns: [...columns],
    selectedBoardId: "board-main",
    boardSettings: {
      language: "en",
      conflictStrategy: "versioned",
      visibility: "private"
    }
  }),
  getters: {
    selectedBoard: (state) => state.boards.find((board) => board.id === state.selectedBoardId) || state.boards[0],
    boardById: (state) => (boardId) => state.boards.find((board) => board.id === boardId)
  },
  actions: {
    selectBoard(boardId) {
      if (this.boards.some((board) => board.id === boardId)) this.selectedBoardId = boardId;
    }
  }
});
