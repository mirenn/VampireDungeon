import * as THREE from 'three';

export class Enemy {
  public mesh: THREE.Object3D;
  public health: number = 30;
  public maxHealth: number = 30;
  public damage: number = 5;
  public speed: number = 3;
  public experienceValue: number = 20;
  
  private attackCooldown: number = 0;
  private attackInterval: number = 1; // 1秒ごとに攻撃

  // 視認範囲と状態
  public detectionRange: number = 10; // プレイヤーを視認できる範囲
  public isPlayerDetected: boolean = false; // プレイヤーを視認しているか
  private detectionMesh: THREE.Mesh | null = null; // 視認範囲の可視化メッシュ
  private isDetectionVisible: boolean = false; // 視認範囲が表示されているか

  constructor() {
    // 敵のメッシュを作成
    const enemyGroup = new THREE.Group();
    
    // 体の作成（赤い円柱）
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75;
    body.castShadow = true;
    enemyGroup.add(body);
    
    // 頭の作成（黒いもの）
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.7;
    head.castShadow = true;
    enemyGroup.add(head);
    
    this.mesh = enemyGroup;
    this.mesh.name = 'enemy';
    
    // 衝突判定用のバウンディングボックス
    this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);

    // 視認範囲の可視化メッシュを作成（初期状態では非表示）
    this.createDetectionRangeMesh();
  }
  
  public update(deltaTime: number): void {
    // バウンディングボックスの更新
    this.mesh.userData.boundingBox.setFromObject(this.mesh);
    
    // 攻撃クールダウンの更新
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
    }

    // 視認範囲メッシュの位置を更新
    if (this.detectionMesh) {
      this.detectionMesh.position.copy(this.mesh.position);
    }
  }
  
  // プレイヤーに向かって移動
  public moveTowards(target: THREE.Vector3, deltaTime: number): void {
    const direction = new THREE.Vector3()
      .subVectors(target, this.mesh.position)
      .normalize();
    
    // Y軸（高さ）は無視
    direction.y = 0;
    
    // 移動速度を計算
    const moveDistance = this.speed * deltaTime;
    
    // 移動ベクトルを計算して適用
    const moveVec = direction.clone().multiplyScalar(moveDistance);
    this.mesh.position.add(moveVec);
    
    // 向きの更新
    if (direction.length() > 0.1) {
      const angle = Math.atan2(direction.x, direction.z);
      this.mesh.rotation.y = angle;
    }
  }
  
  // プレイヤーを視認しているか判定
  public checkPlayerDetection(playerPosition: THREE.Vector3): boolean {
    const distance = this.mesh.position.distanceTo(playerPosition);
    this.isPlayerDetected = distance <= this.detectionRange;
    
    // 視認状態に応じて視認範囲メッシュの色を変更
    if (this.detectionMesh) {
      const material = this.detectionMesh.material as THREE.MeshBasicMaterial;
      if (this.isPlayerDetected) {
        material.color.set(0xff0000); // 視認中は赤色
        material.opacity = 0.3;
      } else {
        material.color.set(0xffff00); // 非視認中は黄色
        material.opacity = 0.15;
      }
    }
    
    return this.isPlayerDetected;
  }

  // 視認範囲を可視化するメッシュを作成
  private createDetectionRangeMesh(): void {
    const geometry = new THREE.CylinderGeometry(this.detectionRange, this.detectionRange, 0.1, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    });
    
    this.detectionMesh = new THREE.Mesh(geometry, material);
    this.detectionMesh.position.copy(this.mesh.position);
    this.detectionMesh.position.y = 0.05; // 地面近くに配置
    this.detectionMesh.visible = this.isDetectionVisible;
  }

  // 視認範囲の可視化メッシュをシーンに追加
  public addDetectionRangeToScene(scene: THREE.Scene): void {
    if (this.detectionMesh) {
      scene.add(this.detectionMesh);
      this.isDetectionVisible = true;
      this.detectionMesh.visible = true;
    }
  }

  // 視認範囲の可視化メッシュをシーンから削除
  public removeDetectionRangeFromScene(scene: THREE.Scene): void {
    if (this.detectionMesh) {
      scene.remove(this.detectionMesh);
      this.isDetectionVisible = false;
    }
  }

  // 視認範囲の可視化メッシュの表示/非表示を切り替え
  public toggleDetectionRange(scene: THREE.Scene): void {
    if (this.isDetectionVisible) {
      this.removeDetectionRangeFromScene(scene);
    } else {
      this.addDetectionRangeToScene(scene);
    }
  }
  
  // 攻撃
  public attack(): boolean {
    if (this.attackCooldown <= 0) {
      // 攻撃クールダウンをリセット
      this.attackCooldown = this.attackInterval;
      return true;
    }
    return false;
  }
  
  // ダメージを受ける
  public takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health < 0) {
      this.health = 0;
    }
  }
  
  // 敵の位置を取得
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }
  
  // リソースの解放
  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // 視認範囲メッシュのリソース解放
    if (this.detectionMesh) {
      this.detectionMesh.geometry.dispose();
      (this.detectionMesh.material as THREE.Material).dispose();
    }
  }
}