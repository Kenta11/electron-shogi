import Position, { ImmutablePosition } from "./position";
import Move from "./move";
import { Color } from ".";
import { millisecondsToHMMSS, millisecondsToMSS } from "@/helpers/time";

export enum RecordMetadataKey {
  // 柿木形式で規定されている項目
  BLACK_NAME = "blackName", // 先手
  WHITE_NAME = "whiteName", // 後手
  START_DATETIME = "startDatetime", // 開始日時
  END_DATETIME = "endDatetime", // 終了日時
  DATE = "date", // 対局日
  TOURNAMENT = "tournament", // 棋戦
  STRATEGY = "strategy", // 戦型
  TITLE = "title", // 表題
  TIME_LIMIT = "timeLimit", // 持ち時間
  TIME_SPENT = "timeSpent", // 消費時間
  PLACE = "place", // 場所
  POSTED_ON = "postedOn", // 掲載
  NOTE = "note", // 備考
  BLACK_SHORT_NAME = "blackShortName", // 先手省略名
  WHITE_SHORT_NAME = "whiteShortName", // 後手省略名

  // 柿木形式で規定されている詰将棋に関する項目
  OPUS_NO = "opusNo", // 作品番号
  OPUS_NAME = "opusName", // 作品名
  AUTHOR = "author", // 作者
  PUBLISHED_ON = "publishedOn", // 発表誌
  PUBLISHED_AT = "publishedAt", // 発表年月
  SOURCE = "source", // 出典
  LENGTH = "length", // 手数
  INTEGRITY = "integrity", // 完全性
  CATEGORY = "category", // 分類
  AWARD = "award", // 受賞
}

export class RecordMetadata {
  private metadata: Map<RecordMetadataKey, string>;
  private customMetadata: Map<string, string>;

  constructor() {
    this.metadata = new Map<RecordMetadataKey, string>();
    this.customMetadata = new Map<string, string>();
  }

  get standardMetadataKeys(): IterableIterator<RecordMetadataKey> {
    return this.metadata.keys();
  }

  getStandardMetadata(key: RecordMetadataKey): string | undefined {
    return this.metadata.get(key);
  }

  setStandardMetadata(key: RecordMetadataKey, value: string): void {
    this.metadata.set(key, value);
  }

  get customMetadataKeys(): IterableIterator<string> {
    return this.customMetadata.keys();
  }

  getCustomMetadata(key: string): string | undefined {
    return this.customMetadata.get(key);
  }

  setCustomMetadata(key: string, value: string): void {
    this.customMetadata.set(key, value);
  }
}

export enum SpecialMove {
  START = "start",
  INTERRUPT = "interrupt",
  RESIGN = "resign",
  DRAW = "draw",
  REPETITION_DRAW = "repetitionDraw",
  MATE = "mate",
  TIMEOUT = "timeout",
  FOUL_WIN = "foulWin", // 手番側の勝ち(直前の指し手が反則手)
  FOUL_LOSE = "foulLose", // 手番側の負け
  ENTERING_OF_KING = "enteringOfKing",
  WIN_BY_DEFAULT = "winByDefault",
  LOSS_BY_DEFAULT = "lossByDefault",
}

const specialMoveToDisplayStringMap = {
  start: "開始局面",
  resign: "投了",
  interrupt: "中断",
  draw: "持将棋",
  repetitionDraw: "千日手",
  mate: "詰み",
  timeout: "切れ負け",
  foulWin: "反則勝ち",
  foulLose: "反則負け",
  enteringOfKing: "入玉",
  winByDefault: "不戦勝",
  lossByDefault: "不戦敗",
};

export function specialMoveToDisplayString(move: SpecialMove): string {
  return specialMoveToDisplayStringMap[move];
}

export interface RecordEntry {
  readonly number: number;
  readonly prev: RecordEntry | null;
  readonly next: RecordEntry | null;
  readonly branch: RecordEntry | null;
  readonly branchIndex: number;
  readonly activeBranch: boolean;
  readonly move: Move | SpecialMove;
  comment: string;
  customData: string | undefined;
  readonly displayMoveText: string;
  readonly displayText: string;
  readonly hasBranch: boolean;
  readonly isFirstBranch: boolean;
  readonly elapsedMs: number;
  readonly totalElapsedMs: number;
  setElapsedMs(elapsedMs: number): void;
}

class RecordEntryImpl implements RecordEntry {
  public next: RecordEntryImpl | null;
  public branch: RecordEntryImpl | null;
  public comment: string;
  public customData: string | undefined;
  public elapsedMs: number;
  public totalElapsedMs: number;

  constructor(
    public number: number,
    public prev: RecordEntryImpl | null,
    public branchIndex: number,
    public activeBranch: boolean,
    public move: Move | SpecialMove
  ) {
    this.next = null;
    this.branch = null;
    this.comment = "";
    this.elapsedMs = 0;
    this.totalElapsedMs = 0;
  }

  get displayMoveText(): string {
    const prev = this.prev instanceof Move ? this.prev : null;
    return this.move instanceof Move
      ? this.move.getDisplayText(prev)
      : specialMoveToDisplayString(this.move);
  }

  get displayText(): string {
    let ret = this.displayMoveText;
    if (this.number !== 0) {
      const elapsed = millisecondsToMSS(this.elapsedMs);
      const totalElapsed = millisecondsToHMMSS(this.totalElapsedMs);
      ret += ` (${elapsed} / ${totalElapsed})`;
    }
    return ret;
  }

  get hasBranch(): boolean {
    return !!this.prev && !!this.prev.next && !!this.prev.next.branch;
  }

  get isFirstBranch(): boolean {
    return !this.prev || this.prev.next === this;
  }

  private updateTotalElapsedMs() {
    this.totalElapsedMs = this.elapsedMs;
    if (this.prev && this.prev.prev) {
      this.totalElapsedMs += this.prev.prev.totalElapsedMs;
    }
  }

  setElapsedMs(elapsedMs: number): void {
    this.elapsedMs = elapsedMs;
    this.updateTotalElapsedMs();
    let p = this.next;
    const stack: RecordEntryImpl[] = [];
    while (p) {
      p.updateTotalElapsedMs();
      if (p.branch) {
        stack.push(p.branch);
      }
      if (p.next) {
        p = p.next;
      } else {
        p = stack.pop() || null;
      }
    }
  }
}

export default class Record {
  private _metadata: RecordMetadata;

  private _initialPosition: ImmutablePosition;

  private _position: Position;

  private _first: RecordEntryImpl;

  private _current: RecordEntryImpl;

  constructor(position?: ImmutablePosition) {
    this._metadata = new RecordMetadata();
    this._initialPosition = position ? position.clone() : new Position();
    this._position = this.initialPosition.clone();
    this._first = new RecordEntryImpl(
      0, // number
      null, // prev
      0, // branchIndex
      true, // activeBranch
      SpecialMove.START // move
    );
    this._current = this._first;
  }

  get metadata(): RecordMetadata {
    return this._metadata;
  }

  get initialPosition(): ImmutablePosition {
    return this._initialPosition;
  }

  get position(): ImmutablePosition {
    return this._position;
  }

  get first(): RecordEntry {
    return this._first;
  }

  get current(): RecordEntry {
    return this._current;
  }

  get moves(): Array<RecordEntry> {
    const moves = this.movesBefore;
    for (let p = this._current.next; p; p = p.next) {
      while (!p.activeBranch) {
        p = p.branch as RecordEntryImpl;
      }
      moves.push(p);
    }
    return moves;
  }

  get movesBefore(): Array<RecordEntry> {
    return this._movesBefore;
  }

  private get _movesBefore(): Array<RecordEntryImpl> {
    const moves = new Array<RecordEntryImpl>();
    moves.unshift(this._current);
    for (let p = this._current.prev; p; p = p.prev) {
      moves.unshift(p);
    }
    return moves;
  }

  get length(): number {
    let len = this._current.number;
    for (let p = this._current.next; p; p = p.next) {
      while (!p.activeBranch) {
        p = p.branch as RecordEntryImpl;
      }
      len = p.number;
    }
    return len;
  }

  get branchBegin(): RecordEntry | null {
    return this._current.prev ? this._current.prev.next : null;
  }

  clear(position?: ImmutablePosition): void {
    if (position) {
      this._initialPosition = position.clone();
    }
    this._position = this.initialPosition.clone();
    this._first.next = null;
    this._current = this._first;
  }

  goBack(): boolean {
    if (this._current.prev) {
      if (this._current.move instanceof Move) {
        this._position.undoMove(this._current.move);
      }
      this._current = this._current.prev;
      return true;
    }
    return false;
  }

  goForward(): boolean {
    if (this._current.next) {
      this._current = this._current.next;
      while (!this._current.activeBranch) {
        this._current = this._current.branch as RecordEntryImpl;
      }
      if (this._current.move instanceof Move) {
        this._position.doMove(this._current.move);
      }
      return true;
    }
    return false;
  }

  goto(number: number): void {
    while (number < this._current.number) {
      if (!this.goBack()) {
        break;
      }
    }
    while (number > this._current.number) {
      if (!this.goForward()) {
        break;
      }
    }
  }

  resetAllBranchSelection(): void {
    this._forEach((entry) => {
      entry.activeBranch = entry.isFirstBranch;
    });
  }

  switchBranchByIndex(index: number): boolean {
    if (!this._current.prev) {
      return false;
    }
    let ok = false;
    for (let p = this._current.prev.next; p; p = p.branch) {
      if (p.branchIndex === index) {
        p.activeBranch = true;
        if (this._current.move instanceof Move) {
          this._position.undoMove(this._current.move);
        }
        this._current = p;
        if (this._current.move instanceof Move) {
          this._position.doMove(this._current.move);
        }
        ok = true;
      } else {
        p.activeBranch = false;
      }
    }
    return ok;
  }

  append(move: Move | SpecialMove): boolean {
    if (move instanceof Move) {
      if (!this.position.isValidMove(move)) {
        return false;
      }
      this._position.doMove(move);
    }
    if (this._current !== this.first && !(this._current.move instanceof Move)) {
      this.goBack();
    }
    if (!this._current.next) {
      this._current.next = new RecordEntryImpl(
        this._current.number + 1, // number
        this._current, // prev
        0, // branchIndex
        true, // activeBranch
        move // move
      );
      this._current = this._current.next;
      return true;
    }
    let p: RecordEntryImpl | null;
    for (p = this._current.next; p; p = p.branch) {
      p.activeBranch = false;
    }
    let lastBranch = this._current.next;
    for (p = this._current.next; p; p = p.branch) {
      if (
        (p.move instanceof Move &&
          move instanceof Move &&
          move.equals(p.move)) ||
        move === p.move
      ) {
        this._current = p;
        this._current.activeBranch = true;
        return true;
      }
      lastBranch = p;
    }
    this._current = new RecordEntryImpl(
      this._current.number + 1, // number
      this._current, // prev
      lastBranch.branchIndex + 1, // branchIndex
      true, // activeBranch
      move // move
    );
    lastBranch.branch = this._current;
    return true;
  }

  removeAfter(): void {
    this.goBack();
    this._current.next = null;
  }

  get usi(): string {
    let ret = "position " + this.initialPosition.sfen + " moves";
    this._movesBefore.forEach((entry) => {
      if (entry.move instanceof Move) {
        ret += " " + entry.move.sfen;
      }
    });
    return ret;
  }

  get sfen(): string {
    return "position " + this.position.getSfen(this._current.number + 1);
  }

  forEach(handler: (entry: RecordEntry) => void): void {
    this._forEach(handler);
  }

  private _forEach(handler: (entry: RecordEntryImpl) => void): void {
    let p: RecordEntryImpl | null = this._first;
    const stack: RecordEntryImpl[] = [];
    while (p) {
      handler(p);
      if (p.branch) {
        stack.push(p.branch);
      }
      if (p.next) {
        p = p.next;
      } else {
        p = stack.pop() || null;
      }
    }
  }
}

export function getNextColorFromUSI(usi: string): Color {
  const sections = usi.trim().split(" ");
  if (sections[1] === "startpos" || sections[3] === "b") {
    return sections.length % 2 === 1 ? Color.BLACK : Color.WHITE;
  }
  return sections.length % 2 === 0 ? Color.BLACK : Color.WHITE;
}
