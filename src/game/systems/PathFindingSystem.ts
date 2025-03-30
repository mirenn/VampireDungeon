// filepath: c:\Users\ngihy\Documents\nagai\VampireDungeon\src\game\systems\PathFindingSystem.ts
import * as THREE from 'three';
import { LevelSystem } from './LevelSystem';

// グリッドのノード（セル）を表すクラス
export class GridNode {
  public x: number;
  public y: number;
  public isWalkable: boolean = true;
  public gCost: number = 0;  // スタートからのコスト
  public hCost: number = 0;  // ゴールまでの推定コスト
  public parent: GridNode | null = null;
  
  constructor(x: number, y: number, isWalkable: boolean = true) {
    this.x = x;
    this.y = y;
    this.isWalkable = isWalkable;
  }
  
  // f(x) = g(x) + h(x)
  public get fCost(): number {
    return this.gCost + this.hCost;
  }
}

// グリッドシステム
export class Grid {
  private nodes: GridNode[][];
  private nodeSize: number;
  private width: number;
  private height: number;
  private originX: number;
  private originY: number;
  
  constructor(width: number, height: number, nodeSize: number, originX: number = 0, originY: number = 0) {
    this.width = width;
    this.height = height;
    this.nodeSize = nodeSize;
    this.originX = originX;
    this.originY = originY;
    
    // グリッドノードの初期化
    this.nodes = [];
    for (let x = 0; x < width; x++) {
      this.nodes[x] = [];
      for (let y = 0; y < height; y++) {
        this.nodes[x][y] = new GridNode(x, y, true);
      }
    }
  }
  
  // 壁情報からグリッドを更新
  public updateFromWalls(walls: THREE.Object3D[], levelSize: number): void {
    // すべてのノードを歩行可能にリセット
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        this.nodes[x][y].isWalkable = true;
      }
    }
    
    // 各壁のバウンディングボックスを取得し、グリッドノードを更新
    for (const wall of walls) {
      const boundingBox = wall.userData.boundingBox || new THREE.Box3().setFromObject(wall);
      
      // バウンディングボックスの範囲内のノードを歩行不可能にする
      const minX = Math.max(0, Math.floor((boundingBox.min.x - this.originX + levelSize / 2) / this.nodeSize));
      const maxX = Math.min(this.width - 1, Math.ceil((boundingBox.max.x - this.originX + levelSize / 2) / this.nodeSize));
      const minZ = Math.max(0, Math.floor((boundingBox.min.z - this.originY + levelSize / 2) / this.nodeSize));
      const maxZ = Math.min(this.height - 1, Math.ceil((boundingBox.max.z - this.originY + levelSize / 2) / this.nodeSize));
      
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (x >= 0 && x < this.width && z >= 0 && z < this.height) {
            this.nodes[x][z].isWalkable = false;
          }
        }
      }
    }
  }
  
  // 世界座標からグリッド上の位置を取得
  public worldToGrid(worldX: number, worldZ: number): { x: number, y: number } {
    const gridX = Math.floor((worldX - this.originX + this.width * this.nodeSize / 2) / this.nodeSize);
    const gridY = Math.floor((worldZ - this.originY + this.height * this.nodeSize / 2) / this.nodeSize);
    
    return {
      x: Math.max(0, Math.min(this.width - 1, gridX)),
      y: Math.max(0, Math.min(this.height - 1, gridY))
    };
  }
  
  // グリッド上の位置から世界座標を取得
  public gridToWorld(gridX: number, gridY: number): { x: number, z: number } {
    const worldX = this.originX + (gridX - this.width / 2) * this.nodeSize + this.nodeSize / 2;
    const worldZ = this.originY + (gridY - this.height / 2) * this.nodeSize + this.nodeSize / 2;
    
    return { x: worldX, z: worldZ };
  }
  
  // 指定した位置のノードを取得
  public getNode(x: number, y: number): GridNode | null {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.nodes[x][y];
    }
    return null;
  }
  
  // あるノードの隣接ノードを取得（斜め移動も含む）
  public getNeighbors(node: GridNode): GridNode[] {
    const neighbors: GridNode[] = [];
    
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        if (x === 0 && y === 0) continue; // 自分自身はスキップ
        
        const checkX = node.x + x;
        const checkY = node.y + y;
        
        // グリッド範囲内かチェック
        if (checkX >= 0 && checkX < this.width && checkY >= 0 && checkY < this.height) {
          // 斜め移動の場合、両側のノードが壁でないことを確認（コーナーカット防止）
          if (Math.abs(x) == 1 && Math.abs(y) == 1) {
            const nodeA = this.getNode(node.x + x, node.y);
            const nodeB = this.getNode(node.x, node.y + y);
            
            if (nodeA && nodeB && (!nodeA.isWalkable || !nodeB.isWalkable)) {
              continue;
            }
          }
          
          const neighbor = this.nodes[checkX][checkY];
          if (neighbor.isWalkable) {
            neighbors.push(neighbor);
          }
        }
      }
    }
    
    return neighbors;
  }
  
  // グリッドの幅と高さを取得するメソッドを追加
  public getDimensions(): { width: number, height: number } {
    return { width: this.width, height: this.height };
  }
}

// パスファインディングシステム
export class PathFindingSystem {
  private grid: Grid;
  private levelSystem: LevelSystem;
  private updateRequired: boolean = true;
  private lastPathfindingSuccess: boolean = true;
  private pathfindingFailureCount: number = 0;
  
  constructor(levelSystem: LevelSystem, gridSize: number = 1) {
    this.levelSystem = levelSystem;
    
    // レベルのサイズに基づいてグリッドを初期化
    const levelSize = 40; // 最大のレベルサイズに合わせる
    const gridWidth = Math.ceil(levelSize / gridSize);
    const gridHeight = Math.ceil(levelSize / gridSize);
    
    this.grid = new Grid(gridWidth, gridHeight, gridSize);
    this.updateGrid();
  }
  
  // レベルの壁情報からグリッドを更新
  public updateGrid(): void {
    const walls = this.levelSystem.getWalls();
    const levelSize = 40; // 最大のレベルサイズ
    this.grid.updateFromWalls(walls, levelSize);
    this.updateRequired = false;
  }
  
  // 更新フラグを設定
  public setUpdateRequired(): void {
    this.updateRequired = true;
  }
  
  // A*アルゴリズムでパスを探索
  public findPath(startWorldPos: THREE.Vector3, endWorldPos: THREE.Vector3): THREE.Vector3[] {
    // グリッドの更新が必要な場合は更新
    if (this.updateRequired) {
      this.updateGrid();
    }
    
    // 開始点と終了点をグリッド座標に変換
    const startGridPos = this.grid.worldToGrid(startWorldPos.x, startWorldPos.z);
    const endGridPos = this.grid.worldToGrid(endWorldPos.x, endWorldPos.z);
    
    const startNode = this.grid.getNode(startGridPos.x, startGridPos.y);
    const targetNode = this.grid.getNode(endGridPos.x, endGridPos.y);
    
    if (!startNode || !targetNode) {
      console.log("無効な開始点または終了点です");
      this.lastPathfindingSuccess = false;
      return this.getFallbackPath(startWorldPos, endWorldPos);
    }
    
    // プレイヤーのサイズを考慮した安全マージンの設定
    const playerSize = 1.0;
    const safetyMargin = Math.ceil(playerSize / 2); // 少し緩和
    
    // 目標地点が移動不可能な場合、近くの移動可能な場所を探す
    if (!targetNode.isWalkable) {
      console.log("目標地点が障害物内です。近くの移動可能な場所を探しています...");
      const alternativeTarget = this.findNearestWalkableNode(targetNode, safetyMargin);
      if (alternativeTarget) {
        console.log("代替目標地点が見つかりました");
        const path = this.aStarSearch(startNode, alternativeTarget, safetyMargin);
        if (path.length > 0) {
          this.lastPathfindingSuccess = true;
          this.pathfindingFailureCount = 0;
          return this.optimizePath(path, startWorldPos, endWorldPos);
        }
      }
      console.log("近くに移動可能な場所が見つかりませんでした");
      this.lastPathfindingSuccess = false;
      this.pathfindingFailureCount++;
      return this.getFallbackPath(startWorldPos, endWorldPos);
    }
    
    // A*アルゴリズムでパスを探索
    const path = this.aStarSearch(startNode, targetNode, safetyMargin);
    
    if (path.length === 0) {
      console.log("経路が見つかりませんでした。代替経路を試みます...");
      this.lastPathfindingSuccess = false;
      this.pathfindingFailureCount++;
      
      // 代替経路を試みる：安全マージンを減らして再試行
      if (safetyMargin > 0) {
        const reducedMarginPath = this.aStarSearch(startNode, targetNode, Math.max(0, safetyMargin - 1));
        if (reducedMarginPath.length > 0) {
          console.log("安全マージンを減らして経路を見つけました");
          this.pathfindingFailureCount = 0;
          return this.optimizePath(reducedMarginPath, startWorldPos, endWorldPos);
        }
      }
      
      return this.getFallbackPath(startWorldPos, endWorldPos);
    }
    
    this.lastPathfindingSuccess = true;
    this.pathfindingFailureCount = 0;
    return this.optimizePath(path, startWorldPos, endWorldPos);
  }
  
  // フォールバックパスの生成（経路探索失敗時）
  private getFallbackPath(startWorldPos: THREE.Vector3, endWorldPos: THREE.Vector3): THREE.Vector3[] {
    console.log("フォールバック経路を使用します");
    
    // シンプルな直線経路を作成（実際には使用しない中間点を含む）
    const direction = new THREE.Vector3().subVectors(endWorldPos, startWorldPos).normalize();
    const distance = startWorldPos.distanceTo(endWorldPos);
    
    // 中間点をいくつか追加して少しでも障害物を避けられるようにする
    const fallbackPath: THREE.Vector3[] = [startWorldPos.clone()];
    
    // 障害物がある場合は迂回を試みる
    if (this.pathfindingFailureCount > 1) {
      // 複数回失敗した場合はランダムな方向に少し迂回してみる
      const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
      const randomOffset = (Math.random() * 2 - 1) * 5; // -5～5のランダムな値
      
      const midPoint = new THREE.Vector3()
        .addVectors(startWorldPos, endWorldPos)
        .multiplyScalar(0.5)
        .addScaledVector(perpendicular, randomOffset);
      
      fallbackPath.push(midPoint);
    }
    
    fallbackPath.push(endWorldPos.clone());
    return fallbackPath;
  }
  
  // パスの最適化
  private optimizePath(path: THREE.Vector3[], startWorldPos: THREE.Vector3, endWorldPos: THREE.Vector3): THREE.Vector3[] {
    if (path.length === 0) return [];
    
    // パスの先頭と末尾を実際の開始点と終了点に置き換え
    if (path.length >= 2) {
      path[0] = startWorldPos.clone();
      path[path.length - 1] = endWorldPos.clone();
    }
    
    // スムージングとファネリングを適用
    const smoothedPath = this.smoothPath(path);
    return this.applyFunnelAlgorithm(smoothedPath);
  }
  
  // A*アルゴリズムの実装
  private aStarSearch(startNode: GridNode, targetNode: GridNode, safetyMargin: number = 0): THREE.Vector3[] {
    const openSet: GridNode[] = [];
    const closedSet: Set<GridNode> = new Set();
    
    // スタートノードを開始点として追加
    openSet.push(startNode);
    
    while (openSet.length > 0) {
      // F値が最も低いノードを取得
      let currentNode = openSet[0];
      let currentIndex = 0;
      
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].fCost < currentNode.fCost || 
            (openSet[i].fCost === currentNode.fCost && openSet[i].hCost < currentNode.hCost)) {
          currentNode = openSet[i];
          currentIndex = i;
        }
      }
      
      // 現在のノードをオープンセットから削除し、クローズドセットに追加
      openSet.splice(currentIndex, 1);
      closedSet.add(currentNode);
      
      // 目標に到達した場合、パスを構築して返す
      if (currentNode === targetNode) {
        return this.retracePath(startNode, targetNode);
      }
      
      // 隣接ノードを処理
      const neighbors = this.grid.getNeighbors(currentNode);
      
      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor)) continue;
        
        // プレイヤーのサイズに基づく安全マージンを考慮する
        // 障害物の近くのノードは避ける（プレイヤーのサイズがあるため）
        if (safetyMargin > 0 && !this.isNodeSafe(neighbor, safetyMargin)) {
          continue; // 安全マージン内に障害物があるノードはスキップ
        }
        
        // 移動コストを計算（斜め移動の場合は√2、直線移動の場合は1）
        const isDiagonal = currentNode.x !== neighbor.x && currentNode.y !== neighbor.y;
        const movementCost = isDiagonal ? 1.414 : 1;
        
        const newGCost = currentNode.gCost + movementCost;
        
        // このパスが既知のパスより良いか、またはノードがオープンセットにない場合
        if (newGCost < neighbor.gCost || !openSet.includes(neighbor)) {
          neighbor.gCost = newGCost;
          neighbor.hCost = this.getDistance(neighbor, targetNode);
          neighbor.parent = currentNode;
          
          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    
    // パスが見つからなかった場合は空の配列を返す
    return [];
  }
  
  // 2つのノード間の距離（ヒューリスティック関数）
  private getDistance(nodeA: GridNode, nodeB: GridNode): number {
    const distX = Math.abs(nodeA.x - nodeB.x);
    const distY = Math.abs(nodeA.y - nodeB.y);
    
    // 斜め移動のコスト（√2）と直線移動のコスト（1）を組み合わせる
    return (distX > distY) ? 
      1.414 * distY + (distX - distY) : 
      1.414 * distX + (distY - distX);
  }
  
  // 最終的なパスを構築（ノードの親を辿る）
  private retracePath(startNode: GridNode, endNode: GridNode): THREE.Vector3[] {
    const path: THREE.Vector3[] = [];
    let currentNode: GridNode | null = endNode;
    
    while (currentNode && currentNode !== startNode) {
      const worldPos = this.grid.gridToWorld(currentNode.x, currentNode.y);
      path.push(new THREE.Vector3(worldPos.x, 0, worldPos.z));
      currentNode = currentNode.parent;
    }
    
    // パスの順序を反転（スタートからエンドの順に）
    return path.reverse();
  }
  
  // 移動不可能なノードの近くで移動可能なノードを探す
  private findNearestWalkableNode(node: GridNode, safetyMargin: number = 0): GridNode | null {
    const searchRadius = 10; // 探索範囲を拡大
    
    // 螺旋状に探索範囲を広げる（より効率的）
    const spiralOffsets = [];
    for (let radius = 1; radius <= searchRadius; radius++) {
      for (let i = 0; i < radius * 8; i++) {
        const t = i / (radius * 8);
        const angle = Math.PI * 2 * t * radius;
        const x = Math.round(Math.cos(angle) * radius);
        const y = Math.round(Math.sin(angle) * radius);
        spiralOffsets.push({x, y});
      }
    }
    
    // 中心からの距離でソート
    spiralOffsets.sort((a, b) => {
      return Math.sqrt(a.x * a.x + a.y * a.y) - Math.sqrt(b.x * b.x + b.y * b.y);
    });
    
    // ユニークな位置だけにする
    const uniqueOffsets = [];
    const seen = new Set();
    for (const offset of spiralOffsets) {
      const key = `${offset.x},${offset.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueOffsets.push(offset);
      }
    }
    
    // 螺旋状に探索
    for (const offset of uniqueOffsets) {
      const neighborX = node.x + offset.x;
      const neighborY = node.y + offset.y;
      
      const neighborNode = this.grid.getNode(neighborX, neighborY);
      if (neighborNode && neighborNode.isWalkable && this.isNodeSafe(neighborNode, safetyMargin)) {
        return neighborNode;
      }
    }
    
    return null; // 見つからなかった場合
  }
  
  // ノードが指定されたマージン内に障害物を含まないかを確認
  private isNodeSafe(node: GridNode, margin: number): boolean {
    if (margin <= 0) return true;
    
    // マージン内の全ノードをチェック
    for (let x = -margin; x <= margin; x++) {
      for (let y = -margin; y <= margin; y++) {
        const checkX = node.x + x;
        const checkY = node.y + y;
        
        const checkNode = this.grid.getNode(checkX, checkY);
        if (!checkNode || !checkNode.isWalkable) {
          return false; // マージン内に障害物があるか、グリッド外
        }
      }
    }
    
    return true; // マージン内に障害物なし
  }
  
  // パスの最適化（直線的に移動できる部分は中間ノードを省略）
  private smoothPath(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length <= 2) return path;
    
    const smoothedPath: THREE.Vector3[] = [path[0]];
    let current = 0;
    
    while (current < path.length - 1) {
      // 現在位置から最も遠い可視点を探す
      let farthestVisible = current + 1;
      
      for (let i = path.length - 1; i > current; i--) {
        if (this.hasLineOfSight(path[current], path[i])) {
          farthestVisible = i;
          break;
        }
      }
      
      // 次の点として最も遠い可視点を追加
      current = farthestVisible;
      if (current < path.length) {
        smoothedPath.push(path[current]);
      }
    }
    
    return smoothedPath;
  }
  
  // ファネリングアルゴリズムの適用（より自然なパスを生成）
  private applyFunnelAlgorithm(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length <= 2) return path;
    
    // ファネルアルゴリズムの簡略版実装
    const funnelPath: THREE.Vector3[] = [path[0]];
    let apex = path[0].clone();
    
    for (let i = 1; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];
      
      // 現在地点から次の2点への方向ベクトル
      const dirToCurrent = new THREE.Vector3().subVectors(current, apex).normalize();
      const dirToNext = new THREE.Vector3().subVectors(next, apex).normalize();
      
      // 2つのベクトル間の角度を計算
      const angle = dirToCurrent.angleTo(dirToNext);
      
      // 角度が大きい場合（鋭角な曲がり角）、現在地点をパスに追加
      if (angle > Math.PI / 6) { // 30度以上の曲がり角
        funnelPath.push(current);
        apex = current.clone();
      }
    }
    
    // 最後の点を追加
    funnelPath.push(path[path.length - 1]);
    
    return funnelPath;
  }
  
  // 2点間の視線チェック（障害物がないか）
  private hasLineOfSight(start: THREE.Vector3, end: THREE.Vector3): boolean {
    // 距離が非常に近い場合は常にtrueを返す（微小な障害物検出を防ぐ）
    const distance = start.distanceTo(end);
    if (distance < 0.5) return true;
    
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    
    // レイキャストで衝突チェック（複数のレイを使用して精度を向上）
    const mainRay = new THREE.Raycaster(start.clone(), direction, 0, distance);
    const mainIntersections = mainRay.intersectObjects(this.levelSystem.getWalls(), true);
    
    if (mainIntersections.length === 0) {
      return true; // メインレイに障害物なし
    }
    
    // 障害物との交差点が終点に十分近い場合は、視線ありと判定（小さな障害物をすり抜ける）
    if (mainIntersections.length > 0) {
      const hitPoint = mainIntersections[0].point;
      const hitDistance = hitPoint.distanceTo(end);
      if (hitDistance < 0.5) {
        return true;
      }
    }
    
    return false;
  }
  
  // デバッグ用：現在のパス探索の成功/失敗状態を取得
  public isLastPathfindingSuccessful(): boolean {
    return this.lastPathfindingSuccess;
  }
}