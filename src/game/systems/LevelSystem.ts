import * as THREE from 'three';
import { Tombstone } from '../entities/Tombstone';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// 生成されたレベルパターンファイルをインポート
import {
  walls as level1Walls,
  floors as level1Floors,
  tombstones as level1Tombstones,
  playerSpawn as level1PlayerSpawn,
  stairs as level1Stairs,
} from './level-patterns/1/1-1'; // floors をインポート
import {
  walls as level2Walls,
  floors as level2Floors, // タイポを修正: leve21Floors -> level2Floors
  tombstones as level2Tombstones,
  playerSpawn as level2PlayerSpawn,
  stairs as level2Stairs,
} from './level-patterns/2/2-1';
import {
  walls as level3Walls,
  floors as level3Floors,
  tombstones as level3Tombstones,
  playerSpawn as level3PlayerSpawn,
  stairs as level3Stairs,
  blackMages as level3BlackMages,
} from './level-patterns/3/3-1'; // floors をインポート
// タイルの座標を表すインターフェース (generateLevelPattern.ts と共通化推奨)
interface TilePosition {
  x: number;
  y: number;
}

interface MapPattern {
  walls: { x: number; y: number; width: number; height: number }[];
  floors: TilePosition[];
  stairs: { x: number; y: number; toLevel: number };
  playerSpawn?: { x: number; y: number };
  tombstones?: TilePosition[];
  blackMages?: TilePosition[];
}

const FLOOR_PATTERNS: { [key: number]: MapPattern } = {
  1: {
    walls: level1Walls,
    floors: level1Floors,
    stairs: { x: level1Stairs.x, y: level1Stairs.y, toLevel: 2 },
    playerSpawn: level1PlayerSpawn,
    tombstones: level1Tombstones,
  },
  2: {
    // TODO: Level 2 の floors データを生成・インポートする
    walls: level2Walls, // インポートされた値を使用
    floors: level2Floors, // インポートされた値を使用
    stairs: { x: level2Stairs.x, y: level2Stairs.y, toLevel: 3 }, // インポートされた値を使用
    playerSpawn: level2PlayerSpawn, // インポートされた値を使用
    tombstones: level2Tombstones, // インポートされた値を使用
  },
  3: {
    // インポートされたデータを使用
    walls: level3Walls,
    floors: level3Floors,
    stairs: { x: level3Stairs.x, y: level3Stairs.y, toLevel: -1 }, // -1は最終階層を示す
    playerSpawn: level3PlayerSpawn,
    tombstones: level3Tombstones,
    blackMages: level3BlackMages, // ブラックメイジのデータを追加
  },
};

export class LevelSystem {
  private scene: THREE.Scene;
  private currentLevel: number = 1;
  private walls: THREE.Mesh[] = [];
  private floorTiles: TilePosition[] = []; // 床タイルの座標を保持する配列
  private stairs?: THREE.Mesh;
  private wallMaterial: THREE.Material;
  private stairsMaterial: THREE.Material;
  private tombstones: Tombstone[] = [];
  private gltfLoader: GLTFLoader;
  private tombstoneGLTF?: THREE.Group;

  // 墓石破壊時のナビメッシュ更新用コールバック
  public onTombstoneDestroyed?: (x: number, y: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    this.stairsMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    this.gltfLoader = new GLTFLoader();
    // 事前に墓石モデルを非同期で読み込む
    this.gltfLoader.load(
      '/src/assets/tombstone/glTF/scene.gltf',
      (gltf) => {
        this.tombstoneGLTF = gltf.scene;
        // 墓石モデルのロード完了後にレベルを初期化
        this.loadLevel(1);
      },
      undefined,
      (error) => {
        console.error('墓石モデルの読み込みに失敗しました:', error);
      },
    );
  }

  public init(): void {
    // 何もしない（ロード完了時にloadLevelを呼ぶ）
  }

  public loadLevel(level: number): void {
    // 現在のレベルをクリア
    this.clearLevel();

    if (!FLOOR_PATTERNS[level]) {
      console.error(`Level ${level} does not exist`);
      return;
    }

    this.currentLevel = level;
    const pattern = FLOOR_PATTERNS[level];

    // 床タイルデータの読み込み
    this.floorTiles = pattern.floors; // パターンから床タイルデータを取得

    // 壁の生成
    pattern.walls.forEach((wall) => {
      const geometry = new THREE.BoxGeometry(wall.width, 2.5, wall.height); // 壁の高さは 2.5
      const mesh = new THREE.Mesh(geometry, this.wallMaterial);
      // メッシュの中心 Y 座標を高さの半分 (1.25) に設定し、底面が Y=0 になるようにする
      mesh.position.set(
        wall.x + wall.width / 2,
        1.25,
        wall.y + wall.height / 2,
      );
      this.walls.push(mesh);
      this.scene.add(mesh);
    });

    // 階段の生成
    const stairsGeometry = new THREE.BoxGeometry(4, 0.5, 4);
    this.stairs = new THREE.Mesh(stairsGeometry, this.stairsMaterial);
    this.stairs.position.set(pattern.stairs.x, 0.25, pattern.stairs.y);
    this.scene.add(this.stairs);

    // 墓石の生成
    this.tombstones = [];
    if (pattern.tombstones) {
      pattern.tombstones.forEach((pos) => {
        const tombstone = new Tombstone(pos.x, pos.y);
        this.tombstones.push(tombstone);
        // 3Dモデルの生成・シーンへの追加
        let mesh: THREE.Object3D;
        if (this.tombstoneGLTF) {
          mesh = this.tombstoneGLTF.clone();
          mesh.position.set(pos.x + 0.5, 0, pos.y + 0.5);
          mesh.scale.set(2, 5, 2.5); // 10倍の半分（5倍相当）
        } else {
          // モデルがまだ読み込まれていない場合は仮のBox
          const geometry = new THREE.BoxGeometry(1, 1.5, 1);
          const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
          mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(pos.x + 0.5, 0.75, pos.y + 0.5);
        }
        mesh.name = 'tombstone';
        tombstone.mesh = mesh;
        this.scene.add(mesh);
        // 墓石破壊時のコールバックを設定
        tombstone.onDestroyed = () => {
          if (this.onTombstoneDestroyed) {
            this.onTombstoneDestroyed(tombstone.x, tombstone.y);
          }
        };
      });
    }
  }

  private clearLevel(): void {
    // 壁の削除
    this.walls.forEach((wall) => {
      this.scene.remove(wall);
      wall.geometry.dispose();
    });
    this.walls = [];

    // 床タイルデータのクリア
    this.floorTiles = [];

    // 階段の削除
    if (this.stairs) {
      this.scene.remove(this.stairs);
      this.stairs.geometry.dispose();
      this.stairs = undefined;
    }

    // 墓石の削除
    this.tombstones.forEach((tombstone) => {
      if (tombstone.mesh) {
        this.scene.remove(tombstone.mesh);
        if (tombstone.mesh instanceof THREE.Mesh) {
          tombstone.mesh.geometry?.dispose();
        }
      }
    });
    this.tombstones = [];
  }

  public checkWallCollision(boundingBox: THREE.Box3): boolean {
    const wallBoxes = this.walls.map((wall) =>
      new THREE.Box3().setFromObject(wall),
    );
    return wallBoxes.some((wallBox) => boundingBox.intersectsBox(wallBox));
  }

  public checkStairsCollision(boundingBox: THREE.Box3): {
    collides: boolean;
    nextLevel: number;
  } {
    if (!this.stairs) return { collides: false, nextLevel: this.currentLevel };

    const stairsBox = new THREE.Box3().setFromObject(this.stairs);
    const pattern = FLOOR_PATTERNS[this.currentLevel];

    return {
      collides: boundingBox.intersectsBox(stairsBox),
      nextLevel: pattern.stairs.toLevel,
    };
  }

  public checkExitCollision(boundingBox: THREE.Box3): boolean {
    if (!this.stairs) return false;
    const stairsBox = new THREE.Box3().setFromObject(this.stairs);
    return boundingBox.intersectsBox(stairsBox);
  }

  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  public getPlayerSpawnPosition(): THREE.Vector3 {
    const pattern = FLOOR_PATTERNS[this.currentLevel];
    if (pattern.playerSpawn) {
      const spawnPosition = new THREE.Vector3(
        pattern.playerSpawn.x,
        0,
        pattern.playerSpawn.y,
      );
      console.log(
        `Level ${this.currentLevel} Player Spawn Position from pattern:`,
        spawnPosition,
        `(using pattern.playerSpawn: { x: ${pattern.playerSpawn.x}, y: ${pattern.playerSpawn.y} })`, // 詳細情報を追加
      );
      return spawnPosition;
    }
    const defaultSpawnPosition = new THREE.Vector3(5, 0, 5);
    console.log(
      `Level ${this.currentLevel} Player Spawn Position:`,
      defaultSpawnPosition,
      '(Using default spawn because pattern.playerSpawn is not defined)', // 理由を明記
    );
    return defaultSpawnPosition; // デフォルトのスポーン位置
  }

  // 壁のメッシュを取得
  public getWalls(): THREE.Mesh[] {
    return this.walls;
  }

  // 床タイルの座標リストを取得
  public getFloorTiles(): TilePosition[] {
    return this.floorTiles;
  }

  // 墓石リスト取得用メソッド
  public getTombstones(): Tombstone[] {
    return this.tombstones;
  }

  public dispose(): void {
    this.clearLevel();
    this.wallMaterial.dispose();
    this.stairsMaterial.dispose();
  }
}
