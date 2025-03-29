import * as THREE from 'three';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { LevelSystem } from './LevelSystem';

export class EnemySystem {
  private enemies: Enemy[] = [];
  private player: Player | null = null;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2; // 2秒ごとに敵をスポーン
  private maxEnemies: number = 20; // 最大敵数
  private isDetectionRangeVisible: boolean = false; // 視認範囲の表示状態
  private levelSystem: LevelSystem | null = null;
  private raycaster: THREE.Raycaster;

  constructor(private scene: THREE.Scene) {
    this.raycaster = new THREE.Raycaster();
  }

  public init(): void {
    // 初期の敵をスポーン
    this.spawnEnemies(5);
  }

  // レベルシステムへの参照を設定
  public setLevelSystem(levelSystem: LevelSystem): void {
    this.levelSystem = levelSystem;
  }

  public update(deltaTime: number): void {
    // プレイヤーの位置を更新
    if (this.player) {
      const playerPosition = this.player.getPosition();
      
      // 敵の更新処理
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        const oldPosition = enemy.mesh.position.clone();
        
        // プレイヤーを視認しているかチェック
        const isDetected = this.checkPlayerDetection(enemy, playerPosition);
        
        // プレイヤーが視認範囲内の場合のみ、プレイヤーに向かって移動
        if (isDetected) {
          enemy.moveTowards(playerPosition, deltaTime);
          
          // 壁との衝突判定
          if (this.levelSystem) {
            const enemyBoundingBox = enemy.mesh.userData.boundingBox;
            if (this.levelSystem.checkWallCollision(enemyBoundingBox)) {
              // 壁と衝突している場合は位置を元に戻す
              enemy.mesh.position.copy(oldPosition);
              enemy.update(0); // バウンディングボックスを更新
            }
          }
        }
        
        // 敵の更新
        enemy.update(deltaTime);
        
        // 敵の死亡判定
        if (enemy.health <= 0) {
          // 敵を削除
          this.scene.remove(enemy.mesh);
          // 視認範囲の可視化メッシュがあればそれも削除
          enemy.removeDetectionRangeFromScene(this.scene);
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

  // プレイヤーの視認チェック（視線が通るかどうか）
  private checkPlayerDetection(enemy: Enemy, playerPosition: THREE.Vector3): boolean {
    // 敵からプレイヤーへの距離をチェック
    const distance = enemy.mesh.position.distanceTo(playerPosition);
    
    // 距離が視認範囲外なら即座にfalseを返す
    if (distance > enemy.detectionRange) {
      enemy.isPlayerDetected = false;
      return false;
    }
    
    // 視線チェック（壁が遮っていないか）
    if (this.levelSystem) {
      // 敵からプレイヤーへの方向ベクトルを計算
      const direction = new THREE.Vector3()
        .subVectors(playerPosition, enemy.getPosition())
        .normalize();
      
      // レイキャスターを設定
      this.raycaster.set(enemy.getPosition(), direction);
      
      // 壁との交差をチェック
      const walls = this.levelSystem.getWalls();
      const intersections = this.raycaster.intersectObjects(walls);
      
      // 交差があり、その距離がプレイヤーまでの距離より短い場合、視線が遮られている
      if (intersections.length > 0 && intersections[0].distance < distance) {
        enemy.isPlayerDetected = false;
        return false;
      }
    }
    
    // 視認範囲内で、視線も通っている場合はプレイヤーを検知
    enemy.isPlayerDetected = true;
    return true;
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
      
      // 壁と衝突していないか確認
      if (this.levelSystem) {
        enemy.update(0); // バウンディングボックスを更新
        if (this.levelSystem.checkWallCollision(enemy.mesh.userData.boundingBox)) {
          // 壁と衝突している場合は生成しない
          enemy.dispose();
          continue;
        }
      }
      
      // シーンに追加
      this.scene.add(enemy.mesh);
      this.enemies.push(enemy);
      
      // 視認範囲の可視化が有効なら視認範囲メッシュも表示
      if (this.isDetectionRangeVisible) {
        enemy.addDetectionRangeToScene(this.scene);
      }
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

  // 視認範囲の表示/非表示を切り替え
  public toggleDetectionRanges(): void {
    this.isDetectionRangeVisible = !this.isDetectionRangeVisible;
    
    for (const enemy of this.enemies) {
      if (this.isDetectionRangeVisible) {
        enemy.addDetectionRangeToScene(this.scene);
      } else {
        enemy.removeDetectionRangeFromScene(this.scene);
      }
    }
    
    console.log(`敵の視認範囲表示: ${this.isDetectionRangeVisible ? 'オン' : 'オフ'}`);
  }

  // 視認範囲の表示状態を取得
  public getDetectionRangeVisibility(): boolean {
    return this.isDetectionRangeVisible;
  }

  // リソースの解放
  public dispose(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.mesh);
      enemy.removeDetectionRangeFromScene(this.scene);
      enemy.dispose();
    }
    this.enemies = [];
  }
}