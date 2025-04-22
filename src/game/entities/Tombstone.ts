import * as THREE from 'three';
// Tombstone.ts
// 墓石エンティティ

export class Tombstone {
  x: number;
  y: number;
  isDestroyed: boolean = false;
  mesh?: THREE.Mesh; // 追加
  onDestroyed?: () => void;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  destroy() {
    this.isDestroyed = true;
    if (this.onDestroyed) this.onDestroyed();
    // ここでmeshの可視化や物理的な削除処理も追加可能
  }
  checkCollision(box: THREE.Box3): boolean {
    if (!this.mesh) return false;
    if (!this.mesh.userData.boundingBox) {
      this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(
        this.mesh,
      );
    }
    return this.mesh.userData.boundingBox.intersectsBox(box);
  }
}
