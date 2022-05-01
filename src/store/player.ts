import { ImmutablePosition, Move } from "@/shogi";

export interface Player {
  startSearch(position: ImmutablePosition, onMove: (move: Move) => void, onResign: () => void): void;
  startResearch(position: ImmutablePosition): void;
  close(): void;
}

export class HumanPlayer {
  private onMove?: (move: Move) => void;
  private onResign?: () => void;

  startSearch(_: ImmutablePosition, onMove: (move: Move) => void, onResign: () => void): void {
    this.onMove = onMove;
    this.onResign = onResign;
  }

  doMove(move: Move) {
    if (this.onMove) {
      this.onMove(move);
    }
    this.clearHandlers();
  }

  resign() {
    if (this.onResign) {
      this.onResign();
    }
    this.clearHandlers();
  }

  private clearHandlers() {
    this.onMove = undefined;
    this.onResign = undefined;
  }

  startResearch(): void {
  }

  close(): void {
  }
}

export const humanPlayer = new HumanPlayer();

export class USIPlayer {
  private uri: string;

  constructor(uri: string) {
    this.uri = uri;
  }

  async launch(): Promise<void> {
  }

  startSearch(_: ImmutablePosition, onMove: (move: Move) => void, onResign: () => void): void {
  }

  startResearch(): void {
  }

  close(): void {
  }
}
