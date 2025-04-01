import * as THREE from 'three';
import { Enemy } from '../entities/Enemy';
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
        const enemy = new Enemy();
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

  private clearEnemies(): void {
    // 既存の敵を削除
    this.enemies.forEach(enemy => {
      this.scene.remove(enemy.mesh);
      enemy.dispose();
    });
    this.enemies = [];
  }

  // 視線の確認（壁による遮蔽のチェック）
  private hasLineOfSight(start: THREE.Vector3, end: THREE.Vector3): boolean {
    if (!this.levelSystem) return true;

    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();
    direction.normalize();

    const raycaster = new THREE.Raycaster(start, direction, 0, distance);
    const walls = this.levelSystem.getWalls();
    const intersects = raycaster.intersectObjects(walls);

    return intersects.length === 0;
  }

  // 検知範囲の表示切り替え
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

  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  public dispose(): void {
    this.clearEnemies();
  }
}