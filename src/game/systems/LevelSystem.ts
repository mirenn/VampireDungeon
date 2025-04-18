import * as THREE from 'three';

interface MapPattern {
  walls: { x: number; y: number; width: number; height: number }[];
  stairs: { x: number; y: number; toLevel: number };
  playerSpawn?: { x: number; y: number };
}

const FLOOR_PATTERNS: { [key: number]: MapPattern } = {
  1: {
    walls: [
      // 外周の壁
      { x: 0, y: 0, width: 50, height: 2 },    // 上壁
      { x: 0, y: 48, width: 50, height: 2 },   // 下壁
      { x: 0, y: 0, width: 2, height: 50 },    // 左壁
      { x: 48, y: 0, width: 2, height: 50 },   // 右壁
      // 内側の壁と柱
      { x: 20, y: 10, width: 2, height: 20 },  // 中央の縦壁
      { x: 10, y: 20, width: 20, height: 2 },  // 中央の横壁
    ],
    stairs: { x: 45, y: 45, toLevel: 2 },
    playerSpawn: { x: 10, y: 10 }  // 壁から十分離れた内側の位置に調整
  },
  2: {
    walls: [
      // 外周の壁
      { x: 0, y: 0, width: 60, height: 2 },
      { x: 0, y: 58, width: 60, height: 2 },
      { x: 0, y: 0, width: 2, height: 60 },
      { x: 58, y: 0, width: 2, height: 60 },
      // 迷路のような内部構造
      { x: 15, y: 15, width: 30, height: 2 },
      { x: 15, y: 15, width: 2, height: 30 },
      { x: 43, y: 15, width: 2, height: 30 },
      { x: 15, y: 43, width: 30, height: 2 },
    ],
    stairs: { x: 55, y: 55, toLevel: 3 },
    playerSpawn: { x: 20, y: 20 }  // 壁から十分離れた内側の位置に調整
  },
  3: {
    walls: [
      // 外周の壁（広いボス部屋）
      { x: 0, y: 0, width: 80, height: 2 },
      { x: 0, y: 78, width: 80, height: 2 },
      { x: 0, y: 0, width: 2, height: 80 },
      { x: 78, y: 0, width: 2, height: 80 },
      // 四隅の柱
      { x: 10, y: 10, width: 4, height: 4 },
      { x: 66, y: 10, width: 4, height: 4 },
      { x: 10, y: 66, width: 4, height: 4 },
      { x: 66, y: 66, width: 4, height: 4 },
    ],
    stairs: { x: 40, y: 40, toLevel: -1 }, // -1は最終階層を示す
    playerSpawn: { x: 25, y: 25 }  // 壁と柱から十分離れた内側の位置に調整
  }
};

export class LevelSystem {
  private scene: THREE.Scene;
  private currentLevel: number = 1;
  private walls: THREE.Mesh[] = [];
  private stairs?: THREE.Mesh;
  private wallMaterial: THREE.Material;
  private stairsMaterial: THREE.Material;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    this.stairsMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });
  }

  public init(): void {
    this.loadLevel(1);
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

    // 壁の生成
    pattern.walls.forEach(wall => {
      const geometry = new THREE.BoxGeometry(wall.width, 5, wall.height);
      const mesh = new THREE.Mesh(geometry, this.wallMaterial);
      mesh.position.set(wall.x + wall.width / 2, 2.5, wall.y + wall.height / 2);
      this.walls.push(mesh);
      this.scene.add(mesh);
    });

    // 階段の生成
    const stairsGeometry = new THREE.BoxGeometry(4, 0.5, 4);
    this.stairs = new THREE.Mesh(stairsGeometry, this.stairsMaterial);
    this.stairs.position.set(pattern.stairs.x, 0.25, pattern.stairs.y);
    this.scene.add(this.stairs);
  }

  private clearLevel(): void {
    // 壁の削除
    this.walls.forEach(wall => {
      this.scene.remove(wall);
      wall.geometry.dispose();
    });
    this.walls = [];

    // 階段の削除
    if (this.stairs) {
      this.scene.remove(this.stairs);
      this.stairs.geometry.dispose();
      this.stairs = undefined;
    }
  }

  public checkWallCollision(boundingBox: THREE.Box3): boolean {
    const wallBoxes = this.walls.map(wall => new THREE.Box3().setFromObject(wall));
    return wallBoxes.some(wallBox => boundingBox.intersectsBox(wallBox));
  }

  public checkStairsCollision(boundingBox: THREE.Box3): { collides: boolean; nextLevel: number } {
    if (!this.stairs) return { collides: false, nextLevel: this.currentLevel };
    
    const stairsBox = new THREE.Box3().setFromObject(this.stairs);
    const pattern = FLOOR_PATTERNS[this.currentLevel];
    
    return {
      collides: boundingBox.intersectsBox(stairsBox),
      nextLevel: pattern.stairs.toLevel
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
      const spawnPosition = new THREE.Vector3(pattern.playerSpawn.x, 0, pattern.playerSpawn.y);
      console.log(`Level ${this.currentLevel} Player Spawn Position:`, spawnPosition); // デバッグログを追加
      return spawnPosition;
    }
    const defaultSpawnPosition = new THREE.Vector3(5, 0, 5);
    console.log(`Level ${this.currentLevel} Player Spawn Position:`, defaultSpawnPosition, "(Using default)"); // デバッグログを追加
    return new THREE.Vector3(5, 0, 5); // デフォルトのスポーン位置
  }

  // 壁のメッシュを取得
  public getWalls(): THREE.Mesh[] {
    return this.walls;
  }

  public dispose(): void {
    this.clearLevel();
    this.wallMaterial.dispose();
    this.stairsMaterial.dispose();
  }
}