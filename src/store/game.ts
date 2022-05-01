import { defaultGameSetting, GameSetting, PlayerSetting } from "@/settings/game";
import { Color, ImmutablePosition } from "@/shogi";
import * as uri from "@/uri";
import { humanPlayer, Player, USIPlayer } from "./player";

export type PlayerState = {
  timeMs: number;
  byoyomi: number;
};

type TimerHandlers = {
  timeout: () => void;
  onBeepShort: () => void;
  onBeepUnlimited: () => void;
};

export class GameStore {
  private blackState: PlayerState;
  private whiteState: PlayerState;
  private timerHandle: number;
  private timerStart: Date;
  private lastTimeMs: number;
  private _elapsedMs: number;
  private _setting: GameSetting;
  private blackPlayer?: Player;
  private whitePlayer?: Player;

  constructor() {
    this.blackState = { timeMs: 0, byoyomi: 0 };
    this.whiteState = { timeMs: 0, byoyomi: 0 };
    this.timerHandle = 0;
    this.timerStart = new Date();
    this.lastTimeMs = 0;
    this._elapsedMs = 0;
    this._setting = defaultGameSetting();
  }

  get blackTimeMs(): number {
    return this.blackState.timeMs;
  }

  get blackByoyomi(): number {
    return this.blackState.byoyomi;
  }

  get whiteTimeMs(): number {
    return this.whiteState.timeMs;
  }

  get whiteByoyomi(): number {
    return this.whiteState.byoyomi;
  }

  get elapsedMs(): number {
    return this._elapsedMs;
  }

  get setting(): GameSetting {
    return this._setting;
  }

  async setup(setting: GameSetting): Promise<void> {
    this.blackState.timeMs = setting.timeLimit.timeSeconds * 1e3;
    this.blackState.byoyomi = setting.timeLimit.byoyomi;
    this.whiteState.timeMs = setting.timeLimit.timeSeconds * 1e3;
    this.whiteState.byoyomi = setting.timeLimit.byoyomi;
    this._setting = setting;
    this.blackPlayer = await this.buildPlayer(setting.black);
    this.whitePlayer = await this.buildPlayer(setting.black);
  }

  private async buildPlayer(playerSetting: PlayerSetting): Promise<Player> {
    if (playerSetting.uri === uri.ES_HUMAN) {
      return humanPlayer;
    } else if (uri.isUSIEngine(playerSetting.uri)) {
      const player = new USIPlayer(playerSetting.uri);
      await player.launch();
      return player;
    }
    throw new Error("予期せぬプレイヤーURIです: " + playerSetting.uri);
  }

  async close(): Promise<void> {
    // FIXME: close players
  }

  updatePosition(_: ImmutablePosition): void {
    // FIXME
  }

  private getPlayerState(color: Color): PlayerState {
    switch (color) {
      case Color.BLACK:
        return this.blackState;
      case Color.WHITE:
        return this.whiteState;
    }
  }

  startTimer(color: Color, handlers: TimerHandlers): void {
    const playerState = this.getPlayerState(color);
    this.timerStart = new Date();
    this.lastTimeMs = playerState.timeMs;
    playerState.byoyomi = this.setting.timeLimit.byoyomi;
    this.timerHandle = window.setInterval(() => {
      const lastTimeMs = playerState.timeMs;
      const lastByoyomi = playerState.byoyomi;
      const now = new Date();
      this._elapsedMs = now.getTime() - this.timerStart.getTime();
      const timeMs = this.lastTimeMs - this._elapsedMs;
      if (timeMs >= 0) {
        playerState.timeMs = timeMs;
      } else {
        playerState.timeMs = 0;
        playerState.byoyomi = Math.max(
          Math.ceil(this.setting.timeLimit.byoyomi + timeMs / 1e3),
          0
        );
      }
      if (playerState.timeMs === 0 && playerState.byoyomi === 0) {
        handlers.timeout();
        return;
      }
      const lastTime = Math.ceil(lastTimeMs / 1e3);
      const time = Math.ceil(playerState.timeMs / 1e3);
      const byoyomi = playerState.byoyomi;
      if (time === 0 && (lastTimeMs > 0 || byoyomi !== lastByoyomi)) {
        if (byoyomi <= 5) {
          handlers.onBeepUnlimited();
        } else if (byoyomi <= 10 || byoyomi % 10 === 0) {
          handlers.onBeepShort();
        }
      } else if (!this.setting.timeLimit.byoyomi && time !== lastTime) {
        if (time <= 5) {
          handlers.onBeepUnlimited();
        } else if (time <= 10 || time === 20 || time === 30 || time === 60) {
          handlers.onBeepShort();
        }
      }
    }, 100);
  }

  incrementTime(color: Color): void {
    this.getPlayerState(color).timeMs += this.setting.timeLimit.increment * 1e3;
  }

  clearTimer(): void {
    if (this.timerHandle) {
      window.clearInterval(this.timerHandle);
      this.timerHandle = 0;
    }
    this._elapsedMs = 0;
  }
}
