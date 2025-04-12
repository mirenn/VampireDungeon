import * as THREE from 'three';
import { Enemy } from './Enemy';

export class JellySlime extends Enemy {
  private splitLevel: number = 0; // 0: 分裂前, 1: 分裂後
  private jumpTime: number = 0;
  private jumpHeight: number = 0.5;
  private jumpSpeed: number = 4;

  constructor(splitLevel: number = 0) {
    super();
    this.splitLevel = splitLevel;

    // 基本的なステータスを上書き
    this.health = this.splitLevel === 0 ? 20 : 10; // 分裂後は体力を半分に
    this.maxHealth = this.health;
    this.damage = this.splitLevel === 0 ? 4 : 2; // 分裂後はダメージを半分に
    this.speed = this.splitLevel === 0 ? 1.5 : 2; // 分裂後は少し速く
    this.experienceValue = this.splitLevel === 0 ? 15 : 5; // 分裂後は経験値を少なく

    // メッシュをジェリー・スライム用に変更
    this.mesh.clear(); // 既存のメッシュをクリア

    const size = this.splitLevel === 0 ? 0.6 : 0.4; // 分裂後はサイズを小さく
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x44aa88, // 緑がかった色
      transparent: true,
      opacity: 0.8,
    });
    const slimeMesh = new THREE.Mesh(geometry, material);
    slimeMesh.castShadow = true;
    slimeMesh.position.y = size; // 地面に接するように調整

    this.mesh.add(slimeMesh); // 新しいメッシュを追加
    this.mesh.name = 'jellySlime';

    // バウンディングボックスの再計算
    this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);
  }

  public update(deltaTime: number): void {
    super.update(deltaTime); // 親クラスのupdateを呼び出す

    // 跳ねるアニメーション
    this.jumpTime += deltaTime * this.jumpSpeed;
    const jumpOffset = Math.abs(Math.sin(this.jumpTime)) * this.jumpHeight;
    this.mesh.position.y = (this.splitLevel === 0 ? 0.6 : 0.4) + jumpOffset; // 基本の高さ + ジャンプオフセット

    // バウンディングボックスの更新も忘れずに
    this.mesh.userData.boundingBox.setFromObject(this.mesh);
  }

  // プレイヤーに向かって移動（跳ねる動きを追加）
  public moveTowards(target: THREE.Vector3, deltaTime: number): void {
    const direction = new THREE.Vector3()
      .subVectors(target, this.mesh.position)
      .normalize();

    // Y軸（高さ）は無視して方向を決める
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

  public canSplit(): boolean {
    return this.splitLevel === 0;
  }

  public getSplitLevel(): number {
    return this.splitLevel;
  }

  // ダメージを受けた際の処理（オーバーライドは不要かもしれないが、将来的な拡張用に残す）
  public takeDamage(amount: number): void {
    super.takeDamage(amount);
    // 必要であれば、ダメージを受けた際の特殊効果などをここに追加
  }

  // リソース解放処理もオーバーライド（必要であれば）
  public dispose(): void {
    super.dispose();
    // JellySlime固有のリソース解放があればここに追加
  }
}
