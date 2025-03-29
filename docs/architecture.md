# Vampire Dungeon - 開発ドキュメント

このドキュメントは、Vampire Dungeonの開発者向けに、プロジェクトの内部設計や構造を説明するものです。

## アーキテクチャ概要

このプロジェクトは以下の主要なコンポーネントで構成されています：

1. **Three.js レンダリングエンジン** - 3Dグラフィックスの描画
2. **ゲームエンティティシステム** - プレイヤー、敵、アイテムなどのゲーム要素
3. **ゲームシステム** - 各機能の制御（敵AI、アイテム管理、レベル生成など）
4. **物理・衝突システム** - 壁や障害物との衝突判定、視線判定など
5. **React UI** - ゲーム情報の表示インターフェース

## プロジェクト構造
```
src/
  ├─ main.tsx           # アプリケーションのエントリーポイント
  ├─ App.tsx           # メインのReactコンポーネント
  ├─ assets/           # 画像、モデル、テクスチャなどのリソース
  ├─ components/       # Reactコンポーネント
  │   └─ UI.tsx       # ゲーム内UI
  ├─ game/            # ゲームのコア機能
  │   ├─ GameManager.ts   # ゲーム全体の管理
  │   ├─ entities/    # ゲーム内のエンティティ
  │   │   ├─ Enemy.ts    # 敵の実装
  │   │   ├─ Item.ts     # アイテムの実装
  │   │   └─ Player.ts   # プレイヤーの実装
  │   └─ systems/     # ゲームシステム
  │       ├─ EnemySystem.ts   # 敵の管理
  │       ├─ ItemSystem.ts    # アイテムの管理
  │       ├─ LevelSystem.ts   # レベルの生成と管理
  │       └─ PlayerSystem.ts  # プレイヤーの入力と状態管理
  └─ styles/          # CSSスタイル
      ├─ App.css     # アプリケーション全体のスタイル
      ├─ index.css   # グローバルスタイル
      └─ UI.css      # UI用のスタイル
```

## クラス設計

### GameManager

`GameManager`はゲーム全体を管理する中核クラスで、以下の責務を持ちます：

- Three.jsのシーン、カメラ、レンダラーの初期化と管理
- 各システム（プレイヤー、敵、アイテム、レベル）の初期化と統合
- システム間の参照設定（PlayerSystemにLevelSystemを渡すなど）
- ゲームループの制御
- リソースの管理とクリーンアップ

```typescript
// GameManager.ts の主要インターフェース
export class GameManager {
  constructor(container: HTMLElement);
  public init(): void;
  public start(): void;
  public stop(): void;
  public dispose(): void;
}
```

### エンティティクラス

ゲーム内のオブジェクトを表現するクラスです。

#### Player

プレイヤーキャラクターを表現し、以下の機能を持ちます：

- 移動とアニメーション
- ステータス管理（体力、経験値など）
- 武器とアイテムの管理

```typescript
// Player.ts の主要インターフェース
export class Player {
  public mesh: THREE.Object3D;
  public health: number;
  public maxHealth: number;
  public speed: number;
  public attackPower: number;
  public attackSpeed: number;
  public attackRange: number;
  public experience: number;
  public level: number;

  constructor();
  public update(deltaTime: number): void;
  public moveForward(distance: number): void;
  public moveBackward(distance: number): void;
  public moveLeft(distance: number): void;
  public moveRight(distance: number): void;
  public moveInDirection(direction: THREE.Vector3, distance: number): void;
  public attack(): boolean;
  public takeDamage(amount: number): void;
  public heal(amount: number): void;
  public gainExperience(amount: number): boolean;
  public addWeapon(weaponId: string): void;
  public addItem(itemId: string): void;
  public getPosition(): THREE.Vector3;
  public getDirection(): THREE.Vector3;
  public dispose(): void;
}
```

#### Enemy

敵キャラクターを表現し、以下の機能を持ちます：

- プレイヤーへの追跡AI
- 視認範囲と視認状態の管理
- 攻撃と体力システム
- ドロップアイテム

```typescript
// Enemy.ts の主要インターフェース
export class Enemy {
  public mesh: THREE.Object3D;
  public health: number;
  public maxHealth: number;
  public damage: number;
  public speed: number;
  public experienceValue: number;
  public detectionRange: number;
  public isPlayerDetected: boolean;

  constructor();
  public update(deltaTime: number): void;
  public moveTowards(target: THREE.Vector3, deltaTime: number): void;
  public attack(): boolean;
  public takeDamage(amount: number): void;
  public getPosition(): THREE.Vector3;
  public addDetectionRangeToScene(scene: THREE.Scene): void;
  public removeDetectionRangeFromScene(scene: THREE.Scene): void;
  public toggleDetectionRange(scene: THREE.Scene): void;
  public dispose(): void;
}
```

#### Item

ゲーム内のアイテムを表現し、以下の機能を持ちます：

- 各種アイテムタイプ（回復、武器、スピード、パワー）
- 視覚効果（回転、浮動アニメーション）

```typescript
// Item.ts の主要インターフェース
export type ItemType = 'health' | 'weapon' | 'speed' | 'power';

export class Item {
  public mesh: THREE.Object3D;
  public type: ItemType;

  constructor(type: ItemType);
  public update(deltaTime: number): void;
  public getPosition(): THREE.Vector3;
  public dispose(): void;
}
```

### システムクラス

ゲームの各機能を管理するシステムクラスです。

#### PlayerSystem

プレイヤーの入力処理と状態管理を担当します：

```typescript
// PlayerSystem.ts の主要インターフェース
export class PlayerSystem {
  constructor(scene: THREE.Scene, camera: THREE.Camera);
  public init(): void;
  public update(deltaTime: number): void;
  public setLevelSystem(levelSystem: LevelSystem): void;
  public getPlayer(): Player | null;
  public dispose(): void;
}
```

#### EnemySystem

敵の生成、AI、状態管理を担当します：

```typescript
// EnemySystem.ts の主要インターフェース
export class EnemySystem {
  constructor(scene: THREE.Scene);
  public init(): void;
  public update(deltaTime: number): void;
  public spawnEnemies(count: number): void;
  public setPlayer(player: Player): void;
  public setLevelSystem(levelSystem: LevelSystem): void;
  public getEnemies(): Enemy[];
  public toggleDetectionRanges(): void;
  public getDetectionRangeVisibility(): boolean;
  public dispose(): void;
}
```

#### ItemSystem

アイテムの生成、収集、効果適用を担当します：

```typescript
// ItemSystem.ts の主要インターフェース
export class ItemSystem {
  constructor(scene: THREE.Scene);
  public init(): void;
  public update(deltaTime: number): void;
  public spawnItem(position: THREE.Vector3): void;
  public setPlayer(player: Player): void;
  public getItems(): Item[];
  public dispose(): void;
}
```

#### LevelSystem

階層の生成と管理を担当します：

```typescript
// LevelSystem.ts の主要インターフェース
export class LevelSystem {
  constructor(scene: THREE.Scene);
  public init(): void;
  public update(deltaTime: number): void;
  public loadLevel(level: number): void;
  public checkExitCollision(boundingBox: THREE.Box3): boolean;
  public checkWallCollision(boundingBox: THREE.Box3): boolean;
  public getWalls(): THREE.Object3D[];
  public getCurrentLevel(): number;
  public dispose(): void;
}
```

## 物理・衝突システム

### バウンディングボックスによる衝突判定

各ゲームオブジェクト（プレイヤー、敵、壁など）は`THREE.Box3`のバウンディングボックスを持ち、衝突判定に使用します。

```typescript
// バウンディングボックスの作成と更新
this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);

// 衝突判定の例
if (this.levelSystem.checkWallCollision(playerBoundingBox)) {
  // 衝突時の処理（元の位置に戻すなど）
  this.player.mesh.position.copy(oldPosition);
}
```

### 敵の視線判定システム

敵がプレイヤーを視認できるかどうかを判定するシステムは、レイキャスティングを使用して実装されています。

```typescript
// 視線判定の概略（EnemySystem内）
private checkPlayerDetection(enemy: Enemy, playerPosition: THREE.Vector3): boolean {
  // 距離チェック
  const distance = enemy.mesh.position.distanceTo(playerPosition);
  if (distance > enemy.detectionRange) return false;
  
  // 視線チェック
  const direction = playerPosition.clone().sub(enemy.getPosition()).normalize();
  this.raycaster.set(enemy.getPosition(), direction);
  
  // 壁との交差をチェック
  const intersections = this.raycaster.intersectObjects(this.levelSystem.getWalls());
  if (intersections.length > 0 && intersections[0].distance < distance) {
    return false;  // 視線が壁に遮られている
  }
  
  return true;  // 視認可能
}
```

### 視覚的なデバッグ支援

敵の視認範囲は視覚的に表示できるようになっており、以下の色で状態を示します：

- 黄色: プレイヤーを検知していない状態
- 赤色: プレイヤーを検知している状態

これにより、壁による視線の遮断が視覚的に確認できます。

## システム間の連携

GameManagerは、各システム間の連携を以下のように管理しています：

```typescript
// システム間連携の例（GameManager.init()内）
this.playerSystem.setLevelSystem(this.levelSystem);
this.enemySystem.setPlayer(player);
this.enemySystem.setLevelSystem(this.levelSystem);
this.itemSystem.setPlayer(player);
```

このように依存関係を注入することで、各システムは必要な情報を取得し、互いに協調して機能します。

## React UI コンポーネント

ゲーム情報を表示するReactコンポーネントです：

```typescript
// UI.tsx の主要インターフェース
const UI: React.FC<UIProps> = () => {
  // ステータス表示（体力、経験値など）
  // 武器・アイテム表示
  // ダンジョンレベル表示
}
```

## ゲームの初期化フロー

1. Reactアプリケーションがマウントされる
2. `App`コンポーネントがレンダリングされる
3. `useEffect`内で`GameManager`がインスタンス化される
4. `GameManager.init()`が各システムを初期化
   - LevelSystemが初期化される
   - PlayerSystemが初期化される
   - EnemySystemが初期化される
   - システム間の参照が設定される
5. `GameManager.start()`がゲームループを開始

## データフロー

1. ユーザー入力（キーボード、マウス）→ `PlayerSystem` → `Player`の移動
2. `Player`移動 → `LevelSystem.checkWallCollision()` → 衝突判定と位置修正
3. `EnemySystem.update()` → 敵の視線判定と移動 → `LevelSystem.checkWallCollision()` → 衝突判定
4. ゲームループの各フレーム：
   - `GameManager`が各システムの`update`メソッドを呼び出す
   - 各システムが関連エンティティを更新
   - 衝突検出と相互作用の処理
   - UIの更新（React状態の更新）
   - Three.jsによるシーンのレンダリング

## 拡張方法

### 新しい敵タイプの追加

1. `Enemy.ts`を拡張するか新しいクラスを作成
2. `EnemySystem`に新しい敵タイプの生成ロジックを追加

### 新しいアイテムタイプの追加

1. `Item.ts`の`ItemType`を拡張
2. `ItemSystem.applyItemEffect`に新しい効果を追加

### 新しい武器システムの追加

1. 新しい`Weapon`クラスの作成
2. `Player`クラスに武器管理メソッドを追加
3. 攻撃ロジックの実装

### 衝突判定の拡張

1. 新しい衝突タイプの追加には、対応するバウンディングボックスとチェックメソッドを作成
2. `LevelSystem`に新たな衝突判定メソッドを追加
3. 該当するシステムクラスで新しい衝突判定を利用

## パフォーマンス最適化

- オブジェクトプーリングの使用（敵、アイテムなど）
- 空間分割による衝突判定の最適化
- レベルのチャンク分割
- LOD（Level of Detail）システムの実装
- シェーダーの最適化

## 既知の課題と今後の対応

1. 対角線上の壁の衝突判定の最適化
2. パスファインディングAIの実装（敵が障害物を迂回する）
3. モバイル対応
4. セーブ/ロードシステムの実装
5. サウンドシステムの追加

## ビルドと展開

```bash
# 開発ビルド
npm run dev

# 本番ビルド
npm run build

# ビルドのプレビュー
npm run preview
```

ビルドされたファイルは`dist`ディレクトリに出力されます。