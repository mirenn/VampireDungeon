import * as THREE from 'three';
import { Enemy } from './Enemy';

export class JellySlime extends Enemy {
  private splitLevel: number = 0; // 0: 分裂前, 1: 分裂後
  private jumpTime: number = 0;
  private jumpHeight: number = 0.5;
  private jumpSpeed: number = 4;
  private slimeMesh: THREE.Mesh; // ★★★ 追加: スライム本体のメッシュを保持 ★★★
  private baseSize: number; // スライムの基本サイズを保持
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

    this.baseSize = this.splitLevel === 0 ? 0.6 : 0.4;
    const geometry = new THREE.SphereGeometry(this.baseSize, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x44aa88,
      transparent: true,
      opacity: 0.8,
    });
    // ★★★ 変更: クラスプロパティに代入 ★★★
    this.slimeMesh = new THREE.Mesh(geometry, material);
    this.slimeMesh.castShadow = true;
    // ★★★ 変更: slimeMesh の初期Y位置を設定 ★★★
    this.slimeMesh.position.y = this.baseSize;

    // ★★★ 変更: this.slimeMesh を this.mesh に追加 ★★★
    this.mesh.add(this.slimeMesh);
    this.mesh.name = 'jellySlime';

    this.createHPBar();

    this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);
  }
  public update(deltaTime: number): void {
    // 跳ねるアニメーション
    this.jumpTime += deltaTime * this.jumpSpeed;
    const jumpOffset = Math.abs(Math.sin(this.jumpTime)) * this.jumpHeight;
    // ★★★ 変更: this.mesh ではなく this.slimeMesh のY座標を変更 ★★★
    this.slimeMesh.position.y = (this.splitLevel === 0 ? 0.6 : 0.4) + jumpOffset;

    // バウンディングボックスはグループ全体で更新
    this.mesh.userData.boundingBox.setFromObject(this.mesh);

    // HPバーの更新は最後に行う（スライムの位置変更の後）
    super.update(deltaTime);
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

  // ★★★ 修正: disposeメソッドでslimeMeshのリソースも解放 ★★★
  public dispose(): void {
    if (this.slimeMesh) {
      this.slimeMesh.geometry.dispose();
      if (Array.isArray(this.slimeMesh.material)) {
        this.slimeMesh.material.forEach(m => m.dispose());
      } else {
        this.slimeMesh.material.dispose();
      }
    }
    super.dispose();
  }

  // HPバーの位置を安定させるために、Enemyクラスのメソッドをオーバーライド
  protected updateHPBarPosition(): void {
    // 親クラスのhpBarContainerプロパティを参照するために型アサーションを使用
    const hpBarContainer = (this as any).hpBarContainer;
    if (hpBarContainer) {      // 跳ねるアニメーションに影響されない固定の高さに配置
      // baseSize（スライムの基本サイズ）に基づいて位置を決定
      const fixedHeight = this.baseSize * 2 + 1.5; // スライムの直径 + かなり大きな余白で高く配置
      hpBarContainer.position.y = fixedHeight;

      // HPバーを常に水平に保つ新しい実装
      // 完全に敵の回転から独立させる
      const worldPosition = new THREE.Vector3();
      this.mesh.getWorldPosition(worldPosition);
      hpBarContainer.position.y = fixedHeight;

      // 完全にリセットして敵の回転を無効化
      hpBarContainer.rotation.set(0, 0, 0); // 回転をリセット
      
      // 常にXZ平面に水平になるよう強制
      hpBarContainer.lookAt(
        worldPosition.x, 
        worldPosition.y + 10, // 真上を向かせる
        worldPosition.z
      );
      
      // 水平に表示されるよう90度回転
      hpBarContainer.rotateX(Math.PI / 2);
    }
  }
}