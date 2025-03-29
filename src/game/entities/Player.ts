import * as THREE from 'three';

export class Player {
  public mesh: THREE.Object3D;
  public health: number = 100;
  public maxHealth: number = 100;
  public speed: number = 5;
  public attackPower: number = 10;
  public attackSpeed: number = 1;
  public attackRange: number = 2;
  public experience: number = 0;
  public level: number = 1;
  
  private direction: THREE.Vector3 = new THREE.Vector3(0, 0, -1);
  private attackCooldown: number = 0;
  private weapons: string[] = ['basic'];
  private items: string[] = [];

  constructor() {
    // プレイヤーのメッシュを作成
    const playerGroup = new THREE.Group();
    
    // 体の作成
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3050ff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    body.castShadow = true;
    playerGroup.add(body);
    
    // 頭の作成
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffccaa });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.0;
    head.castShadow = true;
    playerGroup.add(head);
    
    // 武器の作成
    const weaponGeometry = new THREE.BoxGeometry(0.2, 0.2, 1.5);
    const weaponMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weapon.position.set(0.6, 1.0, 0.4);
    weapon.rotation.z = Math.PI / 4;
    weapon.castShadow = true;
    playerGroup.add(weapon);
    
    this.mesh = playerGroup;
    this.mesh.name = 'player';
    
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
  
  // 指定した方向へ移動（右クリック移動用）
  public moveInDirection(direction: THREE.Vector3, distance: number): void {
    const moveVec = direction.clone().multiplyScalar(distance);
    this.mesh.position.add(moveVec);
    this.direction.copy(direction).normalize();
    this.rotateToDirection();
  }
  
  // 前進
  public moveForward(distance: number): void {
    const moveVec = new THREE.Vector3(0, 0, -1).multiplyScalar(distance);
    this.mesh.position.add(moveVec);
    this.direction.copy(moveVec).normalize();
    this.rotateToDirection();
  }
  
  // 後退
  public moveBackward(distance: number): void {
    const moveVec = new THREE.Vector3(0, 0, 1).multiplyScalar(distance);
    this.mesh.position.add(moveVec);
    this.direction.copy(moveVec).normalize();
    this.rotateToDirection();
  }
  
  // 左
  public moveLeft(distance: number): void {
    const moveVec = new THREE.Vector3(-1, 0, 0).multiplyScalar(distance);
    this.mesh.position.add(moveVec);
    this.direction.copy(moveVec).normalize();
    this.rotateToDirection();
  }
  
  // 右
  public moveRight(distance: number): void {
    const moveVec = new THREE.Vector3(1, 0, 0).multiplyScalar(distance);
    this.mesh.position.add(moveVec);
    this.direction.copy(moveVec).normalize();
    this.rotateToDirection();
  }
  
  // 向きの更新
  private rotateToDirection(): void {
    if (this.direction.length() > 0.1) {
      const angle = Math.atan2(this.direction.x, this.direction.z);
      this.mesh.rotation.y = angle;
    }
  }
  
  // 攻撃
  public attack(): boolean {
    if (this.attackCooldown <= 0) {
      // 攻撃クールダウンをリセット
      this.attackCooldown = 1 / this.attackSpeed;
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
  
  // 回復する
  public heal(amount: number): void {
    this.health += amount;
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }
  }
  
  // 経験値を獲得
  public gainExperience(amount: number): boolean {
    this.experience += amount;
    // レベルアップはせず、経験値だけを累積する
    return false; // レベルアップしない
  }
  
  // 武器を追加
  public addWeapon(weaponId: string): void {
    if (!this.weapons.includes(weaponId)) {
      this.weapons.push(weaponId);
    }
  }
  
  // アイテムを追加
  public addItem(itemId: string): void {
    this.items.push(itemId);
  }
  
  // プレイヤーの位置を取得
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }
  
  // プレイヤーの方向を取得
  public getDirection(): THREE.Vector3 {
    return this.direction.clone();
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