import * as THREE from 'three';

export type ItemType = 'health' | 'weapon' | 'speed' | 'power';

export class Item {
  public mesh: THREE.Object3D;
  public type: ItemType;
  
  private rotationSpeed: number = 1.0;
  private bobSpeed: number = 2.0;
  private bobHeight: number = 0.2;
  private initialY: number = 0;
  private time: number = 0;

  constructor(type: ItemType) {
    this.type = type;
    
    // アイテムのメッシュを作成
    const itemGroup = new THREE.Group();
    
    // 共通の台座
    const baseGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.05;
    base.receiveShadow = true;
    itemGroup.add(base);
    
    // アイテムタイプごとに異なる形状と色
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    switch (type) {
      case 'health':
        // 回復アイテム（赤いハート）
        geometry = new THREE.SphereGeometry(0.3, 16, 16);
        material = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x330000 });
        break;
        
      case 'weapon':
        // 武器強化（青い立方体）
        geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        material = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x000033 });
        break;
        
      case 'speed':
        // 速度アップ（黄色い円錐）
        geometry = new THREE.ConeGeometry(0.2, 0.5, 16);
        material = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x333300 });
        break;
        
      case 'power':
        // 攻撃力アップ（紫のダイヤモンド）
        geometry = new THREE.OctahedronGeometry(0.3);
        material = new THREE.MeshStandardMaterial({ color: 0x8800ff, emissive: 0x220033 });
        break;
    }
    
    const itemMesh = new THREE.Mesh(geometry, material);
    itemMesh.position.y = 0.4;
    itemMesh.castShadow = true;
    itemGroup.add(itemMesh);
    
    this.mesh = itemGroup;
    this.mesh.name = `item-${type}`;
    this.initialY = this.mesh.position.y;
  }
  
  public update(deltaTime: number): void {
    // 時間更新
    this.time += deltaTime;
    
    // アイテムの回転アニメーション
    this.mesh.rotation.y += this.rotationSpeed * deltaTime;
    
    // アイテムの上下のアニメーション（浮遊感）
    const newY = this.initialY + Math.sin(this.time * this.bobSpeed) * this.bobHeight;
    this.mesh.position.y = newY;
  }
  
  // アイテムの位置を取得
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