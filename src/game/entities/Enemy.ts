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
  }
  
  public update(deltaTime: number): void {
    // バウンディングボックスの更新
    this.mesh.userData.boundingBox.setFromObject(this.mesh);
    
    // 攻撃クールダウンの更新
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
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
  }
}