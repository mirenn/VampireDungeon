import * as THREE from 'three';
import { Enemy } from '../entities/Enemy';
import { JellySlime } from '../entities/JellySlime';
import { Player } from '../entities/Player';
import { LevelSystem } from './LevelSystem';

interface EnemySpawnPattern {
  count: number;
  spawnPoints: { x: number; y: number }[];
}

const ENEMY_PATTERNS: { [key: number]: EnemySpawnPattern } = {
  1: {
    count: 3,
    spawnPoints: [
      { x: 30, y: 30 },
      { x: 35, y: 15 },
      { x: 15, y: 35 }
    ]
  },
  2: {
    count: 5,
    spawnPoints: [
      { x: 40, y: 40 },
      { x: 20, y: 20 },
      { x: 40, y: 20 },
      { x: 20, y: 40 },
      { x: 30, y: 30 }
    ]
  },
  3: {
    count: 7,
    spawnPoints: [
      { x: 60, y: 60 },
      { x: 20, y: 20 },
      { x: 60, y: 20 },
      { x: 20, y: 60 },
      { x: 40, y: 40 },
      { x: 40, y: 20 },
      { x: 20, y: 40 }
    ]
  }
};

export class EnemySystem {
  private enemies: Enemy[] = [];
  private player: Player | null = null;
  private levelSystem: LevelSystem | null = null;
  private scene: THREE.Scene;
  private showDetectionRanges: boolean = false;
  private raycaster: THREE.Raycaster = new THREE.Raycaster(); // 視線判定用

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public init(): void {
    // 初期レベルの敵を生成
    this.spawnEnemiesForLevel(1);
  }

  public setPlayer(player: Player): void {
    this.player = player;
  }

  public setLevelSystem(levelSystem: LevelSystem): void {
    this.levelSystem = levelSystem;
  }

  public update(deltaTime: number): void {
    // 各敵の更新処理
    this.enemies.forEach(enemy => {
      enemy.update(deltaTime);

      if (this.player) {
        // プレイヤーとの距離をチェック
        const playerPosition = this.player.getPosition();
        const enemyPosition = enemy.getPosition();
        const distance = playerPosition.distanceTo(enemyPosition);

        // 検知範囲内かつ壁による遮蔽がない場合のみプレイヤーを追跡
        if (distance <= enemy.detectionRange) {
          // 壁による遮蔽チェック
          if (this.hasLineOfSight(enemyPosition, playerPosition)) {
            enemy.isPlayerDetected = true;
            enemy.moveTowards(playerPosition, deltaTime);
          } else {
            enemy.isPlayerDetected = false;
          }
        } else {
          enemy.isPlayerDetected = false;
        }

        // 検知範囲の表示状態を更新
        if (this.showDetectionRanges) {
          enemy.addDetectionRangeToScene(this.scene);
        } else {
          enemy.removeDetectionRangeFromScene(this.scene);
        }
      }
    });
  }

  public spawnEnemiesForLevel(level: number): void {
    // 既存の敵を削除
    this.clearEnemies();

    const pattern = ENEMY_PATTERNS[level];
    if (!pattern) {
      console.error(`Level ${level} enemy pattern does not exist`);
      return;
    }

    // 敵の生成
    pattern.spawnPoints.forEach((point, index) => {
      if (index < pattern.count) {
        // JellySlimeを生成（分裂レベル0 = 元のサイズ）
        const enemy = new JellySlime(0);
        enemy.mesh.position.set(point.x, 0, point.y);
        this.enemies.push(enemy);
        this.scene.add(enemy.mesh);

        // 検知範囲の初期設定
        if (this.showDetectionRanges) {
          enemy.addDetectionRangeToScene(this.scene);
        }
      }
    });
  }

  // 敵がシーン内の全てのプレイヤーを取得
  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  // 敵を削除する処理（分裂も考慮）
  public removeEnemy(enemyToRemove: Enemy, grantExperience: boolean = true): void {
    const index = this.enemies.indexOf(enemyToRemove);
    if (index > -1) {
      // シーンからメッシュを削除
      this.scene.remove(enemyToRemove.mesh);
      
      // 視認範囲の表示も削除
      if (this.showDetectionRanges) {
        enemyToRemove.removeDetectionRangeFromScene(this.scene);
      }
      
      // リソース解放
      enemyToRemove.dispose();
      
      // 配列から削除
      this.enemies.splice(index, 1);

      // プレイヤーに経験値を与える（分裂した場合は経験値を与えないように調整可能）
      if (grantExperience && this.player) {
        this.player.gainExperience(enemyToRemove.experienceValue);
      }

      // 分裂処理
      if (enemyToRemove instanceof JellySlime && enemyToRemove.canSplit()) {
        this.splitJellySlime(enemyToRemove.getPosition());
      }

      // すべての敵を倒したかチェック
      if (this.enemies.length === 0 && this.levelSystem) {
        // 次のレベルへ進むなどの処理
        console.log("All enemies defeated!");
        // this.levelSystem.nextLevel(); // 必要に応じてコメント解除
      }
    }
  }
  
  // JellySlimeが分裂する処理を実装
  private splitJellySlime(position: THREE.Vector3): void {
    // 分裂後のスライム2体を生成（分裂レベル1 = 小さいサイズ）
    for (let i = 0; i < 2; i++) {
      const smallSlime = new JellySlime(1); // 分裂レベル1を指定
      
      // 元の位置から少しずらして配置
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2, // -1〜1のランダム値
        0,
        (Math.random() - 0.5) * 2
      );
      offset.normalize().multiplyScalar(1); // 1ユニット離す
      
      smallSlime.mesh.position.copy(position).add(offset);
      
      // 新しいスライムを敵リストに追加
      this.enemies.push(smallSlime);
      this.scene.add(smallSlime.mesh);
      
      // 検知範囲の初期設定
      if (this.showDetectionRanges) {
        smallSlime.addDetectionRangeToScene(this.scene);
      }
    }
    
    console.log("JellySlime split into two smaller slimes!");
  }
  
  // 視線判定のためのメソッド実装
  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const direction = new THREE.Vector3().subVectors(to, from).normalize();
    this.raycaster.set(from, direction);
    
    // レイキャストの距離を計算
    const distance = from.distanceTo(to);
    
    // 壁や障害物のリストを取得（実際のゲームでは壁などのオブジェクトを検出）
    // ここでは簡易的な実装として、常にtrueを返す（=障害物なし）
    // 将来的に壁の衝突判定を実装する場合は、以下のようにする
    /*
    const walls = this.scene.children.filter(child => child.userData.isWall);
    const intersects = this.raycaster.intersectObjects(walls, true);
    
    // 壁との交差を検出し、プレイヤーより手前にあれば視線が通らない
    return intersects.length === 0 || intersects[0].distance > distance;
    */
    
    return true; // 現在は障害物判定なし
  }

  // すべての敵を削除
  public clearEnemies(): void {
    this.enemies.forEach(enemy => {
      this.scene.remove(enemy.mesh);
      
      // 視認範囲の表示も削除
      if (this.showDetectionRanges) {
        enemy.removeDetectionRangeFromScene(this.scene);
      }
      
      enemy.dispose();
    });
    
    this.enemies = [];
  }
  
  // 検知範囲の表示/非表示を切り替え
  public toggleDetectionRanges(): void {
    this.showDetectionRanges = !this.showDetectionRanges;
    
    this.enemies.forEach(enemy => {
      if (this.showDetectionRanges) {
        enemy.addDetectionRangeToScene(this.scene);
      } else {
        enemy.removeDetectionRangeFromScene(this.scene);
      }
    });
  }
  
  // リソースの解放処理を実装
  public dispose(): void {
    // すべての敵を削除し、リソースを解放
    this.clearEnemies();
    
    // 各種参照をクリア
    this.player = null;
    this.levelSystem = null;
    
    // レイキャスター関連のクリーンアップ (必要に応じて)
    this.raycaster = new THREE.Raycaster();
  }
}