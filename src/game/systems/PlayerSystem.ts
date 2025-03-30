import * as THREE from 'three';
import { Player } from '../entities/Player';
import { LevelSystem } from './LevelSystem';
import { PathFindingSystem } from './PathFindingSystem';

export class PlayerSystem {
  private player: Player | null = null;
  private keyState: { [key: string]: boolean } = {};
  private targetPosition: THREE.Vector3 | null = null;
  private raycaster: THREE.Raycaster;
  private plane: THREE.Plane;
  private cameraOffset: THREE.Vector3;
  private cameraLerpFactor: number = 0.1; // カメラの追従速度（0〜1、値が大きいほど追従が速い）
  private levelSystem: LevelSystem | null = null;
  private pathFindingSystem: PathFindingSystem | null = null;
  private pathToFollow: THREE.Vector3[] = []; // 経路探索で生成されたパス
  private currentPathIndex: number = 0; // 現在のパスのインデックス
  private pathMarkers: THREE.Object3D[] = []; // パスを可視化するマーカー
  private showPath: boolean = true; // パスを可視化するかどうかのフラグ

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {
    // キー入力のイベントリスナーを設定
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    // 右クリックのイベントリスナーを設定
    window.addEventListener('contextmenu', this.onRightClick.bind(this));
    
    // Raycasterの初期化
    this.raycaster = new THREE.Raycaster();
    // 地面の平面を作成（Y=0の水平面）
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    // カメラのオフセット位置（プレイヤーからの相対位置）
    this.cameraOffset = new THREE.Vector3(0, 25, 25);
    this.cameraLerpFactor = 0.1; // カメラの追従速度（0〜1、値が大きいほど追従が速い）
  }

  public init(): void {
    // プレイヤーキャラクターの作成
    this.player = new Player();
    this.scene.add(this.player.mesh);
    
    // カメラの初期位置を設定
    this.updateCameraPosition();
  }

  // レベルシステムへの参照を設定
  public setLevelSystem(levelSystem: LevelSystem): void {
    this.levelSystem = levelSystem;
  }

  // パスファインディングシステムへの参照を設定
  public setPathFindingSystem(pathFindingSystem: PathFindingSystem): void {
    this.pathFindingSystem = pathFindingSystem;
  }

  public update(deltaTime: number): void {
    if (!this.player) return;

    // 現在位置を保存（衝突判定後に戻すため）
    const oldPosition = this.player.mesh.position.clone();

    // キーボードによる移動処理（開発中の利便性のために残しておく）
    const keyboardMoveSpeed = 10 * deltaTime;
    
    if (this.keyState['w'] || this.keyState['ArrowUp']) {
      this.player.moveForward(keyboardMoveSpeed);
      this.clearPath(); // キー入力があった場合、パスをリセット
    }
    if (this.keyState['s'] || this.keyState['ArrowDown']) {
      this.player.moveBackward(keyboardMoveSpeed);
      this.clearPath(); // キー入力があった場合、パスをリセット
    }
    if (this.keyState['a'] || this.keyState['ArrowLeft']) {
      this.player.moveLeft(keyboardMoveSpeed);
      this.clearPath(); // キー入力があった場合、パスをリセット
    }
    if (this.keyState['d'] || this.keyState['ArrowRight']) {
      this.player.moveRight(keyboardMoveSpeed);
      this.clearPath(); // キー入力があった場合、パスをリセット
    }

    // パス追跡による移動処理
    if (this.pathToFollow.length > 0 && this.currentPathIndex < this.pathToFollow.length) {
      const currentTarget = this.pathToFollow[this.currentPathIndex];
      const currentPos = this.player.getPosition();
      
      // 現在の目標点までの方向と距離を計算
      const direction = new THREE.Vector3().subVectors(currentTarget, currentPos);
      direction.y = 0; // Y軸の移動を無視
      const distance = direction.length();
      
      // プレイヤーの向きを徐々に移動方向に変える
      this.player.smoothLookAt(currentTarget, 5 * deltaTime); // 回転速度を調整
      
      // 次の目標点に十分近づいたらインデックスを進める
      if (distance < 0.5) {
        this.currentPathIndex++;
        
        // 次の目標点に徐々に加速（滑らかな動き）
        if (this.currentPathIndex < this.pathToFollow.length) {
          const nextTarget = this.pathToFollow[this.currentPathIndex];
          // プレイヤーの次の方向を設定（移動方向変化をスムーズにする）
          this.player.prepareNextDirection(
            nextTarget, 
            this.currentPathIndex < this.pathToFollow.length - 1 ? 
              this.pathToFollow[this.currentPathIndex + 1] : null
          );
        }
        
        // パスの終点に到達した場合
        if (this.currentPathIndex >= this.pathToFollow.length) {
          // パスをクリア
          this.clearPath();
        }
      } else {
        // 移動方向を正規化して移動量を計算
        direction.normalize();
        // カーブに応じたスピード調整（曲がり角で減速）
        let speedFactor = 1.0;
        
        // 次の点があるかつ、現在と次の点の間に大きな角度がある場合は減速
        if (this.currentPathIndex < this.pathToFollow.length - 1) {
          const nextPoint = this.pathToFollow[this.currentPathIndex + 1];
          const currentToTarget = new THREE.Vector3().subVectors(currentTarget, currentPos).normalize();
          const targetToNext = new THREE.Vector3().subVectors(nextPoint, currentTarget).normalize();
          const turnAngle = currentToTarget.angleTo(targetToNext);
          
          // 角度が大きいほど減速
          if (turnAngle > Math.PI / 6) { // 30度以上なら減速
            speedFactor = Math.max(0.5, 1 - turnAngle / Math.PI); // 速度を最低50%まで
          }
        }
        
        const moveSpeed = this.player.speed * deltaTime * speedFactor;
        const moveDistance = Math.min(moveSpeed, distance); // 目標を超えないようにする
        
        // プレイヤーを移動
        this.player.moveInDirection(direction, moveDistance);
      }
    }
    // 直線的な右クリック移動処理（パスが見つからなかった場合のフォールバック）
    else if (this.targetPosition) {
      const currentPos = this.player.getPosition();
      const direction = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
      direction.y = 0; // Y軸の移動を無視
      
      // プレイヤーの向きを徐々に移動方向に変える
      this.player.smoothLookAt(this.targetPosition, 5 * deltaTime);
      
      // 目標位置までの距離
      const distance = direction.length();
      
      // 目標位置に近づいた場合、移動を終了
      if (distance < 0.1) {
        this.targetPosition = null;
      } else {
        // 移動方向を正規化して移動量を計算
        direction.normalize();
        
        const moveSpeed = this.player.speed * deltaTime;
        const moveDistance = Math.min(moveSpeed, distance); // 目標を超えないようにする
        
        // プレイヤーを移動
        this.player.moveInDirection(direction, moveDistance);
      }
    }

    // プレイヤーの更新処理
    this.player.update(deltaTime);
    
    // 壁との衝突判定
    if (this.levelSystem) {
      const playerBoundingBox = this.player.mesh.userData.boundingBox;
      if (this.levelSystem.checkWallCollision(playerBoundingBox)) {
        // 壁と衝突している場合は位置を元に戻す
        this.player.mesh.position.copy(oldPosition);
        this.player.update(0); // バウンディングボックスを更新
        
        // 経路再計算が必要な場合（パスに沿って移動中に衝突した場合）
        if (this.pathToFollow.length > 0) {
          // 少し遅延させて再計算を試みる（数フレーム連続で衝突しないようにするため）
          setTimeout(() => this.recalculatePath(), 100);
        }
      }

      // 出口との衝突判定
      if (this.levelSystem.checkExitCollision(playerBoundingBox)) {
        // 次のレベルへ進む
        const nextLevel = this.levelSystem.getCurrentLevel() + 1;
        this.levelSystem.loadLevel(nextLevel);
        console.log(`レベル${nextLevel}へ進みました！`);
        
        // パスをクリア
        this.clearPath();
        
        // パスファインディングシステムにレベル変更を通知
        if (this.pathFindingSystem) {
          this.pathFindingSystem.setUpdateRequired();
        }
        
        // グローバルレベル情報を更新（UI用）
        (window as any).gameLevel = nextLevel;
      }
    }
    
    // カメラの位置を更新
    this.updateCameraPosition();
  }

  public dispose(): void {
    // イベントリスナーの削除
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    window.removeEventListener('contextmenu', this.onRightClick.bind(this));
    
    // プレイヤーの削除
    if (this.player) {
      this.scene.remove(this.player.mesh);
      this.player.dispose();
      this.player = null;
    }
    
    // パスマーカーの削除
    this.clearPathMarkers();
  }

  // キーが押された時の処理
  private onKeyDown(event: KeyboardEvent): void {
    this.keyState[event.key] = true;
    
    // Pキーでパス表示をトグル
    if (event.key === 'p' || event.key === 'P') {
      this.showPath = !this.showPath;
      console.log(`パスの表示: ${this.showPath ? 'オン' : 'オフ'}`);
      
      // パスの表示状態を更新
      for (const marker of this.pathMarkers) {
        marker.visible = this.showPath;
      }
    }
  }

  // キーが離された時の処理
  private onKeyUp(event: KeyboardEvent): void {
    this.keyState[event.key] = false;
  }

  // 右クリックの処理
  private onRightClick(event: MouseEvent): void {
    event.preventDefault(); // デフォルトのコンテキストメニューを表示しない
    
    if (!this.player || !this.pathFindingSystem) return;
    
    // マウス位置の正規化（-1〜1の範囲）
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // レイキャスターを設定（カメラとマウス位置から光線を飛ばす）
    this.raycaster.setFromCamera(mouse, this.camera);
    
    // 地面との交点を計算
    const ray = this.raycaster.ray;
    const targetPoint = new THREE.Vector3();
    
    if (ray.intersectPlane(this.plane, targetPoint)) {
      // 交点を目標位置として設定（最初のクリック位置を記録）
      const originalTarget = targetPoint.clone();
      let validTargetFound = false;
      
      // レベルシステムが存在する場合は障害物チェックを行う
      if (this.levelSystem) {
        const levelWalls = this.levelSystem.getWalls();
        const minSafeDistance = 1.2; // 障害物からの最小安全距離を増加
        
        // クリック地点が障害物内かどうかをチェック
        let insideObstacle = false;
        let nearestObstaclePoint: THREE.Vector3 | null = null;
        let minDistance = Number.MAX_VALUE;
        
        // クリック位置が直接障害物内にあるかチェック - 判定の厳密化
        const tempBox = new THREE.Box3().setFromCenterAndSize(
          targetPoint,
          new THREE.Vector3(0.05, 0.05, 0.05) // より小さいボックスでチェック
        );
        
        // 障害物との衝突チェック（レイキャストも使用して厳密化）
        let obstacleHit = false;
        let obstacleDistance = Number.MAX_VALUE;
        let obstacleNormal = new THREE.Vector3();
        
        // カメラからターゲットポイントへのレイをチェック
        this.raycaster.setFromCamera(mouse, this.camera);
        const obstacleHits = this.raycaster.intersectObjects(levelWalls, true);
        if (obstacleHits.length > 0) {
          obstacleHit = true;
          obstacleDistance = obstacleHits[0].distance;
          if (obstacleHits[0].face) {
            obstacleNormal.copy(obstacleHits[0].face.normal);
            // ワールド座標系に変換
            if (obstacleHits[0].object.parent) {
              obstacleNormal.transformDirection(obstacleHits[0].object.matrixWorld);
            }
          }
        }
        
        // 障害物との衝突チェック
        for (const wall of levelWalls) {
          const wallBox = wall.userData.boundingBox || new THREE.Box3().setFromObject(wall);
          
          // 1. クリック位置が障害物と直接衝突している場合
          if (tempBox.intersectsBox(wallBox)) {
            insideObstacle = true;
            
            // 障害物の中心を取得
            const wallCenter = new THREE.Vector3();
            wallBox.getCenter(wallCenter);
            
            // 障害物の最も近い点を見つける
            const closestPoint = new THREE.Vector3();
            wallBox.clampPoint(targetPoint, closestPoint);
            
            const distance = targetPoint.distanceTo(closestPoint);
            if (distance < minDistance) {
              minDistance = distance;
              nearestObstaclePoint = closestPoint.clone();
            }
          }
          
          // 2. クリック位置が障害物の安全距離内にある場合
          const expandedBox = wallBox.clone().expandByScalar(minSafeDistance);
          if (expandedBox.containsPoint(targetPoint)) {
            // 障害物との最短距離を計算
            const closestPoint = new THREE.Vector3();
            wallBox.clampPoint(targetPoint, closestPoint);
            
            const distance = targetPoint.distanceTo(closestPoint);
            if (distance < minSafeDistance && distance < minDistance) {
              insideObstacle = true;
              minDistance = distance;
              nearestObstaclePoint = closestPoint.clone();
            }
          }
        }
        
        // 障害物内または障害物に近すぎる場合、安全な場所を計算
        if (insideObstacle && nearestObstaclePoint) {
          console.log("クリック位置が障害物内または障害物に近すぎます。安全な位置を計算します。");
          
          // プレイヤーの現在位置を取得
          const playerPos = this.player.getPosition();
          
          // 障害物からの方向ベクトルを計算するための様々な要素
          let safeDirection = new THREE.Vector3();
          
          // 1. 障害物の中心/表面からプレイヤー方向へのベクトル
          const dirFromObstacle = new THREE.Vector3().subVectors(playerPos, nearestObstaclePoint).normalize();
          
          // 2. レイキャストで取得した障害物の法線（ある場合）
          if (obstacleHit && obstacleNormal.lengthSq() > 0) {
            // 法線とプレイヤー方向を組み合わせる
            safeDirection.addScaledVector(obstacleNormal, 0.7);
            safeDirection.addScaledVector(dirFromObstacle, 0.3);
          } 
          // 3. 障害物からクリック方向への考慮
          else {
            // 障害物中心からクリック方向へのベクトル
            const dirToOriginalClick = new THREE.Vector3().subVectors(originalTarget, nearestObstaclePoint).normalize();
            
            // 完全に障害物内にいる場合は、プレイヤー方向を優先
            if (tempBox.intersectsBox(new THREE.Box3().setFromObject(levelWalls[0]))) {
              safeDirection.addScaledVector(dirFromObstacle, 0.7);
              safeDirection.addScaledVector(dirToOriginalClick, 0.3);
            } else {
              // 安全距離内の場合はクリック方向を優先
              safeDirection.addScaledVector(dirToOriginalClick, 0.7);
              safeDirection.addScaledVector(dirFromObstacle, 0.3);
            }
          }
          
          // 安全方向の正規化
          safeDirection.normalize();
          
          // 安全な距離だけ障害物から離れた位置を計算
          const safeOffset = Math.max(minSafeDistance * 1.5, minDistance + minSafeDistance);
          targetPoint.copy(nearestObstaclePoint).addScaledVector(safeDirection, safeOffset);
          
          // 新しい位置が別の障害物と衝突していないか確認
          let isSafe = true;
          for (let attempt = 0; attempt < 3; attempt++) {
            const safeBox = new THREE.Box3().setFromCenterAndSize(
              targetPoint,
              new THREE.Vector3(1.0, 1.0, 1.0)
            );
            
            isSafe = true;
            for (const wall of levelWalls) {
              const wallBox = wall.userData.boundingBox || new THREE.Box3().setFromObject(wall);
              if (safeBox.intersectsBox(wallBox)) {
                isSafe = false;
                // 方向を少し変え、距離を増やして再試行
                safeDirection.add(new THREE.Vector3(Math.random() * 0.2 - 0.1, 0, Math.random() * 0.2 - 0.1)).normalize();
                targetPoint.copy(nearestObstaclePoint).addScaledVector(safeDirection, safeOffset * (1 + attempt * 0.5));
                break;
              }
            }
            
            if (isSafe) break;
          }
          
          if (isSafe) {
            validTargetFound = true;
            console.log("安全な目標位置を見つけました");
          } else {
            console.log("安全な目標位置が見つかりません。パスファインディングに任せます。");
            // 最後の手段として、元のクリック位置を使用し、パスファインダーに代替経路を見つけさせる
            targetPoint.copy(originalTarget);
          }
        } else {
          // 障害物と衝突していない場合は、元のクリック位置を使用
          validTargetFound = true;
        }
      } else {
        // レベルシステムがない場合は、元のクリック位置を使用
        validTargetFound = true;
      }
    }
    
    // 安全な目標位置またはオリジナルのクリック位置を使用
    this.targetPosition = targetPoint;
    
    // パスファインディングで経路を探索
    const startPos = this.player.getPosition();
    const path = this.pathFindingSystem.findPath(startPos, targetPoint);
    
    // パスが見つかった場合
    if (path.length > 0) {
      this.clearPath(); // 既存のパスをクリア
      this.pathToFollow = path;
      this.currentPathIndex = 0;
      
      // パスの可視化
      this.createPathMarkers();
      
      // 初期方向を設定（移動の開始をスムーズに）
      if (path.length > 1) {
        this.player.prepareNextDirection(path[0], path[1]);
      }
      
      // 移動先を視覚的に示すためのエフェクト（成功: 緑色）
      this.showClickEffect(targetPoint, 0x00ff00);
    } else {
      // パスが見つからなかった場合
      console.log("目標位置への経路が見つかりませんでした");
      
      // 最後のリゾートとして、プレイヤーから見て目標方向にレイキャストを行い、
      // 障害物のない最も遠い地点を見つける
      const playerPos = this.player.getPosition();
      const direction = new THREE.Vector3().subVectors(targetPoint, playerPos).normalize();
      
      // プレイヤーから目標方向への最大距離
      const maxDistance = playerPos.distanceTo(targetPoint);
      const rayStart = playerPos.clone();
      rayStart.y += 0.5; // 地面からやや上
      
      this.raycaster.set(rayStart, direction);
      const intersections = this.raycaster.intersectObjects(this.levelSystem ? this.levelSystem.getWalls() : [], true);
      
      if (intersections.length > 0 && intersections[0].distance < maxDistance) {
        // 障害物にぶつかる場合、その手前の安全な位置を計算
        const safeDistance = Math.max(0, intersections[0].distance - 1.5);
        if (safeDistance > 0.5) { // 最低限の移動距離があるなら
          const fallbackTarget = new THREE.Vector3()
            .copy(playerPos)
            .addScaledVector(direction, safeDistance);
          
          // フォールバック経路を試す
          const fallbackPath = this.pathFindingSystem.findPath(startPos, fallbackTarget);
          if (fallbackPath.length > 0) {
            this.clearPath();
            this.pathToFollow = fallbackPath;
            this.currentPathIndex = 0;
            this.createPathMarkers();
            
            if (fallbackPath.length > 1) {
              this.player.prepareNextDirection(fallbackPath[0], fallbackPath[1]);
            }
            
            // 移動先を視覚的に示すためのエフェクト（代替経路: 橙色）
            this.showClickEffect(fallbackTarget, 0xFFA500);
            return;
          }
        }
      }
      
      // いかなる経路も見つからなかった場合はエフェクトを赤色に
      this.showClickEffect(targetPoint, 0xff0000);
    }
  }

  // パスの可視化マーカーを作成
  private createPathMarkers(): void {
    this.clearPathMarkers(); // 既存のマーカーをクリア
    
    if (!this.showPath) return; // パス表示がオフの場合は何もしない
    
    // マーカーのマテリアル
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5
    });
    
    // パスの各ポイントにマーカーを配置
    for (let i = 0; i < this.pathToFollow.length; i++) {
      const point = this.pathToFollow[i];
      
      // マーカーのジオメトリ（小さい円柱）
      const markerGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      
      marker.position.copy(point);
      marker.position.y = 0.05; // 地面のすぐ上に表示
      
      this.scene.add(marker);
      this.pathMarkers.push(marker);
    }
    
    // 終点のマーカーは少し大きく、色も変える
    if (this.pathMarkers.length > 0) {
      const lastMarker = this.pathMarkers[this.pathMarkers.length - 1] as THREE.Mesh;
      lastMarker.scale.set(1.5, 1, 1.5);
      (lastMarker.material as THREE.MeshBasicMaterial).color.set(0xff0000);
    }
  }

  // パスマーカーを削除
  private clearPathMarkers(): void {
    for (const marker of this.pathMarkers) {
      this.scene.remove(marker);
    }
    this.pathMarkers = [];
  }

  // パスをクリア
  private clearPath(): void {
    this.pathToFollow = [];
    this.currentPathIndex = 0;
    this.clearPathMarkers();
  }

  // 経路を再計算
  private recalculatePath(): void {
    if (!this.player || !this.pathFindingSystem || !this.targetPosition || this.pathToFollow.length === 0) return;
    
    // 経路再計算を試みる
    const startPos = this.player.getPosition();
    
    // 現在の障害物との衝突位置を避けるため、少し離れた位置から計算を開始
    const currentPathIndex = Math.min(this.currentPathIndex, this.pathToFollow.length - 1);
    const directionToNextPoint = new THREE.Vector3().subVectors(
      this.pathToFollow[currentPathIndex], 
      startPos
    ).normalize();
    
    // 今プレイヤーがいる場所はおそらく障害物と衝突しているので、
    // 衝突判定が起きた方向から少し離れた位置から計算しなおす
    const offsetStartPos = startPos.clone().sub(directionToNextPoint.multiplyScalar(0.5));
    
    // 新しい経路を探索
    const path = this.pathFindingSystem.findPath(offsetStartPos, this.targetPosition);
    
    // パスが見つかった場合は新しいパスを使用
    if (path.length > 0) {
      this.pathToFollow = path;
      this.currentPathIndex = 0;
      
      // パスの可視化を更新
      this.createPathMarkers();
      console.log("経路を再計算しました");
    } else {
      // パスが見つからない場合は、目標地点へより慎重に近づくか、別のアプローチを試す
      console.log("経路再計算に失敗しました。直接移動を試みます");
      
      // 現在のパスをクリア
      this.clearPath();
      
      // 目標地点に直接向かう（フォールバックメカニズム）
      // 次の更新サイクルで直線移動処理が行われる
    }
  }

  // 移動先を示すエフェクトを表示
  private showClickEffect(position: THREE.Vector3, color: number = 0x00ff00): void {
    // 既存のエフェクトがあれば削除
    const existingEffect = this.scene.getObjectByName('moveTargetEffect');
    if (existingEffect) {
      this.scene.remove(existingEffect);
    }
    
    // シンプルなエフェクト（円形のジオメトリ）
    const geometry = new THREE.RingGeometry(0.5, 0.7, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: color, // 引数で色を指定できるように変更
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    const effect = new THREE.Mesh(geometry, material);
    effect.name = 'moveTargetEffect';
    effect.position.copy(position);
    effect.position.y = 0.05; // 地面のすぐ上に表示
    effect.rotation.x = -Math.PI / 2; // 水平に寝かせる
    
    this.scene.add(effect);
    
    // アニメーション効果を追加（拡大・縮小）
    const startScale = 0.5;
    effect.scale.set(startScale, startScale, startScale);
    
    // 拡大アニメーション
    const animateScale = () => {
      effect.scale.x += 0.05;
      effect.scale.y += 0.05;
      effect.scale.z += 0.05;
      
      if (effect.scale.x <= 1.2) {
        requestAnimationFrame(animateScale);
      }
    };
    
    animateScale();
    
    // 1秒後にエフェクトを削除
    setTimeout(() => {
      if (effect.parent) {
        this.scene.remove(effect);
      }
    }, 1000);
  }

  // カメラの位置を更新（プレイヤーを追従）
  private updateCameraPosition(): void {
    if (!this.player) return;
    
    // プレイヤーの現在位置を取得
    const playerPosition = this.player.getPosition();
    
    // カメラの目標位置を計算（プレイヤー位置 + オフセット）
    const targetCameraPosition = playerPosition.clone().add(this.cameraOffset);
    
    // 現在のカメラ位置から目標位置へ滑らかに移動（線形補間）
    this.camera.position.lerp(targetCameraPosition, this.cameraLerpFactor);
    
    // カメラの注視点を固定方向に設定（回転を防止）
    const lookAtPoint = playerPosition.clone();
    this.camera.lookAt(lookAtPoint);
    
    // カメラの向きを固定
    this.camera.rotation.z = 0; // Z軸の回転を0に保つ
    
    // オルソグラフィックカメラの投影行列を更新
    if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.updateProjectionMatrix();
    }
  }

  // プレイヤーの参照を取得
  public getPlayer(): Player | null {
    return this.player;
  }
}