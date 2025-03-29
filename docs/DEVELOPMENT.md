# Vampire Dungeon - 開発ドキュメント

このドキュメントは、Vampire Dungeonの開発者向けに、プロジェクトの内部設計や構造を説明するものです。

## アーキテクチャ概要

このプロジェクトは以下の主要なコンポーネントで構成されています：

1. **Three.js レンダリングエンジン** - 3Dグラフィックスの描画
2. **ゲームエンティティシステム** - プレイヤー、敵、アイテムなどのゲーム要素
3. **ゲームシステム** - 各機能の制御（敵AI、アイテム管理、レベル生成など）
4. **React UI** - ゲーム情報の表示インターフェース

## クラス設計

### GameManager

`GameManager`はゲーム全体を管理する中核クラスで、以下の責務を持ちます：

- Three.jsのシーン、カメラ、レンダラーの初期化と管理
- 各システム（プレイヤー、敵、アイテム、レベル）の初期化と統合
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
- レベルアップシステム
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

  constructor();
  public update(deltaTime: number): void;
  public moveTowards(target: THREE.Vector3, deltaTime: number): void;
  public attack(): boolean;
  public takeDamage(amount: number): void;
  public getPosition(): THREE.Vector3;
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
  constructor(scene: THREE.Scene);
  public init(): void;
  public update(deltaTime: number): void;
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
  public getEnemies(): Enemy[];
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

レベルの生成と管理を担当します：

```typescript
// LevelSystem.ts の主要インターフェース
export class LevelSystem {
  constructor(scene: THREE.Scene);
  public init(): void;
  public update(deltaTime: number): void;
  public loadLevel(level: number): void;
  public checkExitCollision(boundingBox: THREE.Box3): boolean;
  public checkWallCollision(boundingBox: THREE.Box3): boolean;
  public getCurrentLevel(): number;
  public dispose(): void;
}
```

## React UI コンポーネント

ゲーム情報を表示するReactコンポーネントです：

```typescript
// UI.tsx の主要インターフェース
const UI: React.FC<UIProps> = () => {
  // ステータス表示（体力、経験値、レベルなど）
  // 武器・アイテム表示
  // ダンジョンレベル表示
}
```

## ゲームの初期化フロー

1. Reactアプリケーションがマウントされる
2. `App`コンポーネントがレンダリングされる
3. `useEffect`内で`GameManager`がインスタンス化される
4. `GameManager.init()`が各システムを初期化
5. `GameManager.start()`がゲームループを開始

## データフロー

1. ユーザー入力（キーボード）→ `PlayerSystem` → `Player`の移動
2. ゲームループの各フレーム：
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

## パフォーマンス最適化

- オブジェクトプーリングの使用（敵、アイテムなど）
- レベルのチャンク分割
- LOD（Level of Detail）システムの実装
- シェーダーの最適化

## 既知の課題と今後の対応

1. 衝突判定の最適化
2. モバイル対応
3. セーブ/ロードシステムの実装
4. サウンドシステムの追加

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