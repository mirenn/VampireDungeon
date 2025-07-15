import * as THREE from 'three';
import { Player } from './Player';

export interface AutoAttackTarget {
  mesh: THREE.Object3D;
  takeDamage: (amount: number) => void;
  health: number;
  maxHealth: number;
}

export class AutoAttack {
  private static readonly ANIMATION_DURATION = 0.3; // 0.3秒のアニメーション時間
  private static readonly PROJECTILE_SPEED = 20; // 弾丸の速度
  private static readonly PROJECTILE_RADIUS = 0.1; // 弾丸の半径

  private player: Player;
  private target: AutoAttackTarget;
  private isAnimating: boolean = false;
  private animationStartTime: number = 0;
  private scene: THREE.Scene;
  private movementCancelled: boolean = false;

  constructor(player: Player, target: AutoAttackTarget, scene: THREE.Scene) {
    this.player = player;
    this.target = target;
    this.scene = scene;
  }

  public start(): boolean {
    if (this.isAnimating) {
      return false; // 既にアニメーション中
    }

    // 攻撃範囲内かチェック
    const distance = this.player.mesh.position.distanceTo(this.target.mesh.position);
    if (distance > this.player.attackRange) {
      return false;
    }

    // アニメーション開始
    this.isAnimating = true;
    this.animationStartTime = Date.now();
    this.movementCancelled = false;

    // プレイヤーを敵の方向に向ける
    this.rotatePlayerToTarget();

    console.log('オートアタック開始:', this.target.mesh.name);
    return true;
  }

  public update(_deltaTime: number, hasMovementInput: boolean): boolean {
    if (!this.isAnimating) {
      return true; // アニメーション完了
    }

    const elapsed = (Date.now() - this.animationStartTime) / 1000;

    // 移動入力でキャンセル
    if (hasMovementInput && !this.movementCancelled) {
      console.log('オートアタックが移動入力によりキャンセルされました');
      this.cancel();
      return true;
    }

    // 0.3秒経過で弾丸発射
    if (elapsed >= AutoAttack.ANIMATION_DURATION && !this.movementCancelled) {
      this.fireProjectile();
      this.isAnimating = false;
      return true;
    }

    return false; // アニメーション継続中
  }

  public cancel(): void {
    this.movementCancelled = true;
    this.isAnimating = false;
  }

  public isActive(): boolean {
    return this.isAnimating;
  }

  private rotatePlayerToTarget(): void {
    const playerPos = this.player.mesh.position;
    const targetPos = this.target.mesh.position;
    
    const direction = new THREE.Vector3().subVectors(targetPos, playerPos).normalize();
    direction.y = 0; // Y軸の回転を無視

    if (direction.length() > 0.01) {
      const angle = Math.atan2(direction.x, direction.z);
      this.player.mesh.rotation.y = angle;
      
      // プレイヤーの方向ベクトルも更新
      this.player.direction.copy(direction);
    }
  }

  private fireProjectile(): void {
    // 弾丸の作成
    const projectileGeometry = new THREE.SphereGeometry(AutoAttack.PROJECTILE_RADIUS, 16, 16);
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: 0x6699ff,
      emissive: 0x4477cc,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });

    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectile.name = 'autoAttackProjectile';

    // 発射位置（プレイヤーの上半身から）
    const startPosition = this.player.mesh.position.clone();
    startPosition.y += 1.3;
    projectile.position.copy(startPosition);

    // 目標方向
    const direction = new THREE.Vector3()
      .subVectors(this.target.mesh.position, startPosition)
      .normalize();

    // バウンディングボックス設定
    projectile.userData.boundingBox = new THREE.Box3().setFromObject(projectile);
    projectile.userData.boundingBox.expandByScalar(0.5);

    this.scene.add(projectile);

    // 弾丸のアニメーション
    this.animateProjectile(projectile, direction);

    // パッシブスキル効果チェック
    this.triggerPassiveEffect();
  }

  private animateProjectile(projectile: THREE.Mesh, direction: THREE.Vector3): void {
    const maxDistance = 15; // 最大飛距離
    let distance = 0;
    let lastTimestamp = performance.now();
    let hasHit = false;

    const animate = (timestamp: number) => {
      const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      lastTimestamp = timestamp;

      if (hasHit) {
        // ヒット後はエフェクト削除
        this.scene.remove(projectile);
        projectile.geometry.dispose();
        // Material配列の場合とそうでない場合を分けて処理
        if (Array.isArray(projectile.material)) {
          projectile.material.forEach(material => material.dispose());
        } else {
          projectile.material.dispose();
        }
        return;
      }

      // 弾丸を移動
      const moveDistance = AutoAttack.PROJECTILE_SPEED * deltaTime;
      distance += moveDistance;
      projectile.position.addScaledVector(direction, moveDistance);

      // バウンディングボックス更新
      projectile.userData.boundingBox = new THREE.Box3().setFromObject(projectile);
      projectile.userData.boundingBox.expandByScalar(0.5);

      // ターゲットとの衝突チェック
      if (!hasHit && this.checkProjectileHit(projectile)) {
        this.onProjectileHit();
        hasHit = true;
        return;
      }

      // 最大飛距離チェック
      if (distance >= maxDistance) {
        this.scene.remove(projectile);
        projectile.geometry.dispose();
        // Material配列の場合とそうでない場合を分けて処理
        if (Array.isArray(projectile.material)) {
          projectile.material.forEach(material => material.dispose());
        } else {
          projectile.material.dispose();
        }
        return;
      }

      // 回転エフェクト
      projectile.rotation.x += deltaTime * 10;
      projectile.rotation.y += deltaTime * 8;

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  private checkProjectileHit(projectile: THREE.Mesh): boolean {
    // ターゲットのバウンディングボックス取得
    let targetBoundingBox = this.target.mesh.userData.boundingBox;
    if (!targetBoundingBox) {
      targetBoundingBox = new THREE.Box3().setFromObject(this.target.mesh);
      this.target.mesh.userData.boundingBox = targetBoundingBox;
    }

    // バウンディングボックス衝突判定
    if (projectile.userData.boundingBox.intersectsBox(targetBoundingBox)) {
      return true;
    }

    // 距離判定も追加
    const projectileCenter = new THREE.Vector3();
    projectile.userData.boundingBox.getCenter(projectileCenter);

    const targetCenter = new THREE.Vector3();
    targetBoundingBox.getCenter(targetCenter);

    const distance = projectileCenter.distanceTo(targetCenter);
    return distance < 1.5; // 適切な距離で判定
  }

  private onProjectileHit(): void {
    // ダメージを与える
    this.target.takeDamage(this.player.attackPower);
    
    console.log(`オートアタック命中: ${this.target.mesh.name}に${this.player.attackPower}ダメージ`);

    // HPバー更新（メソッドが存在する場合）
    if (typeof (this.target as any).updateHPBar === 'function') {
      (this.target as any).updateHPBar();
    }
  }

  private triggerPassiveEffect(): void {
    // パッシブスキル効果のトリガー
    // Player.tsのcheckPassiveBonusメソッドを呼び出し
    if (typeof (this.player as any).checkPassiveBonus === 'function') {
      (this.player as any).checkPassiveBonus(this.target.mesh.uuid);
    }
  }
}