import * as THREE from 'three';

export class LevelSystem {
  private currentLevel: number = 0;
  private levelObjects: THREE.Object3D[] = [];
  private walls: THREE.Object3D[] = [];
  private exits: THREE.Object3D[] = [];

  constructor(private scene: THREE.Scene) {}

  public init(): void {
    // 初期化処理
  }

  public update(deltaTime: number): void {
    // レベル関連の更新処理
  }

  // 新しいレベルを読み込む
  public loadLevel(level: number): void {
    // 前のレベルをクリア
    this.clearLevel();
    
    this.currentLevel = level;
    console.log(`Loading level ${level}`);
    
    // レベルの作成
    this.generateLevel(level);
  }

  // 現在のレベルをクリア
  private clearLevel(): void {
    // レベルオブジェクトを削除
    for (const obj of this.levelObjects) {
      this.scene.remove(obj);
      this.disposeObject(obj);
    }
    this.levelObjects = [];
    this.walls = [];
    this.exits = [];
  }

  // レベルを生成
  private generateLevel(level: number): void {
    // 壁の色を決定（レベルによって変化）
    const wallColor = new THREE.Color(0.2 + level * 0.05, 0.2, 0.3 + level * 0.05);
    
    // 壁のマテリアル
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.7,
      metalness: 0.2
    });
    
    // ダンジョンのサイズ（レベルによって大きくなる）
    const size = 20 + level * 5;
    const wallHeight = 4;
    
    // 外周の壁を作成
    const createWall = (x: number, z: number, width: number, depth: number) => {
      const wallGeometry = new THREE.BoxGeometry(width, wallHeight, depth);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(x, wallHeight / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      
      this.scene.add(wall);
      this.levelObjects.push(wall);
      this.walls.push(wall);
      
      // 衝突判定用のバウンディングボックス
      wall.userData.boundingBox = new THREE.Box3().setFromObject(wall);
    };
    
    // 外周の壁
    createWall(0, -size / 2, size, 1);  // 北
    createWall(0, size / 2, size, 1);   // 南
    createWall(-size / 2, 0, 1, size);  // 西
    createWall(size / 2, 0, 1, size);   // 東
    
    // 出口を作成（次のレベルへ）
    const exitGeometry = new THREE.BoxGeometry(3, 0.1, 3);
    const exitMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x003300,
      roughness: 0.3,
      metalness: 0.7
    });
    
    const exit = new THREE.Mesh(exitGeometry, exitMaterial);
    exit.position.set(size / 2 - 5, 0.05, size / 2 - 5);
    this.scene.add(exit);
    this.levelObjects.push(exit);
    this.exits.push(exit);
    
    // レベル内の障害物（レベルによって数が増える）
    const obstacles = Math.min(5 + level * 2, 20);
    for (let i = 0; i < obstacles; i++) {
      // ランダムなサイズと位置
      const obstacleWidth = 1 + Math.random() * 3;
      const obstacleDepth = 1 + Math.random() * 3;
      
      // プレイヤーのスタート位置は障害物で塞がないように
      let x, z;
      do {
        x = Math.random() * (size - 10) - (size / 2 - 5);
        z = Math.random() * (size - 10) - (size / 2 - 5);
      } while (Math.abs(x) < 5 && Math.abs(z) < 5);
      
      createWall(x, z, obstacleWidth, obstacleDepth);
    }
  }

  // 出口と衝突判定
  public checkExitCollision(boundingBox: THREE.Box3): boolean {
    for (const exit of this.exits) {
      const exitBox = exit.userData.boundingBox || new THREE.Box3().setFromObject(exit);
      if (boundingBox.intersectsBox(exitBox)) {
        return true;
      }
    }
    return false;
  }

  // 壁との衝突判定
  public checkWallCollision(boundingBox: THREE.Box3): boolean {
    for (const wall of this.walls) {
      const wallBox = wall.userData.boundingBox || new THREE.Box3().setFromObject(wall);
      if (boundingBox.intersectsBox(wallBox)) {
        return true;
      }
    }
    return false;
  }

  // 壁のリストを取得（視線判定用）
  public getWalls(): THREE.Object3D[] {
    return this.walls;
  }

  // 現在のレベルを取得
  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  // リソースの解放
  public dispose(): void {
    this.clearLevel();
  }

  // Three.jsオブジェクトのリソース解放
  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}