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
  
  // 原点座標を更新するメソッドを追加
  public updateOrigin(originX: number, originY: number): void {
    this.originX = originX;
    this.originY = originY;
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
    // 修正: プレイヤーの位置を中心としたグリッド座標に変換
    const gridX = Math.floor((worldX - this.originX) / this.nodeSize + this.width / 2);
    const gridY = Math.floor((worldZ - this.originY) / this.nodeSize + this.height / 2);
    
    return {
      x: Math.max(0, Math.min(this.width - 1, gridX)),
      y: Math.max(0, Math.min(this.height - 1, gridY))
    };
  }
  
  // グリッド上の位置から世界座標を取得
  public gridToWorld(gridX: number, gridY: number): { x: number, z: number } {
    // 修正: グリッド座標から世界座標に変換（計算式は変更なし、ただしロジックの整合性を保つ）
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
  }  
  
  // PathFindingSystem クラスに追加するデバッグ用可視化メソッド
  public createDebugVisualization(playerPosition: THREE.Vector3, showPath: boolean = false, path: THREE.Vector3[] = []): THREE.Group {
    const debugGroup = new THREE.Group();
    
    // プレイヤーの位置をグリッドの原点として設定
    this.grid.updateOrigin(playerPosition.x, playerPosition.z);
    
    // 原点を更新した場合は常にグリッドを更新する（重要）
    this.updateGrid();
    
    // プレイヤーの位置をグリッド座標に変換
    const playerGridPos = this.grid.worldToGrid(playerPosition.x, playerPosition.z);
    console.log(`プレイヤーグリッド座標: ${playerGridPos.x}, ${playerGridPos.y}`);
    
    // グリッドの次元を取得
    const gridDimensions = this.grid.getDimensions();
    
    // グリッドのワールド座標原点を計算して表示（デバッグ用）
    const originWorldPos = this.grid.gridToWorld(0, 0);
    
    // 可視化の範囲を縮小（最適化1: 表示範囲縮小）
    const visualizationRadius = 10; // 20→10に縮小
    
    // 原点マーカーを追加（座標系の把握のため）
    const originMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff00ff })
    );
    originMarker.position.set(originWorldPos.x, 0.5, originWorldPos.z);
    debugGroup.add(originMarker);
    
    // 最適化2: インスタンシング用の準備
    // 緑のセル（移動可能）用
    const walkableCellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const walkableCellMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.15 // さらに透明に
    });
    
    // 赤のセル（移動不可）用
    const unwalkableCellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const unwalkableCellMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6
    });
    
    // パス用のセル
    const pathCellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const pathCellMaterial = new THREE.MeshBasicMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 0.7
    });
    
    // プレイヤー位置用のセル
    const playerCellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const playerCellMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });
    
    // 最適化3: テキスト表示の削減（5セルごとに表示）
    const textDisplayInterval = 5;
    
    // 最適化4: テクスチャアトラスの事前生成（数字0-9のテクスチャを一度だけ作成）
    const numberTextures: Map<string, THREE.Texture> = new Map();
    
    // プレイヤー周囲の限定された範囲のみをビジュアライズ
    let walkableCellCount = 0;
    let unwalkableCellCount = 0;
    
    for (let offsetX = -visualizationRadius; offsetX <= visualizationRadius; offsetX++) {
      for (let offsetY = -visualizationRadius; offsetY <= visualizationRadius; offsetY++) {
        const x = playerGridPos.x + offsetX;
        const y = playerGridPos.y + offsetY;
        
        // グリッド範囲内かチェック
        if (x >= 0 && x < gridDimensions.width && y >= 0 && y < gridDimensions.height) {
          const node = this.grid.getNode(x, y);
          if (node) {
            const worldPos = this.grid.gridToWorld(x, y);
            
            // 最適化5: 重要でないセルをスキップ
            // 中心から遠いセルは通常表示しない（パスやプレイヤー位置、壁以外）
            const distanceFromPlayer = Math.abs(offsetX) + Math.abs(offsetY);
            if (distanceFromPlayer > 5 && node.isWalkable && 
                (!showPath || !this.isPointOnPath(worldPos, path))) {
              continue; // 遠くの通常セルはスキップ
            }
            
            let material, geometry;
            let showCell = true;
            
            // ノードの状態に基づいて表示を決定
            if (!node.isWalkable) {
              geometry = unwalkableCellGeometry;
              material = unwalkableCellMaterial;
              unwalkableCellCount++;
            } else if (showPath && this.isPointOnPath(worldPos, path)) {
              geometry = pathCellGeometry;
              material = pathCellMaterial;
            } else if (x === playerGridPos.x && y === playerGridPos.y) {
              geometry = playerCellGeometry;
              material = playerCellMaterial;
            } else {
              geometry = walkableCellGeometry;
              material = walkableCellMaterial;
              walkableCellCount++;
              
            }
            
            if (showCell) {
              const plane = new THREE.Mesh(geometry, material);
              plane.position.set(worldPos.x, 0.1, worldPos.z);
              plane.rotation.x = -Math.PI / 2;
              debugGroup.add(plane);
            }
            
            // 最適化3: テキスト表示の削減（5セルごと、または特別なセル）
            const isSpecialCell = !node.isWalkable || (showPath && this.isPointOnPath(worldPos, path)) || 
                                  (x === playerGridPos.x && y === playerGridPos.y);
            const shouldShowCoordinates = (x % textDisplayInterval === 0 && y % textDisplayInterval === 0) || isSpecialCell;
            
            if (shouldShowCoordinates) {
              // キャッシュされたテクスチャを利用するか、新規作成
              const coordKey = `${x},${y}`;
              if (!numberTextures.has(coordKey)) {
                const scale = isSpecialCell ? 0.7 : 0.4;
                const coordText = this.createTextSprite(coordKey, 0x000000);
                coordText.position.set(worldPos.x, 0.2, worldPos.z);
                coordText.scale.set(scale, scale, 1);
                debugGroup.add(coordText);
              }
            }
          }
        }
      }
    }
    
    // プレイヤーの位置を強調表示
    const playerWorldPos = this.grid.gridToWorld(playerGridPos.x, playerGridPos.y);
    const playerMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x0000ff })
    );
    playerMarker.position.set(playerWorldPos.x, 0.5, playerWorldPos.z);
    debugGroup.add(playerMarker);
    
    // パスを表示
    if (showPath && path.length > 0) {
      const pathMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
      const pathPoints = path.map(p => new THREE.Vector3(p.x, 0.2, p.z));
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
      const pathLine = new THREE.Line(pathGeometry, pathMaterial);
      debugGroup.add(pathLine);
    }
    
    console.log(`デバッグ可視化: 表示可能セル=${walkableCellCount}, 壁=${unwalkableCellCount}, 総オブジェクト=${debugGroup.children.length}`);
    return debugGroup;
  }
  
  // パス上の点かどうかを判断するヘルパーメソッド
  private isPointOnPath(point: { x: number, z: number }, path: THREE.Vector3[]): boolean {
    if (!path || path.length === 0) return false;
    
    const worldPoint = new THREE.Vector3(point.x, 0, point.z);
    // パス上のポイントと近いかチェック
    for (const pathPoint of path) {
      if (pathPoint.distanceTo(worldPoint) < 0.5) {
        return true;
      }
    }
    return false;
  }

  // TextGeometryの代わりにスプライトでグリッド座標を表示する
  private createTextSprite(text: string, color: number = 0x000000): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return new THREE.Sprite();
    
    canvas.width = 64;
    canvas.height = 64;
    
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'Bold 12px Arial';
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.5, 1);
    
    return sprite;
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
  
// A*アルゴリズムの実装
private aStarSearch(startNode: GridNode, targetNode: GridNode, safetyMargin: number = 0): THREE.Vector3[] {
  const openSet: GridNode[] = [];
  const closedSet: Set<GridNode> = new Set();
  
  // ノードをリセット
  const gridDimensions = this.grid.getDimensions();
  for (let x = 0; x < gridDimensions.width; x++) {
    for (let y = 0; y < gridDimensions.height; y++) {
      const node = this.grid.getNode(x, y);
      if (node) {
        node.gCost = 0;
        node.hCost = 0;
        node.parent = null;
      }
    }
  }
  
  // スタートノードを開始点として追加
  startNode.gCost = 0;
  startNode.hCost = this.getDistance(startNode, targetNode);
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
      
      // 安全マージンを考慮する（値を小さくする）
      const clearanceScore = this.getNodeClearanceScore(neighbor);
      if (clearanceScore < safetyMargin) {
        continue; // 安全マージン未満のノードはスキップ
      }
      
      // 移動コストを計算（斜め移動の場合は√2、直線移動の場合は1）
      const isDiagonal = currentNode.x !== neighbor.x && currentNode.y !== neighbor.y;
      let movementCost = isDiagonal ? 1.414 : 1;
      
      // クリアランススコアに基づくペナルティを小さくする
      // 壁に非常に近い場合のみわずかなペナルティを追加
      const clearancePenalty = (clearanceScore <= 1) ? 0.1 : 0;
      movementCost += clearancePenalty;
      
      const newGCost = currentNode.gCost + movementCost;
      
      // このパスが既知のパスより良いか、またはノードがオープンセットにない場合
      if (newGCost < neighbor.gCost || !openSet.includes(neighbor)) {
        neighbor.gCost = newGCost;
        // ヒューリスティック関数の重みを調整して直線的な経路を優先
        neighbor.hCost = this.getDistance(neighbor, targetNode); // 重み付けを取り除く
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

// ノードのクリアランススコアを計算（壁からの距離）
private getNodeClearanceScore(node: GridNode): number {
  let minDistance = Number.MAX_SAFE_INTEGER;
  
  // ノード周辺の検査範囲
  const checkRange = 3;
  
  for (let x = -checkRange; x <= checkRange; x++) {
    for (let y = -checkRange; y <= checkRange; y++) {
      if (x === 0 && y === 0) continue;
      
      const checkX = node.x + x;
      const checkY = node.y + y;
      
      const checkNode = this.grid.getNode(checkX, checkY);
      if (!checkNode || !checkNode.isWalkable) {
        // 壁までのマンハッタン距離を計算
        const distance = Math.abs(x) + Math.abs(y);
        minDistance = Math.min(minDistance, distance);
      }
    }
  }
  
  return minDistance === Number.MAX_SAFE_INTEGER ? checkRange : minDistance;
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
  
  // 開始点を追加
  const startWorldPos = this.grid.gridToWorld(startNode.x, startNode.y);
  path.push(new THREE.Vector3(startWorldPos.x, 0, startWorldPos.z));
  
  // パスの順序を反転（スタートからエンドの順に）
  return path.reverse();
}

// パスの最適化（直線的に移動できる部分は中間ノードを省略）
private smoothPath(path: THREE.Vector3[]): THREE.Vector3[] {
  if (path.length <= 2) return path;
  
  const smoothedPath: THREE.Vector3[] = [path[0]];
  let i = 0;
  
  while (i < path.length - 1) {
    const current = path[i];
    
    // 現在地点から最も遠くて直線で到達可能な点を探す
    let farthestSafeIndex = i + 1;
    
    for (let j = path.length - 1; j > i + 1; j--) {
      if (this.isSafePath(current, path[j])) {
        farthestSafeIndex = j;
        break;
      }
    }
    
    // 最も遠い安全な点をパスに追加
    i = farthestSafeIndex;
    smoothedPath.push(path[i]);
  }
  
  return smoothedPath;
}

// 2点間の経路が安全かどうかを厳格にチェック
private isSafePath(start: THREE.Vector3, end: THREE.Vector3): boolean {
  // 距離が非常に近い場合は常にtrueを返す
  const distance = start.distanceTo(end);
  if (distance < 1.0) return true;
  
  // 2点間の線分上で複数のポイントをチェック
  const checkPoints = Math.max(3, Math.ceil(distance / 0.5)); // 距離に応じてチェックポイント数を調整
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  
  for (let i = 1; i < checkPoints; i++) {
    const t = i / checkPoints;
    const checkPoint = new THREE.Vector3()
      .addVectors(start, new THREE.Vector3().copy(direction).multiplyScalar(distance * t));
    
    // グリッド上の位置を取得
    const gridPos = this.grid.worldToGrid(checkPoint.x, checkPoint.z);
    const node = this.grid.getNode(gridPos.x, gridPos.y);
    
    // ノードが歩行不能の場合のみ経路を安全でないと判断
    if (!node || !node.isWalkable) {
      return false;
    }
  }
  
  return true;
}

// ファネリングアルゴリズムの適用（より自然なパスを生成）
private applyFunnelAlgorithm(path: THREE.Vector3[]): THREE.Vector3[] {
  if (path.length <= 2) return path;
  
  const funnelPath: THREE.Vector3[] = [path[0]];
  let apex = path[0].clone();
  let lastDirection = new THREE.Vector3();
  
  for (let i = 1; i < path.length; i++) {
    const current = path[i];
    
    // 現在地点からの方向ベクトル
    const dirToCurrent = new THREE.Vector3().subVectors(current, apex).normalize();
    
    // 前回の方向との角度を計算
    if (i > 1) {
      const angle = dirToCurrent.angleTo(lastDirection);
      
      // 角度変化が大きい場合のみ中間点を追加
      if (angle > Math.PI / 6) { // 30度以上の曲がり角のみ中間点を追加
        funnelPath.push(path[i-1]);
        apex = path[i-1].clone();
      }
    }
    
    lastDirection = dirToCurrent;
  }
  
  // 最後の点を追加
  funnelPath.push(path[path.length - 1]);
  
  return funnelPath;
}

// コーナーの丸め処理を追加（経路をより滑らかにする）
private addCornerRounding(path: THREE.Vector3[]): THREE.Vector3[] {
  if (path.length <= 2) return path;
  
  const roundedPath: THREE.Vector3[] = [path[0]];
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const current = path[i];
    const next = path[i + 1];
    
    // 現在の点とその前後の点から角度を計算
    const v1 = new THREE.Vector3().subVectors(current, prev).normalize();
    const v2 = new THREE.Vector3().subVectors(next, current).normalize();
    const angle = v1.angleTo(v2);
    
    // 角度が大きい場合のみ補間点を追加（鋭角なコーナー）
    if (angle > Math.PI / 3) { // 60度以上の角度の場合のみ補間
      // コーナーの前に補間点を追加
      const beforeCorner = new THREE.Vector3().copy(current).sub(v1.multiplyScalar(0.3));
      roundedPath.push(beforeCorner);
      
      // コーナー点自体を追加
      roundedPath.push(current);
      
      // コーナーの後に補間点を追加
      const afterCorner = new THREE.Vector3().copy(current).add(new THREE.Vector3().copy(v2).multiplyScalar(0.3));
      roundedPath.push(afterCorner);
    } else {
      // 普通のコーナーはそのまま追加
      roundedPath.push(current);
    }
  }
  
  // 最後の点を追加
  roundedPath.push(path[path.length - 1]);
  
  return roundedPath;
}

// 経路探索のエントリーポイント
public findPath(startWorldPos: THREE.Vector3, endWorldPos: THREE.Vector3): THREE.Vector3[] {
  // グリッドの原点をスタート位置に更新し、常にグリッドを再計算
  this.grid.updateOrigin(startWorldPos.x, startWorldPos.z);
  this.updateGrid();
  
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
  
  // キャラクターのサイズを考慮した安全マージン（値を小さくする）
  const playerSize = 0.8; // キャラクターサイズを小さく
  const baseMargin = Math.ceil(playerSize / 2);
  const safetyMargin = baseMargin; // 追加マージンを削除
  
  // 目標地点が移動不可能な場合、近くの移動可能な場所を探す
  if (!targetNode.isWalkable || this.getNodeClearanceScore(targetNode) < safetyMargin) {
    console.log("目標地点が障害物内または障害物に近すぎます。代替目標を探しています...");
    const alternativeTarget = this.findNearestWalkableNode(targetNode, safetyMargin);
    if (alternativeTarget) {
      console.log("代替目標地点が見つかりました");
      const path = this.aStarSearch(startNode, alternativeTarget, safetyMargin);
      if (path.length > 0) {
        this.lastPathfindingSuccess = true;
        this.pathfindingFailureCount = 0;
        
        // パスの最後の点を元々の目標点に置き換え
        if (path.length > 1) {
          path[path.length - 1] = new THREE.Vector3(endWorldPos.x, 0, endWorldPos.z);
        }
        
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
      const reducedMarginPath = this.aStarSearch(startNode, targetNode, 0); // マージンを0に設定
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

// パスの最適化
private optimizePath(path: THREE.Vector3[], startWorldPos: THREE.Vector3, endWorldPos: THREE.Vector3): THREE.Vector3[] {
  if (path.length === 0) return [];
  
  // パスの先頭と末尾を実際の開始点と終了点に置き換え
  if (path.length >= 2) {
    path[0] = startWorldPos.clone();
    path[path.length - 1] = endWorldPos.clone();
  }
  
  // 直線経路が安全な場合は直接接続して終了
  if (this.isSafePath(startWorldPos, endWorldPos)) {
    return [startWorldPos.clone(), endWorldPos.clone()];
  }
  
  // スムージング処理を改善
  const smoothedPath = this.smoothPath(path);
  
  // ファネリングは必要な場合のみ適用
  const funnelledPath = this.applyFunnelAlgorithm(smoothedPath);
  
  // 最終的な経路に適度な中間点を追加して滑らかさを向上
  return this.ensurePathDensity(funnelledPath);
}

// 経路の密度を保証（長い直線部分に中間点を追加）
private ensurePathDensity(path: THREE.Vector3[]): THREE.Vector3[] {
  if (path.length <= 1) return path;
  
  const maxSegmentLength = 3.0; // 最大セグメント長を増やして中間点を減らす
  const densePath: THREE.Vector3[] = [path[0]];
  
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];
    const distance = start.distanceTo(end);
    
    // セグメントが長すぎる場合のみ中間点を追加
    if (distance > maxSegmentLength) {
      const segments = Math.ceil(distance / maxSegmentLength);
      for (let j = 1; j < segments; j++) {
        const t = j / segments;
        const intermediatePoint = new THREE.Vector3().lerpVectors(start, end, t);
        densePath.push(intermediatePoint);
      }
    }
    
    densePath.push(end);
  }
  
  return densePath;
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
  
  // デバッグ用：現在のパス探索の成功/失敗状態を取得
  public isLastPathfindingSuccessful(): boolean {
    return this.lastPathfindingSuccess;
  }
}