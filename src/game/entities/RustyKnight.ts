import * as THREE from 'three';
import { Enemy } from './Enemy';
import { Player } from './Player';

export class RustyKnight extends Enemy {
  private state: 'idle' | 'prepareAttack' | 'attacking' | 'cooldown' = 'idle';
  protected attackCooldown: number = 0;
  protected attackInterval: number = 2.5;
  private attackPrepareTime: number = 0.7;
  private attackPrepareTimer: number = 0;
  private attackRange: number = 10; // 攻撃範囲を10メートルに変更
  private attackRangeMesh: THREE.Mesh | null = null;
  private attackDirection: THREE.Vector3 = new THREE.Vector3();
  private attackSpeed: number = 10;
  private attackDuration: number = 0.22;
  private attackTimer: number = 0;
  private hasAttacked: boolean = false;
  private knightMesh: THREE.Mesh;

  constructor() {
    super();
    this.health = 30;
    this.maxHealth = 30;
    this.damage = 7;
    this.speed = 2.2;
    this.experienceValue = 20;

    this.mesh.clear();

    // 騎士の簡易メッシュ（円柱＋箱）
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.4, 1.1, 12),
      new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.5,
        roughness: 0.7,
      }),
    );
    body.position.y = 0.55;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        metalness: 0.7,
        roughness: 0.6,
      }),
    );
    head.position.y = 1.15;

    const spear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 1.2, 8),
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.8,
        roughness: 0.5,
      }),
    );
    spear.position.set(0, 0.8, -0.7);
    spear.rotation.x = Math.PI / 2.2;

    this.knightMesh = new THREE.Mesh();
    this.knightMesh.add(body);
    this.knightMesh.add(head);
    this.knightMesh.add(spear);
    this.knightMesh.position.y = 0;
    this.knightMesh.scale.set(1.7, 1.7, 1.7);

    this.mesh.add(this.knightMesh);
    this.mesh.name = 'rustyKnight';

    // 攻撃範囲を示す視覚的なインジケーターを追加
    const rangeIndicator = new THREE.Mesh(
      new THREE.CircleGeometry(this.attackRange, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      }),
    );
    rangeIndicator.rotation.x = -Math.PI / 2;
    rangeIndicator.position.y = 0.05;
    rangeIndicator.name = 'rangeIndicator';
    rangeIndicator.visible = false;
    this.mesh.add(rangeIndicator);

    this.createHPBar();

    this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);
    this.mesh.userData.boundingBox.expandByScalar(0.2);
    this.mesh.userData.type = 'rustyKnight';
  }

  public update(deltaTime: number, playerObj?: Player | null): void {
    // console.log('[RustyKnight] update called', {
    //   state: this.state,
    //   playerPosition: playerPosition ? playerPosition.toArray() : null,
    //   selfPosition: this.mesh.position.toArray(),
    //   attackCooldown: this.attackCooldown,
    //   distance: playerPosition
    //     ? this.mesh.position.distanceTo(playerPosition)
    //     : null,
    // });
    const playerPosition = playerObj?.getPosition();
    switch (this.state) {
      case 'idle': {
        if (!playerPosition) {
          console.log('[RustyKnight] playerPosition is undefined or null');
        } else if (this.mesh.position.distanceTo(playerPosition) >= 10) {
          console.log('[RustyKnight] player is too far', {
            distance: this.mesh.position.distanceTo(playerPosition),
          });
        } else if (this.attackCooldown > 0) {
          console.log('[RustyKnight] attackCooldown active', {
            attackCooldown: this.attackCooldown,
          });
        }
        console.log(
          '[RustyKnight] idle state - attackCooldown:',
          this.attackCooldown,
        );
        if (
          playerPosition &&
          this.mesh.position.distanceTo(playerPosition) < 10 &&
          this.attackCooldown <= 0
        ) {
          console.log('[RustyKnight] Transitioning to prepareAttack', {
            playerDistance: this.mesh.position.distanceTo(playerPosition),
            attackCooldown: this.attackCooldown,
          }); // ← 追加: 条件をログ出力
          this.state = 'prepareAttack';
          this.attackPrepareTimer = 0;
          this.hasAttacked = false;
          // 攻撃方向を記録（プレイヤーの進行方向を模倣）
          this.attackDirection.copy(
            playerPosition.clone().sub(this.mesh.position).setY(0).normalize(),
          );
        } else {
          // 通常の移動
          if (playerPosition) {
            this.moveTowards(playerPosition, deltaTime);
          }
          super.update(deltaTime);
        }
        // 攻撃範囲Meshが表示されていたら消す
        if (this.attackRangeMesh && this.attackRangeMesh.parent) {
          this.attackRangeMesh.parent.remove(this.attackRangeMesh);
          this.attackRangeMesh = null;
        }
        break;
      }
      case 'prepareAttack': {
        this.attackPrepareTimer += deltaTime;
        console.log('[RustyKnight] State changed to prepareAttack.'); // Log: ステート変更
        // 攻撃範囲Meshを生成・表示（初回のみ）
        if (!this.attackRangeMesh) {
          console.log('[RustyKnight] Creating attackRangeMesh...'); // Log: 生成開始
          // CylinderGeometryで円筒を作成し、攻撃方向に合わせて配置
          const radius = 0.5;
          const height = this.attackRange;
          const geometry = new THREE.CylinderGeometry(
            radius,
            radius,
            height,
            32,
            1,
            true,
          );
          const material = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            depthTest: false, // 追加：常に前面に描画
            side: THREE.DoubleSide,
          });
          console.log('[RustyKnight] attackRangeMesh material properties:', {
            // Log: マテリアルプロパティ
            color: material.color.getHexString(),
            transparent: material.transparent,
            opacity: material.opacity,
            depthWrite: material.depthWrite,
            depthTest: material.depthTest,
            side: material.side,
          });
          const mesh = new THREE.Mesh(geometry, material);
          // 円筒の中心を敵の前方に移動
          // CylinderはY軸方向に伸びるので、まずX-Z平面に倒す
          mesh.rotation.z = Math.PI / 2;
          // 攻撃方向に合わせて回転
          mesh.rotation.y = Math.atan2(
            this.attackDirection.x,
            this.attackDirection.z,
          );
          // 中心を敵の前方(attackRange/2)に配置
          mesh.position.set(
            (this.attackDirection.x * this.attackRange) / 2,
            0.8,
            (this.attackDirection.z * this.attackRange) / 2,
          );
          mesh.visible = true;
          mesh.name = 'attackRangeMesh';
          this.attackRangeMesh = mesh;
          console.log('[RustyKnight] attackRangeMesh created:', {
            // Log: 生成されたメッシュの情報
            position: this.attackRangeMesh.position.toArray(),
            rotation: [
              this.attackRangeMesh.rotation.x,
              this.attackRangeMesh.rotation.y,
              this.attackRangeMesh.rotation.z,
            ],
            visible: this.attackRangeMesh.visible,
            name: this.attackRangeMesh.name,
          });
          console.log(
            '[RustyKnight] Adding attackRangeMesh to this.mesh. Children before:',
            this.mesh.children.length,
          ); // Log: 追加前の子供の数
          // 常に自身のメッシュ配下に追加
          this.mesh.add(mesh);
          console.log(
            '[RustyKnight] Added attackRangeMesh to this.mesh. Children after:',
            this.mesh.children.length,
          ); // Log: 追加後の子供の数
          console.log(
            '[RustyKnight] this.mesh children:',
            this.mesh.children.map((c) => c.name),
          ); // Log: 子供のリスト
        }
        if (this.attackRangeMesh) {
          // 攻撃範囲Meshの位置・回転を更新
          this.attackRangeMesh.position.set(
            (this.attackDirection.x * this.attackRange) / 2,
            0.8,
            (this.attackDirection.z * this.attackRange) / 2,
          );
          this.attackRangeMesh.rotation.y = Math.atan2(
            this.attackDirection.x,
            this.attackDirection.z,
          );
          this.attackRangeMesh.visible = true; // 念のため毎回trueに設定

          // 攻撃準備中に徐々に透明度と色を変化させて警告効果を高める
          const progress = this.attackPrepareTimer / this.attackPrepareTime;
          const opacity = 0.4 + 0.5 * progress;
          if (Array.isArray(this.attackRangeMesh.material)) {
            // ... (配列の場合の処理は省略) ...
          } else {
            this.attackRangeMesh.material.opacity = opacity;
            (
              this.attackRangeMesh.material as THREE.MeshBasicMaterial
            ).color.setRGB(1, 0.5 - 0.5 * progress, 0);
          }

          // 攻撃直前の警告効果（点滅など）
          if (progress > 0.8) {
            const pulseSpeed = 10;
            const pulseIntensity =
              0.3 * Math.sin(progress * pulseSpeed * Math.PI * 2) + 0.7;
            if (!Array.isArray(this.attackRangeMesh.material)) {
              this.attackRangeMesh.material.opacity = opacity * pulseIntensity;
            }
          }

          // Log: 更新後のメッシュの状態
          if (!Array.isArray(this.attackRangeMesh.material)) {
            console.log('[RustyKnight] Updating attackRangeMesh:', {
              position: this.attackRangeMesh.position.toArray(),
              rotation: [
                this.attackRangeMesh.rotation.x,
                this.attackRangeMesh.rotation.y,
                this.attackRangeMesh.rotation.z,
              ],
              visible: this.attackRangeMesh.visible,
              opacity: this.attackRangeMesh.material.opacity,
              color: (
                this.attackRangeMesh.material as THREE.MeshBasicMaterial
              ).color.getHexString(),
            });
          }
        } else {
          console.warn(
            '[RustyKnight] attackRangeMesh is null in prepareAttack update.',
          ); // Log: メッシュがnullの場合の警告
        }
        if (this.attackPrepareTimer >= this.attackPrepareTime) {
          this.state = 'attacking';
          this.attackTimer = 0;
          console.log('[RustyKnight] State changed to attacking.'); // Log: ステート変更

          // 攻撃開始時に一瞬明るく表示
          if (
            this.attackRangeMesh &&
            !Array.isArray(this.attackRangeMesh.material)
          ) {
            this.attackRangeMesh.material.opacity = 0.8;
            (
              this.attackRangeMesh.material as THREE.MeshBasicMaterial
            ).color.setRGB(1, 0, 0);
            console.log('[RustyKnight] attackRangeMesh flash effect applied.'); // Log: フラッシュエフェクト適用
          }
        }
        break;
      }
      case 'attacking': {
        this.attackTimer += deltaTime;
        // 突き攻撃の移動
        const t = Math.min(this.attackTimer / this.attackDuration, 1);
        const moveDist = this.attackSpeed * deltaTime;
        this.mesh.position.add(
          this.attackDirection.clone().multiplyScalar(moveDist),
        );
        // 攻撃判定
        if (!this.hasAttacked && playerPosition && playerObj) {
          // プレイヤーが攻撃範囲内か判定
          const forward = this.attackDirection;
          const toPlayer = playerPosition
            .clone()
            .sub(this.mesh.position)
            .setY(0);
          const proj = toPlayer.dot(forward);
          const side = toPlayer
            .clone()
            .sub(forward.clone().multiplyScalar(proj));
          if (proj > 0 && proj < this.attackRange && side.length() < 0.5) {
            if (typeof playerObj.takeDamage === 'function') {
              playerObj.takeDamage(this.damage);
            }
            this.hasAttacked = true;
          }
        }
        // 攻撃範囲Meshの位置を更新
        if (this.attackRangeMesh) {
          this.attackRangeMesh.position.set(
            (this.attackDirection.x * this.attackRange) / 2,
            0.8,
            (this.attackDirection.z * this.attackRange) / 2,
          );
          this.attackRangeMesh.rotation.y = Math.atan2(
            this.attackDirection.x,
            this.attackDirection.z,
          );
          this.attackRangeMesh.visible = true;
          console.log('[RustyKnight] attackRangeMesh in attacking state:', {
            // Log: 攻撃中のメッシュ状態
            visible: this.attackRangeMesh.visible,
            position: this.attackRangeMesh.position.toArray(),
          });
        } else {
          console.warn(
            '[RustyKnight] attackRangeMesh is null in attacking state.',
          ); // Log: 攻撃中にメッシュがnull
        }
        if (t >= 1) {
          this.state = 'cooldown';
          this.attackCooldown = this.attackInterval;
          console.log('[RustyKnight] State changed to cooldown.'); // Log: ステート変更
          // 攻撃範囲Meshを消す
          if (this.attackRangeMesh && this.attackRangeMesh.parent) {
            console.log('[RustyKnight] Removing attackRangeMesh.'); // Log: メッシュ削除
            this.attackRangeMesh.parent.remove(this.attackRangeMesh);
            this.attackRangeMesh = null;
          } else {
            console.warn(
              '[RustyKnight] Attempted to remove null or detached attackRangeMesh.',
            ); // Log: 削除試行時の警告
          }
        }
        break;
      }
      case 'cooldown': {
        this.attackCooldown -= deltaTime;
        if (this.attackCooldown <= 0) {
          this.state = 'idle';
          this.attackCooldown = 0;
        }
        super.update(deltaTime);
        break;
      }
    }
  }

  public moveTowards(target: THREE.Vector3, deltaTime: number): void {
    const direction = new THREE.Vector3()
      .subVectors(target, this.mesh.position)
      .setY(0)
      .normalize();
    const moveDistance = this.speed * deltaTime;
    const moveVec = direction.clone().multiplyScalar(moveDistance);
    this.mesh.position.add(moveVec);
    if (direction.length() > 0.1) {
      const angle = Math.atan2(direction.x, direction.z);
      this.mesh.rotation.y = angle;
    }
  }

  public checkCollision(box: THREE.Box3): boolean {
    if (!this.mesh.userData.boundingBox) {
      this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(
        this.mesh,
      );
      this.mesh.userData.boundingBox.expandByScalar(0.2);
    }
    return this.mesh.userData.boundingBox.intersectsBox(box);
  }

  public takeDamage(amount: number): void {
    super.takeDamage(amount);
    // ダメージ時のエフェクト
    if (this.knightMesh) {
      this.knightMesh.traverse((obj: any) => {
        if (obj.material && obj.material.emissive) {
          obj.material.emissive = new THREE.Color(0xff0000);
          setTimeout(() => {
            obj.material.emissive = new THREE.Color(0x000000);
          }, 200);
        }
      });
    }
  }

  public dispose(): void {
    if (this.knightMesh) {
      this.knightMesh.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    if (this.attackRangeMesh) {
      this.attackRangeMesh.geometry.dispose();
      if (Array.isArray(this.attackRangeMesh.material)) {
        this.attackRangeMesh.material.forEach((m) => m.dispose());
      } else {
        this.attackRangeMesh.material.dispose();
      }
      if (this.attackRangeMesh.parent) {
        this.attackRangeMesh.parent.remove(this.attackRangeMesh);
      }
      this.attackRangeMesh = null;
    }
    super.dispose();
  }

  protected updateHPBarPosition(): void {
    const hpBarContainer = (this as any).hpBarContainer;
    if (hpBarContainer) {
      hpBarContainer.position.y = 1.7;
      const worldPosition = new THREE.Vector3();
      this.mesh.getWorldPosition(worldPosition);
      hpBarContainer.position.y = 1.7;
      hpBarContainer.rotation.set(0, 0, 0);
      hpBarContainer.lookAt(
        worldPosition.x,
        worldPosition.y + 10,
        worldPosition.z,
      );
      hpBarContainer.rotateX(Math.PI / 2);
    }
  }
}
