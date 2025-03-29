import * as THREE from 'three';
import { Player } from '../entities/Player';

export class PlayerSystem {
  private player: Player | null = null;
  private keyState: { [key: string]: boolean } = {};
  private targetPosition: THREE.Vector3 | null = null;
  private raycaster: THREE.Raycaster;
  private plane: THREE.Plane;
  private cameraOffset: THREE.Vector3;
  private cameraLerpFactor: number = 0.1; // カメラの追従速度（0〜1、値が大きいほど追従が速い）

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
    this.cameraOffset = new THREE.Vector3(0, 15, 15);
  }

  public init(): void {
    // プレイヤーキャラクターの作成
    this.player = new Player();
    this.scene.add(this.player.mesh);
    
    // カメラの初期位置を設定
    this.updateCameraPosition();
  }

  public update(deltaTime: number): void {
    if (!this.player) return;

    // キーボードによる移動処理（開発中の利便性のために残しておく）
    const keyboardMoveSpeed = 10 * deltaTime;
    
    if (this.keyState['w'] || this.keyState['ArrowUp']) {
      this.player.moveForward(keyboardMoveSpeed);
      this.targetPosition = null; // キー入力があった場合、目標位置をリセット
    }
    if (this.keyState['s'] || this.keyState['ArrowDown']) {
      this.player.moveBackward(keyboardMoveSpeed);
      this.targetPosition = null; // キー入力があった場合、目標位置をリセット
    }
    if (this.keyState['a'] || this.keyState['ArrowLeft']) {
      this.player.moveLeft(keyboardMoveSpeed);
      this.targetPosition = null; // キー入力があった場合、目標位置をリセット
    }
    if (this.keyState['d'] || this.keyState['ArrowRight']) {
      this.player.moveRight(keyboardMoveSpeed);
      this.targetPosition = null; // キー入力があった場合、目標位置をリセット
    }

    // 右クリックでの移動処理
    if (this.targetPosition) {
      const currentPos = this.player.getPosition();
      const direction = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
      direction.y = 0; // Y軸の移動を無視
      
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
  }

  // キーが押された時の処理
  private onKeyDown(event: KeyboardEvent): void {
    this.keyState[event.key] = true;
  }

  // キーが離された時の処理
  private onKeyUp(event: KeyboardEvent): void {
    this.keyState[event.key] = false;
  }

  // 右クリックの処理
  private onRightClick(event: MouseEvent): void {
    event.preventDefault(); // デフォルトのコンテキストメニューを表示しない
    
    if (!this.player) return;
    
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
      // 交点があれば目標位置として設定
      this.targetPosition = targetPoint;
      
      // 移動先を視覚的に示すためのエフェクト（オプション）
      this.showClickEffect(targetPoint);
    }
  }

  // 移動先を示すエフェクトを表示（オプション実装）
  private showClickEffect(position: THREE.Vector3): void {
    // 既存のエフェクトがあれば削除
    const existingEffect = this.scene.getObjectByName('moveTargetEffect');
    if (existingEffect) {
      this.scene.remove(existingEffect);
    }
    
    // シンプルなエフェクト（円形のジオメトリ）
    const geometry = new THREE.RingGeometry(0.5, 0.7, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
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
    
    // 1秒後にエフェクトを削除
    setTimeout(() => {
      if (effect.parent) {
        this.scene.remove(effect);
      }
    }, 1000);
  }

  // カメラの位置を更新（プレイヤーを追従）
  private updateCameraPosition(): void {
    if (!this.player || !(this.camera instanceof THREE.PerspectiveCamera)) return;
    
    // プレイヤーの現在位置を取得
    const playerPosition = this.player.getPosition();
    
    // カメラの目標位置を計算（プレイヤー位置 + オフセット）
    const targetCameraPosition = playerPosition.clone().add(this.cameraOffset);
    
    // 現在のカメラ位置から目標位置へ滑らかに移動（線形補間）
    this.camera.position.lerp(targetCameraPosition, this.cameraLerpFactor);
    
    // カメラの注視点をプレイヤーに設定
    this.camera.lookAt(playerPosition);
  }

  // プレイヤーの参照を取得
  public getPlayer(): Player | null {
    return this.player;
  }
}