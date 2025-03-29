import * as THREE from 'three';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';

export class EnemySystem {
  private enemies: Enemy[] = [];
  private player: Player | null = null;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2; // 2秒ごとに敵をスポーン
  private maxEnemies: number = 20; // 最大敵数

  constructor(private scene: THREE.Scene) {}

  public init(): void {
    // 初期の敵をスポーン
    this.spawnEnemies(5);
  }

  public update(deltaTime: number): void {
    // プレイヤーの位置を更新
    if (this.player) {
      const playerPosition = this.player.getPosition();
      
      // 敵の更新処理
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        
        // プレイヤーに向かって移動
        enemy.moveTowards(playerPosition, deltaTime);
        
        // 敵の更新
        enemy.update(deltaTime);
        
        // 敵の死亡判定
        if (enemy.health <= 0) {
          // 敵を削除
          this.scene.remove(enemy.mesh);
          enemy.dispose();
          this.enemies.splice(i, 1);
          
          // プレイヤーに経験値を付与
          if (this.player) {
            const leveledUp = this.player.gainExperience(enemy.experienceValue);
            if (leveledUp) {
              console.log('Level up! New level: ' + this.player.level);
            }
          }
        }
      }
      
      // 敵の生成タイマー更新
      this.spawnTimer += deltaTime;
      if (this.spawnTimer >= this.spawnInterval && this.enemies.length < this.maxEnemies) {
        this.spawnEnemies(1);
        this.spawnTimer = 0;
      }
    }
  }

  // 敵をスポーン
  public spawnEnemies(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.enemies.length >= this.maxEnemies) break;
      
      // ランダムな位置に敵を生成
      const angle = Math.random() * Math.PI * 2;
      const distance = 15 + Math.random() * 10; // プレイヤーから15-25単位離れた場所
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      // 敵を作成
      const enemy = new Enemy();
      enemy.mesh.position.set(x, 0, z);
      
      // シーンに追加
      this.scene.add(enemy.mesh);
      this.enemies.push(enemy);
    }
  }

  // プレイヤーの参照を設定
  public setPlayer(player: Player): void {
    this.player = player;
  }

  // 全ての敵を取得
  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  // リソースの解放
  public dispose(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
      enemy.dispose();
    }
    this.enemies = [];
  }
}