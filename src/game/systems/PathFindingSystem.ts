import * as THREE from 'three';
import { LevelSystem } from './LevelSystem';

// ナビメッシュのセルを表すクラス
export class NavMeshNode {
  public x: number;
  public y: number;
  public isWalkable: boolean;
  public gCost: number = 0;
  public hCost: number = 0;
  public parent: NavMeshNode | null = null;

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

// ナビメッシュシステム
export class NavMesh {
  private nodes: NavMeshNode[][];
  private nodeSize: number = 1; // 1メートル × 1メートルのセル
  private width: number;
  private height: number;

  constructor(navMeshData: number[][], nodeSize: number = 1) {
    this.nodeSize = nodeSize;
    this.width = navMeshData[0].length;
    this.height = navMeshData.length;

    // ナビメッシュノードの初期化
    this.nodes = [];
    for (let y = 0; y < this.height; y++) {
      this.nodes[y] = [];
      for (let x = 0; x < this.width; x++) {
        // 1なら歩行可能、0なら不可
        const isWalkable = navMeshData[y][x] === 1;
        this.nodes[y][x] = new NavMeshNode(x, y, isWalkable);
      }
    }
  }

  // 世界座標からナビメッシュ上の位置を取得 (角原点モデル)
  public worldToGrid(worldX: number, worldZ: number): { x: number; y: number } {
    // 世界座標 (worldX, worldZ) がグリッドのどのセル (gridX, gridY) に対応するか
    // 世界の原点 (0,0) がグリッドの角 (0,0) に対応すると仮定
    const gridX = Math.floor(worldX / this.nodeSize);
    const gridY = Math.floor(worldZ / this.nodeSize); // Z を Y にマッピング

    // グリッド範囲内にクランプ
    return {
      x: Math.max(0, Math.min(this.width - 1, gridX)),
      y: Math.max(0, Math.min(this.height - 1, gridY)),
    };
  }

  // ナビメッシュ上の位置から世界座標を取得 (角原点モデル)
  public gridToWorld(gridX: number, gridY: number): { x: number; z: number } {
    // グリッド座標 (gridX, gridY) のセルの中心の世界座標 (worldX, worldZ) を計算
    // 世界の原点 (0,0) がグリッドの角 (0,0) に対応すると仮定
    const worldX = gridX * this.nodeSize + this.nodeSize / 2;
    const worldZ = gridY * this.nodeSize + this.nodeSize / 2; // Y を Z にマッピング

    return { x: worldX, z: worldZ };
  }

  // 指定した位置のノードを取得
  public getNode(x: number, y: number): NavMeshNode | null {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.nodes[y][x];
    }
    return null;
  }

  // あるノードの隣接ノードを取得（斜め移動も含む）
  public getNeighbors(node: NavMeshNode): NavMeshNode[] {
    const neighbors: NavMeshNode[] = [];

    // 8方向（上下左右と斜め）の隣接セルをチェック
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        if (x === 0 && y === 0) continue; // 自分自身はスキップ

        const checkX = node.x + x;
        const checkY = node.y + y;

        // グリッド範囲内かチェック
        if (
          checkX >= 0 &&
          checkX < this.width &&
          checkY >= 0 &&
          checkY < this.height
        ) {
          // 斜め移動の場合、両側のノードが壁でないことを確認（コーナーカット防止）
          if (Math.abs(x) == 1 && Math.abs(y) == 1) {
            const nodeA = this.getNode(node.x + x, node.y);
            const nodeB = this.getNode(node.x, node.y + y);

            if (nodeA && nodeB && (!nodeA.isWalkable || !nodeB.isWalkable)) {
              continue;
            }
          }

          const neighbor = this.nodes[checkY][checkX];
          if (neighbor.isWalkable) {
            neighbors.push(neighbor);
          }
        }
      }
    }

    return neighbors;
  }

  // ナビメッシュの幅と高さを取得
  public getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}

// パスファインディングシステム
export class PathFindingSystem {
  private navMesh: NavMesh | null = null;
  private levelSystem: LevelSystem;
  private lastPathfindingSuccess: boolean = true;

  constructor(levelSystem: LevelSystem) {
    this.levelSystem = levelSystem;
  }

  // ナビメッシュデータを設定
  public setNavMeshData(navMeshData: number[][]): void {
    this.navMesh = new NavMesh(navMeshData);
    console.log(
      `ナビメッシュを初期化: ${this.navMesh.getDimensions().width}x${this.navMesh.getDimensions().height}`,
    );
  }

  // デバッグ用可視化メソッド
  public createDebugVisualization(playerPosition: THREE.Vector3): THREE.Group {
    const debugGroup = new THREE.Group();

    // ナビメッシュが存在しない場合は空のグループを返す
    if (!this.navMesh) {
      console.warn('ナビメッシュが初期化されていません');
      return debugGroup;
    }

    // グリッドの次元を取得
    const dimensions = this.navMesh.getDimensions();

    // 緑のセル（移動可能）用
    const walkableCellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const walkableCellMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2,
    });

    // 赤のセル（移動不可）用
    const unwalkableCellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const unwalkableCellMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
    });

    // プレイヤー位置用のセル
    const playerCellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const playerCellMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8,
    });

    // プレイヤーのグリッド位置
    const playerGridPos = this.navMesh.worldToGrid(
      playerPosition.x,
      playerPosition.z,
    );

    // ナビメッシュの全セルを可視化
    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        const node = this.navMesh.getNode(x, y);
        if (!node) continue;

        const worldPos = this.navMesh.gridToWorld(x, y);

        let material, geometry;

        // ノードの状態に基づいて表示を決定
        if (x === playerGridPos.x && y === playerGridPos.y) {
          geometry = playerCellGeometry;
          material = playerCellMaterial;
        } else if (node.isWalkable) {
          geometry = walkableCellGeometry;
          material = walkableCellMaterial;
        } else {
          geometry = unwalkableCellGeometry;
          material = unwalkableCellMaterial;
        }

        const plane = new THREE.Mesh(geometry, material);
        plane.position.set(worldPos.x, 0.1, worldPos.z);
        plane.rotation.x = -Math.PI / 2;
        debugGroup.add(plane);

        // 座標表示（5セルごとに表示）
        if ((x % 5 === 0 && y % 5 === 0) || !node.isWalkable) {
          const coordText = this.createTextSprite(
            `${x},${y}`,
            node.isWalkable ? 0x000000 : 0xffffff,
          );
          coordText.position.set(worldPos.x, 0.2, worldPos.z);
          coordText.scale.set(0.5, 0.5, 1);
          debugGroup.add(coordText);
        }
      }
    }

    // プレイヤーの位置を強調表示
    const playerWorldPos = this.navMesh.gridToWorld(
      playerGridPos.x,
      playerGridPos.y,
    );
    const playerMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x0000ff }),
    );
    playerMarker.position.set(playerWorldPos.x, 0.5, playerWorldPos.z);
    debugGroup.add(playerMarker);

    return debugGroup;
  }

  // TextGeometryの代わりにスプライトでグリッド座標を表示する
  private createTextSprite(
    text: string,
    color: number = 0x000000,
  ): THREE.Sprite {
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
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.5, 1);

    return sprite;
  }

  // A*アルゴリズムの実装
  private aStarSearch(
    startNode: NavMeshNode,
    targetNode: NavMeshNode,
  ): THREE.Vector3[] {
    if (!this.navMesh) return [];

    const openSet: NavMeshNode[] = [];
    const closedSet: Set<NavMeshNode> = new Set();

    // ノードをリセット
    const dimensions = this.navMesh.getDimensions();
    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        const node = this.navMesh.getNode(x, y);
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
        if (
          openSet[i].fCost < currentNode.fCost ||
          (openSet[i].fCost === currentNode.fCost &&
            openSet[i].hCost < currentNode.hCost)
        ) {
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
      const neighbors = this.navMesh.getNeighbors(currentNode);

      for (const neighbor of neighbors) {
        if (closedSet.has(neighbor)) continue;

        // 移動コストを計算（斜め移動の場合は√2、直線移動の場合は1）
        const isDiagonal =
          currentNode.x !== neighbor.x && currentNode.y !== neighbor.y;
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

  // 最終的なパスを構築（ノードの親を辿る）
  private retracePath(
    startNode: NavMeshNode,
    endNode: NavMeshNode,
  ): THREE.Vector3[] {
    if (!this.navMesh) return [];

    const path: THREE.Vector3[] = [];
    let currentNode: NavMeshNode | null = endNode;

    while (currentNode && currentNode !== startNode) {
      const worldPos = this.navMesh.gridToWorld(currentNode.x, currentNode.y);
      path.push(new THREE.Vector3(worldPos.x, 0, worldPos.z));
      currentNode = currentNode.parent;
    }

    // 開始点を追加
    const startWorldPos = this.navMesh.gridToWorld(startNode.x, startNode.y);
    path.push(new THREE.Vector3(startWorldPos.x, 0, startWorldPos.z));

    // パスの順序を反転（スタートからエンドの順に）
    return path.reverse();
  }

  // 2つのノード間の距離（ヒューリスティック関数）
  private getDistance(nodeA: NavMeshNode, nodeB: NavMeshNode): number {
    const distX = Math.abs(nodeA.x - nodeB.x);
    const distY = Math.abs(nodeA.y - nodeB.y);

    // 斜め移動のコスト（√2）と直線移動のコスト（1）を組み合わせる
    return distX > distY
      ? 1.414 * distY + (distX - distY)
      : 1.414 * distX + (distY - distX);
  }

  // 近くの移動可能なノードを見つける
  private findNearestWalkableNode(node: NavMeshNode): NavMeshNode | null {
    if (!this.navMesh) return null;

    const searchRadius = 10;

    // 螺旋状に探索範囲を広げる
    const spiralOffsets = [];
    for (let radius = 1; radius <= searchRadius; radius++) {
      for (let i = 0; i < radius * 8; i++) {
        const t = i / (radius * 8);
        const angle = Math.PI * 2 * t * radius;
        const x = Math.round(Math.cos(angle) * radius);
        const y = Math.round(Math.sin(angle) * radius);
        spiralOffsets.push({ x, y });
      }
    }

    // 中心からの距離でソート
    spiralOffsets.sort((a, b) => {
      return (
        Math.sqrt(a.x * a.x + a.y * a.y) - Math.sqrt(b.x * b.x + b.y * b.y)
      );
    });

    // 螺旋状に探索
    for (const offset of spiralOffsets) {
      const neighborX = node.x + offset.x;
      const neighborY = node.y + offset.y;

      const neighborNode = this.navMesh.getNode(neighborX, neighborY);
      if (neighborNode && neighborNode.isWalkable) {
        return neighborNode;
      }
    }

    return null;
  }

  // 経路探索のエントリーポイント
  public findPath(
    startWorldPos: THREE.Vector3,
    endWorldPos: THREE.Vector3,
  ): THREE.Vector3[] {
    if (!this.navMesh) {
      console.error('ナビメッシュが初期化されていません');
      // ナビメッシュがない場合は、移動しないように開始点のみを返すか、
      // もしくは元の目標への直接パスを返す（現在の挙動に近い）
      return [startWorldPos.clone(), endWorldPos.clone()];
    }

    // 開始点と終了点をグリッド座標に変換
    const startGridPos = this.navMesh.worldToGrid(
      startWorldPos.x,
      startWorldPos.z,
    );
    const endGridPos = this.navMesh.worldToGrid(endWorldPos.x, endWorldPos.z);
    console.log(
      `[PathFinding] Start Grid: ${startGridPos.x},${startGridPos.y} | End Grid: ${endGridPos.x},${endGridPos.y}`,
    );

    let startNode = this.navMesh.getNode(startGridPos.x, startGridPos.y);
    let targetNode = this.navMesh.getNode(endGridPos.x, endGridPos.y);

    if (!startNode) {
      console.log(
        `[PathFinding] 無効な開始点です。 Grid: (${startGridPos.x},${startGridPos.y})`,
      );
      this.lastPathfindingSuccess = false;
      // 開始ノードが無効な場合は移動できないため、開始点のみ返す
      return [startWorldPos.clone()];
    }
    if (!targetNode) {
      console.log(
        `[PathFinding] 無効な目標地点です。 Grid: (${endGridPos.x},${endGridPos.y})`,
      );
      this.lastPathfindingSuccess = false;
      // 目標ノードが無効な場合は、元の目標への直接パスを返す（失敗を示す）
      return [startWorldPos.clone(), endWorldPos.clone()];
    }

    const originalStartNodeIsWalkable = startNode.isWalkable; // 元の状態を保存

    // 開始地点が移動不能な場合は近くの移動可能な場所を探す
    if (!startNode.isWalkable) {
      console.log(
        `[PathFinding] Start node (${startGridPos.x},${startGridPos.y}) is not walkable. Finding nearest walkable node.`,
      );
      const alternativeStart = this.findNearestWalkableNode(startNode);
      if (alternativeStart) {
        console.log(
          `[PathFinding] Found alternative start node: (${alternativeStart.x},${alternativeStart.y})`,
        );
        startNode = alternativeStart; // 開始ノードを更新
      } else {
        console.log(
          '[PathFinding] No walkable start node found nearby. Cannot find path.',
        );
        this.lastPathfindingSuccess = false;
        return [startWorldPos.clone()]; // 移動できないので開始点のみ返す
      }
    }

    // 目標地点が移動不能な場合、最も近い歩行可能なノードを探す
    if (!targetNode.isWalkable) {
      console.log(
        `[PathFinding] Target node (${endGridPos.x},${endGridPos.y}) is not walkable. Finding nearest walkable node.`,
      );
      const alternativeTarget = this.findNearestWalkableNode(targetNode); // 元の目標ノードを基準に探す
      if (alternativeTarget) {
        console.log(
          `[PathFinding] Found alternative target node: (${alternativeTarget.x},${alternativeTarget.y})`,
        );
        targetNode = alternativeTarget; // targetNode を更新
      } else {
        console.log(
          '[PathFinding] No walkable target node found nearby. Returning direct path to original target world pos.',
        );
        this.lastPathfindingSuccess = false;
        // 開始ノードの状態を元に戻す必要はない（alternativeStart で置き換えたため）
        // このケースでは alternativeStart は使われていないが、念のため
        if (
          !originalStartNodeIsWalkable &&
          startNode !== this.navMesh.getNode(startGridPos.x, startGridPos.y)
        ) {
          // startNodeが変更された場合、元のノードの状態を復元する必要があるかもしれないが、
          // findNearestWalkableNode は新しいノードを返すだけなので、元のノードの状態は変わらないはず。
          // ただし、startNode.isWalkable = true のような一時的な変更をしていた場合は戻す必要がある。
          // ここでは startNode を alternativeStart で置き換えているため、元のノードの isWalkable を戻す必要はない。
        }
        return [startWorldPos.clone(), endWorldPos.clone()]; // 近くに歩行可能な場所がなければ元の目標への直接パスを返す
      }
    }

    // A*アルゴリズムでパスを探索 (更新された可能性のある startNode と targetNode を使用)
    console.log(
      `[PathFinding] Running A* from (${startNode.x},${startNode.y}) to (${targetNode.x},${targetNode.y})`,
    );
    const path = this.aStarSearch(startNode, targetNode);

    // 開始ノードの状態を元に戻す必要はない（alternativeStart で置き換えたため）

    if (path.length === 0) {
      console.log(
        '[PathFinding] 経路が見つかりませんでした。直接経路を返します',
      );
      this.lastPathfindingSuccess = false;
      // A*で見つからなかった場合も、元の目標への直接パスを返す
      return [startWorldPos.clone(), endWorldPos.clone()];
    }

    console.log(
      '[PathFinding] Raw Path Found:',
      path.map((p) => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).join(' -> '),
    );
    this.lastPathfindingSuccess = true;
    const optimizedPath = this.optimizePath(path);
    console.log(
      '[PathFinding] Optimized Path:',
      optimizedPath
        .map((p) => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`)
        .join(' -> '),
    );
    return optimizedPath;
  }

  // パスの最適化
  private optimizePath(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length <= 2) return path;

    // パスの中間点を間引く（視認線が通るなら中間点を削除）
    const optimizedPath: THREE.Vector3[] = [path[0]];
    let currentPoint = 0;

    while (currentPoint < path.length - 1) {
      let nextPoint = currentPoint + 1;

      // 現在の点から直接見通せる最も遠い点を探す
      for (let i = path.length - 1; i > currentPoint; i--) {
        if (this.hasDirectLineOfSight(path[currentPoint], path[i])) {
          nextPoint = i;
          break;
        }
      }

      currentPoint = nextPoint;
      optimizedPath.push(path[currentPoint]);
    }

    return optimizedPath;
  }

  // 2点間に障害物がないか判定
  private hasDirectLineOfSight(
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): boolean {
    if (!this.navMesh) return true;

    const distance = start.distanceTo(end);
    // if (distance < 1.0) return true; // 距離が近くてもチェックする方が安全な場合がある
    if (distance < 0.1) return true; // 非常に近い場合はチェック不要

    const steps = Math.max(
      2,
      Math.ceil(distance / (this.navMesh['nodeSize'] * 0.5)),
    ); // チェック解像度を上げる (ノードサイズの半分ごと)
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    // console.log(`[LoS] Checking from (${start.x.toFixed(1)}, ${start.z.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.z.toFixed(1)}), Steps: ${steps}`); // ログ追加 (詳細すぎる可能性あり)

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkPoint = new THREE.Vector3().lerpVectors(start, end, t);

      const gridPos = this.navMesh.worldToGrid(checkPoint.x, checkPoint.z);
      const node = this.navMesh.getNode(gridPos.x, gridPos.y);

      if (!node || !node.isWalkable) {
        // console.log(`[LoS] Blocked at step ${i}/${steps}, point (${checkPoint.x.toFixed(1)}, ${checkPoint.z.toFixed(1)}), grid (${gridPos.x},${gridPos.y}), node walkable: ${node?.isWalkable}`); // ログ追加
        return false;
      }
    }
    // console.log(`[LoS] Path clear from (${start.x.toFixed(1)}, ${start.z.toFixed(1)}) to (${end.x.toFixed(1)}, ${end.z.toFixed(1)})`); // ログ追加
    return true;
  }

  // デバッグ用：経路をビジュアライズ
  public visualizePath(path: THREE.Vector3[]): THREE.Group {
    const pathGroup = new THREE.Group();

    if (path.length < 2) return pathGroup;

    // パスを線で表示
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(path);
    const pathMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const pathLine = new THREE.Line(pathGeometry, pathMaterial);
    pathGroup.add(pathLine);

    // パスの各点を球体で表示
    const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const startMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const endMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });

    // スタート地点
    const startSphere = new THREE.Mesh(sphereGeometry, startMaterial);
    startSphere.position.copy(path[0]);
    pathGroup.add(startSphere);

    // 中間点
    for (let i = 1; i < path.length - 1; i++) {
      const sphere = new THREE.Mesh(sphereGeometry, pointMaterial);
      sphere.position.copy(path[i]);
      pathGroup.add(sphere);
    }

    // エンド地点
    if (path.length > 1) {
      const endSphere = new THREE.Mesh(sphereGeometry, endMaterial);
      endSphere.position.copy(path[path.length - 1]);
      pathGroup.add(endSphere);
    }

    return pathGroup;
  }

  // デバッグ用：現在のパス探索の成功/失敗状態を取得
  public isLastPathfindingSuccessful(): boolean {
    return this.lastPathfindingSuccess;
  }
}
