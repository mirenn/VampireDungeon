import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PlayerSystem } from './systems/PlayerSystem';
import { EnemySystem } from './systems/EnemySystem';
import { ItemSystem } from './systems/ItemSystem';
import { LevelSystem } from './systems/LevelSystem';
import { PathFindingSystem } from './systems/PathFindingSystem';
import { Player } from './entities/Player';
import { Enemy } from './entities/Enemy'; // Enemyをインポート
import { JellySlime } from './entities/JellySlime'; // JellySlimeをインポート

export class GameManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera; // わずかにパースペクティブに変更
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls | null = null; // OrbitControlsをnullで初期化
  private clock: THREE.Clock;

  private playerSystem: PlayerSystem;
  private enemySystem: EnemySystem;
  private itemSystem: ItemSystem;
  private levelSystem: LevelSystem;
  private pathFindingSystem: PathFindingSystem;

  private isRunning: boolean = false;

  // デバッグ用の変数
  private showPathfindingDebug: boolean = false;
  private pathfindingDebugObject: THREE.Group | null = null;
  private debugLastPath: THREE.Vector3[] = [];

  // シャドウカメラのデバッグ用変数を追加
  private shadowCameraHelper: THREE.CameraHelper | null = null;
  private showShadowHelper: boolean = false;

  // キーボード入力の状態を管理
  private keysPressed: { [key: string]: boolean } = {};

  private navMeshData: number[][] = [];

  constructor(private container: HTMLElement) {
    // シーンの作成
    this.scene = new THREE.Scene();

    // カメラの作成（わずかにパースペクティブ）
    const aspect = window.innerWidth / window.innerHeight;
    const fov = 10;
    this.camera = new THREE.PerspectiveCamera(
      fov, // 視野角
      aspect, // アスペクト比
      0.1, // ニアクリップ
      1000, // ファークリップ
    );

    // カメラの初期位置を少し遠ざける
    this.camera.position.set(0, 30, 30);
    this.camera.lookAt(0, 0, 0);

    // レンダラーの作成
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControlsを使用しない（プレイヤー追従カメラを使用するため）
    // 右クリックでの移動機能を優先するため、コントロールは無効化

    // クロックの初期化
    this.clock = new THREE.Clock();

    // システムの初期化
    this.levelSystem = new LevelSystem(this.scene);
    this.playerSystem = new PlayerSystem(this.scene, this.camera);
    this.playerSystem.setLevelSystem(this.levelSystem); // LevelSystemを設定
    this.enemySystem = new EnemySystem(this.scene);
    this.itemSystem = new ItemSystem(this.scene);

    // パスファインディングシステムの初期化（LevelSystemに依存）
    this.pathFindingSystem = new PathFindingSystem(this.levelSystem);
    // EnemySystemにPathFindingSystemをセット
    this.enemySystem.setPathFindingSystem(this.pathFindingSystem);

    // イベントリスナーの設定
    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    // レベル遷移イベントのリスナーを追加
    window.addEventListener(
      'levelExit',
      this.onLevelExit.bind(this) as EventListener,
    );
  }

  // ゲームの初期化
  public init(): void {
    // 環境光の追加
    //const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    //this.scene.add(ambientLight);

    // 平行光源の追加（太陽光）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // シャドウカメラヘルパーを作成（初期状態では非表示）
    this.shadowCameraHelper = new THREE.CameraHelper(
      directionalLight.shadow.camera,
    );
    this.shadowCameraHelper.visible = this.showShadowHelper;
    this.scene.add(this.shadowCameraHelper);

    // 各システムの初期化
    this.levelSystem.init();
    this.playerSystem.init();
    this.enemySystem.init();
    this.itemSystem.init();

    // レベルの読み込み
    this.levelSystem.loadLevel(1);

    // 墓石破壊時のナビメッシュ更新コールバックを設定
    this.levelSystem.onTombstoneDestroyed = (x: number, y: number) => {
      if (
        this.navMeshData[y] &&
        typeof this.navMeshData[y][x] !== 'undefined'
      ) {
        this.navMeshData[y][x] = 1;
        this.pathFindingSystem.setNavMeshData(this.navMeshData);
      }
    };

    // レベルの床タイル、壁、墓石に基づいてナビメッシュを更新
    const floorTiles = this.levelSystem.getFloorTiles();
    const walls = this.levelSystem.getWalls();
    const tombstones = this.levelSystem.getTombstones();

    // 重複コードを排除し、PathFindingSystemのupdateNavMeshを使用
    this.navMeshData = this.pathFindingSystem.updateNavMesh(
      floorTiles,
      walls,
      tombstones,
    );
    console.log('ナビメッシュデータを初期化しました');

    // プレイヤーの参照をシステム間で共有
    const player = this.playerSystem.getPlayer();
    if (player) {
      this.enemySystem.setPlayer(player);
      this.itemSystem.setPlayer(player);

      // レベルシステムの参照を設定
      this.playerSystem.setLevelSystem(this.levelSystem);
      this.enemySystem.setLevelSystem(this.levelSystem);
      // パスファインディングシステムの参照を設定
      this.playerSystem.setPathFindingSystem(this.pathFindingSystem);
      // ここに追加: プレイヤー自身がPathFindingSystemを保持できるようにする
      player.setPathFindingSystem(this.pathFindingSystem);

      // EnemySystemの参照をPlayerSystemに設定
      this.playerSystem.setEnemySystem(this.enemySystem);

      // グローバルにプレイヤー情報を公開（UIコンポーネント用）
      (window as any).gamePlayer = player;
      (window as any).gameLevel = this.levelSystem.getCurrentLevel();
      // グローバルにGameManagerを公開（システム間の参照用）
      (window as any).gameManager = this;
    }
  }

  // ゲームの開始
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.clock.start();
    this.animate();
  }

  // ゲームの停止
  public stop(): void {
    this.isRunning = false;
    this.clock.stop();
  }

  // リソースの解放
  public dispose(): void {
    this.stop();

    // イベントリスナーの削除
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    window.removeEventListener(
      'levelExit',
      this.onLevelExit.bind(this) as EventListener,
    );

    // システムのクリーンアップ
    this.playerSystem.dispose();
    this.enemySystem.dispose();
    this.itemSystem.dispose();
    this.levelSystem.dispose();

    // Three.jsリソースの解放
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  // リサイズ対応
  private onWindowResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // キーダウンイベントハンドラ
  private onKeyDown(event: KeyboardEvent): void {
    this.keysPressed[event.key] = true;

    // Vキーで敵の視認範囲表示をトグル
    if (event.key === 'v' || event.key === 'V') {
      this.enemySystem.toggleDetectionRanges();
    }

    // Dキーでパスファインディングのデバッグビジュアライゼーションをトグル
    if (event.key === 'd' || event.key === 'D') {
      this.togglePathfindingDebug();
    }

    // Sキーでシャドウカメラヘルパーの表示/非表示を切り替え
    if (event.key === 's' || event.key === 'S') {
      this.toggleShadowHelper();
    }
  }

  // キーアップイベントハンドラ
  private onKeyUp(event: KeyboardEvent): void {
    this.keysPressed[event.key] = false;
  }

  // アニメーションループ
  private animate = (): void => {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();

    // 各システムの更新
    this.playerSystem.update(deltaTime);
    this.enemySystem.update(deltaTime);
    this.itemSystem.update(deltaTime);

    // シャドウカメラヘルパーの更新
    if (this.shadowCameraHelper && this.showShadowHelper) {
      this.shadowCameraHelper.update();
    }

    // コントロールの更新（使用していない場合は無視）
    if (this.controls) {
      this.controls.update();
    }

    // --- 衝突判定とダメージ処理 ---
    this.checkCollisions(deltaTime);
    // --- ここまで追加 ---

    // プレイヤーと階段の衝突判定（既存の処理は削除または無効化）
    // この部分はPlayerSystemのcheckExitCollisionと重複するため削除
    // PlayerSystemからイベントを受け取る形に変更したので、ここでの判定は不要

    // レンダリング
    this.renderer.render(this.scene, this.camera);
  };

  // --- ここから新しいメソッドを追加 ---
  // 衝突判定とダメージ処理を行うメソッド
  private checkCollisions(deltaTime: number): void {
    const player = this.playerSystem.getPlayer();
    if (!player) return;

    const playerPosition = player.getPosition();
    const playerBoundingBox = player.mesh.userData.boundingBox as THREE.Box3;

    const enemies = this.enemySystem.getEnemies();
    const enemiesToRemove: Enemy[] = []; // 削除対象の敵リスト

    enemies.forEach((enemy) => {
      const enemyPosition = enemy.getPosition();
      const enemyBoundingBox = enemy.mesh.userData.boundingBox as THREE.Box3;

      // 1. 敵からプレイヤーへの攻撃（体当たり）
      // if (
      //   playerBoundingBox &&
      //   enemyBoundingBox &&
      //   playerBoundingBox.intersectsBox(enemyBoundingBox)
      // ) {
      //   if (enemy.attack()) {
      //     console.log(
      //       `Player takes ${enemy.damage} damage from ${enemy.mesh.name}`,
      //     );
      //     player.takeDamage(enemy.damage);
      //     (window as any).dispatchEvent(new CustomEvent('playerDamaged')); // UI更新用イベント
      //   }
      // }
      // 2. プレイヤーから敵への攻撃は玉が当たった時に処理するため、このブロックは削除
      // 敵の体力が0以下になったかチェック
      if (enemy.health <= 0) {
        if (!enemiesToRemove.includes(enemy)) {
          console.log(`${enemy.mesh.name} defeated!`);
          enemiesToRemove.push(enemy);
        }
      }

      // 3. 敵の体力が0以下になったかチェック
      if (enemy.health <= 0 && !enemiesToRemove.includes(enemy)) {
        console.log(`${enemy.mesh.name} health reached zero.`);
        enemiesToRemove.push(enemy);
      }
    });

    // 削除対象の敵を処理
    enemiesToRemove.forEach((enemy) => {
      const grantExperience = !(
        enemy instanceof JellySlime && enemy.getSplitLevel() > 0
      );
      this.enemySystem.removeEnemy(enemy, grantExperience);
    });

    // プレイヤーの体力が0以下になった場合のゲームオーバー処理
    if (player.health <= 0) {
      console.log('Game Over!');
      this.stop();
      // TODO: ゲームオーバーUI表示などの処理を追加
    }
  }
  // --- ここまで新しいメソッドを追加 ---

  // レベル遷移イベント処理メソッドを追加
  private onLevelExit(event: CustomEvent): void {
    const nextLevel = event.detail.nextLevel;
    console.log(`レベル${nextLevel}へ進みます！`);

    // レベルを読み込む
    this.levelSystem.loadLevel(nextLevel);

    // プレイヤーの位置を新しいスポーン位置に設定
    const player = this.playerSystem.getPlayer();
    if (player) {
      const newPlayerSpawnPosition = this.levelSystem.getPlayerSpawnPosition();
      player.mesh.position.copy(newPlayerSpawnPosition);
      player.update(0); // バウンディングボックスを更新
    }

    // 新しいレベルの床タイル、壁、墓石でナビメッシュを更新
    const floorTiles = this.levelSystem.getFloorTiles();
    const walls = this.levelSystem.getWalls();
    const tombstones = this.levelSystem.getTombstones();

    this.navMeshData = this.pathFindingSystem.updateNavMesh(
      floorTiles,
      walls,
      tombstones,
    );

    // --- ここを追加: 新しいレベルの敵をスポーン ---
    this.enemySystem.spawnEnemiesForLevel(nextLevel);

    // グローバルレベル情報を更新（UI用）
    (window as any).gameLevel = nextLevel;
  }

  // パスファインディングデバッグビジュアライゼーションの表示切り替え
  private togglePathfindingDebug(): void {
    this.showPathfindingDebug = !this.showPathfindingDebug;
    console.log(
      `パスファインディングデバッグ表示: ${this.showPathfindingDebug ? 'オン' : 'オフ'}`,
    );

    if (this.showPathfindingDebug) {
      this.updatePathfindingDebugVisualization();
    } else {
      // デバッグオブジェクトを削除
      if (this.pathfindingDebugObject) {
        this.scene.remove(this.pathfindingDebugObject);
        this.pathfindingDebugObject = null;
      }
    }
  }

  // パスファインディングデバッグビジュアライゼーションの更新
  private updatePathfindingDebugVisualization(): void {
    // 前回のデバッグオブジェクトを削除
    if (this.pathfindingDebugObject) {
      this.scene.remove(this.pathfindingDebugObject);
    }

    // プレイヤーのパスを取得
    const playerPath = this.playerSystem.getCurrentPath();

    // プレイヤーの位置を取得
    const player = this.playerSystem.getPlayer();
    if (player) {
      // パスファインディングシステムからデバッグオブジェクトを生成
      this.pathfindingDebugObject =
        this.pathFindingSystem.createDebugVisualization(player.getPosition());
    }

    if (!this.pathfindingDebugObject) return;
    // シーンに追加
    this.scene.add(this.pathfindingDebugObject);

    // 最後のパスを記録
    this.debugLastPath = [...playerPath];
  }

  // シャドウカメラヘルパーの表示切り替え
  private toggleShadowHelper(): void {
    this.showShadowHelper = !this.showShadowHelper;
    if (this.shadowCameraHelper) {
      this.shadowCameraHelper.visible = this.showShadowHelper;
    }
    console.log(
      `シャドウカメラヘルパー: ${this.showShadowHelper ? 'オン' : 'オフ'}`,
    );
  }
}
