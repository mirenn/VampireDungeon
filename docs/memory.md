# 実装完了：左クリックオートアタック & パッシブスキル

## 1. 左クリックオートアタック機能 ✅ 完了

- **実装内容**:
  - PlayerSystemにleft-clickイベントリスナーを追加 ✅
  - クリック位置の敵検出（Raycaster使用） ✅
  - 最も近い敵への自動攻撃実行 ✅
  - 攻撃範囲内チェック（Player.attackRange: 2） ✅
  - 攻撃クールダウン管理（Player.attackSpeed: 1から計算） ✅

## 2. 主人公のパッシブスキル実装 ✅ 完了

- **パッシブ名**: 「ハンターの本能」
- **実装された効果**:
  1. 初めて攻撃する敵への攻撃時: 移動速度20%上昇 ✅
  2. 同一敵への5回攻撃時: 移動速度20%上昇 ✅
  3. ボーナス持続時間：5秒 ✅
  4. ボーナス延長：継続中の追加取得で延長 ✅
  5. スタック可能（最大5スタック = 100%まで） ✅

## 3. 実装されたデータ構造とメソッド

### Player.tsに追加されたプロパティ:
```typescript
// オートアタック関連
private autoAttackTarget: any | null = null;
private lastAutoAttackTime: number = 0;

// パッシブスキル関連
private attackedEnemies: Map<string, number> = new Map();
private speedBonusStacks: number = 0;
private speedBonusEndTime: number = 0;
private baseSpeed: number = 5;
```

### 追加されたメソッド:
```typescript
// オートアタック
public performAutoAttack(target: any): boolean
public findNearestEnemy(enemies: any[]): any | null

// パッシブスキル
private checkPassiveBonus(enemyId: string): void
private updateSpeedBonus(deltaTime: number): void
private addSpeedBonus(): void
private recalculateSpeed(): void
public getSpeedBonusInfo(): object
```

## 4. UI更新 ✅ 完了

- パッシブスキル「ハンターの本能」の視覚表示
- スタック数と残り時間の表示
- 金色の光るエフェクト付きUI

## 5. 使用方法

1. **左クリック**: 敵をクリックするか、空いている場所をクリックして最も近い敵を攻撃
2. **パッシブ効果**: 
   - 新しい敵への初回攻撃で移動速度ボーナス
   - 同じ敵への5回目攻撃で追加ボーナス
   - 最大5スタック（100%移動速度上昇）まで蓄積可能

## 3. 実装が必要な新規データ構造

### Player.tsに追加すべきプロパティ:

```typescript
// オートアタック関連
private autoAttackTarget: Enemy | null = null;
private lastAutoAttackTime: number = 0;

// パッシブスキル関連
private attackedEnemies: Map<string, number> = new Map(); // 敵ID -> 攻撃回数
private speedBonusStacks: number = 0; // 移動速度ボーナススタック数
private speedBonusEndTime: number = 0; // ボーナス終了時間
private baseSpeed: number = 5; // 基本移動速度（現在のspeed値を保存）
```

### 新規メソッド:

```typescript
// オートアタック
public performAutoAttack(target: Enemy): boolean
private findNearestEnemy(enemies: Enemy[]): Enemy | null

// パッシブスキル
private checkPassiveBonus(enemyId: string): void
private updateSpeedBonus(deltaTime: number): void
private addSpeedBonus(): void
private recalculateSpeed(): void
```

## 4. システム連携

- **PlayerSystem**: マウスクリック処理とレイキャスト
- **EnemySystem**: 敵リスト提供とダメージ処理連携
- **GameManager**: システム間の橋渡し

## 5. UI更新

- 移動速度ボーナスの視覚表示（UI.tsx）
- パッシブスキル情報の表示

## 6. 実装順序

1. 左クリックイベント処理追加
2. オートアタック基本機能
3. パッシブスキルデータ構造追加
4. パッシブスキル効果実装
5. UI更新
6. テスト・デバッグ
