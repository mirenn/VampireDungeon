import * as THREE from 'three';
import { Player } from '../entities/Player';

export class PlayerSystem {
  private player: Player | null = null;
  private keyState: { [key: string]: boolean } = {};

  constructor(private scene: THREE.Scene) {
    // キー入力のイベントリスナーを設定
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  public init(): void {
    // プレイヤーキャラクターの作成
    this.player = new Player();
    this.scene.add(this.player.mesh);
  }

  public update(deltaTime: number): void {
    if (!this.player) return;

    // プレイヤーの移動処理
    const moveSpeed = 10 * deltaTime;
    
    if (this.keyState['w'] || this.keyState['ArrowUp']) {
      this.player.moveForward(moveSpeed);
    }
    if (this.keyState['s'] || this.keyState['ArrowDown']) {
      this.player.moveBackward(moveSpeed);
    }
    if (this.keyState['a'] || this.keyState['ArrowLeft']) {
      this.player.moveLeft(moveSpeed);
    }
    if (this.keyState['d'] || this.keyState['ArrowRight']) {
      this.player.moveRight(moveSpeed);
    }

    // プレイヤーの更新処理
    this.player.update(deltaTime);
  }

  public dispose(): void {
    // イベントリスナーの削除
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    
    // プレイヤーの削除
    if (this.player) {
      this.scene.remove(this.player.mesh);
      this.player.dispose();
      this.player = null;
    }
  }

  // キーが押された時の処理
  private onKeyDown(event: KeyboardEvent): void {
    this.keyState[event.key] = true;
  }

  // キーが離された時の処理
  private onKeyUp(event: KeyboardEvent): void {
    this.keyState[event.key] = false;
  }

  // プレイヤーの参照を取得
  public getPlayer(): Player | null {
    return this.player;
  }
}