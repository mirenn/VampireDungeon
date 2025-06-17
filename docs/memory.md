# 実装予定：AAモーション & 弾丸システム

## 1. AAモーション実装 🎯 実装予定

### 基本仕様

- **AAモーション時間**: 0.3秒（攻撃開始から弾丸発射まで）
- **モーション中の制約**: 移動入力でAAキャンセル
- **視覚表現**: プレイヤーが敵の方向を向き、攻撃ポーズを取る

### 実装する状態管理

```typescript
// Player.ts に追加
private isAttacking: boolean = false;
private attackStartTime: number = 0;
private attackMotionDuration: number = 0.3; // 0.3秒
private attackTarget: Enemy | null = null;
private originalRotation: number = 0; // モーション後に元の回転に戻すため
```

### AAモーション段階

1. **攻撃開始**: `startAttackMotion(target: Enemy)`
   - プレイヤーを敵の方向に向ける
   - `isAttacking = true`
   - 移動を無効化
2. **モーション中**: `updateAttackMotion(deltaTime: number)`

   - 移動入力チェック → 入力があればキャンセル
   - 0.3秒経過 → 弾丸発射

3. **モーション完了**: `completeAttackMotion()`
   - 弾丸生成・発射
   - `isAttacking = false`
   - 移動再有効化

## 2. 弾丸システム実装 💫 実装予定

### 弾丸クラス設計

```typescript
// 新規ファイル: src/game/entities/Projectile.ts
export class Projectile {
  private mesh: THREE.Mesh;
  private startPosition: THREE.Vector3;
  private targetPosition: THREE.Vector3;
  private speed: number = 15; // 弾丸速度
  private damage: number;
  private targetEnemy: Enemy;
  private traveled: number = 0;
  private totalDistance: number;

  constructor(start: THREE.Vector3, target: Enemy, damage: number);
  public update(deltaTime: number): boolean; // true: 到達, false: 飛行中
  public destroy(): void;
}
```

### 弾丸の視覚表現

- **形状**: 小さな光る球体（半径0.1）
- **色**: 青白い光（emissive material）
- **エフェクト**: 軌跡パーティクル（オプション）

### 弾丸システム管理

```typescript
// 新規ファイル: src/game/systems/ProjectileSystem.ts
export class ProjectileSystem {
  private projectiles: Projectile[] = [];
  private scene: THREE.Scene;

  public createProjectile(
    start: THREE.Vector3,
    target: Enemy,
    damage: number,
  ): void;
  public update(deltaTime: number): void; // 全弾丸の更新・衝突判定
  public removeProjectile(projectile: Projectile): void;
}
```

## 3. 統合実装内容

### Player.ts 修正点

```typescript
// 既存のperformAutoAttack()を2段階に分割
public startAutoAttack(target: Enemy): boolean // AAモーション開始
private fireProjectile(): void // 弾丸発射（モーション完了時）

// 移動処理にAAキャンセル判定を追加
public move(direction: THREE.Vector3): void {
  if (this.isAttacking) {
    this.cancelAttack(); // AAキャンセル
  }
  // ...既存の移動処理
}

private cancelAttack(): void // AAモーションキャンセル
```

### PlayerSystem.ts 修正点

- AAモーション中の移動入力検出
- ProjectileSystemとの連携
- AAモーション更新処理追加

### GameManager.ts 修正点

- ProjectileSystemの追加・初期化
- 各システム間の更新順序調整

## 4. 実装順序 📋

1. **Projectileクラス作成**

   - 弾丸の基本動作（移動・衝突判定）
   - 視覚表現（メッシュ・マテリアル）

2. **ProjectileSystem作成**

   - 弾丸管理システム
   - GameManagerとの統合

3. **Player.ts AAモーション実装**

   - 状態管理の追加
   - モーション段階の実装

4. **PlayerSystem.ts 修正**

   - AAモーション更新処理
   - 移動入力キャンセル判定

5. **統合テスト・調整**
   - モーション時間の調整
   - 弾丸速度・視覚効果の調整

## 5. 技術仕様詳細

### 座標計算

- **弾丸軌道**: 直線補間（LERP）
- **方向計算**: `target.position - player.position`の正規化
- **衝突判定**: 弾丸位置と敵位置の距離チェック（閾値: 0.3）

### パフォーマンス考慮

- 弾丸の最大同時数制限（20発）
- 画面外弾丸の自動削除
- オブジェクトプールの活用（将来的に）
