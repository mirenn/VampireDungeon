import * as THREE from 'three';
import { Enemy } from './Enemy';
import { Player } from './Player';

export class RustyKnight extends Enemy {
  private state: 'idle' | 'prepareAttack' | 'attacking' | 'cooldown' = 'idle';
  protected attackCooldown: number = 0;
  protected attackInterval: number = 2.5;
  private attackPrepareTime: number = 0.7;
  private attackPrepareTimer: number = 0;
  private attackRange: number = 6; // 突進攻撃の距離 (少し短く調整)
  private attackIndicatorWidth: number = 1.2; // ★★★ 追加: 攻撃範囲表示用の幅 ★★★
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
    // ★★★ ここの値を変更して攻撃力を調整します ★★★
    this.damage = 20;
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

    this.createHPBar();

    this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);
    this.mesh.userData.boundingBox.expandByScalar(0.2);
    this.mesh.userData.type = 'rustyKnight';
  }

  public update(deltaTime: number, playerObj?: Player | null): void {
    const playerPosition = playerObj?.getPosition();
    switch (this.state) {
      case 'idle': {
        if (
          playerPosition &&
          this.mesh.position.distanceTo(playerPosition) < 10 && // 索敵範囲は広め
          this.attackCooldown <= 0
        ) {
          // プレイヤーが攻撃開始可能な距離(attackRangeより少し遠く)にいるか確認
          const distanceToPlayer =
            this.mesh.position.distanceTo(playerPosition);
          if (distanceToPlayer < this.attackRange + 2.0) {
            // 攻撃準備開始距離
            this.state = 'prepareAttack';
            this.attackPrepareTimer = 0;
            this.hasAttacked = false;
            // 攻撃方向を記録
            this.attackDirection.copy(
              playerPosition
                .clone()
                .sub(this.mesh.position)
                .setY(0)
                .normalize(),
            );
            // 攻撃方向を向く
            const angle = Math.atan2(
              this.attackDirection.x,
              this.attackDirection.z,
            );
            this.mesh.rotation.y = angle;
          } else {
            // 攻撃準備距離まで近づく
            this.moveTowards(playerPosition, deltaTime);
          }
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
          // ★★★ 修正: disposeも呼ぶ ★★★
          this.attackRangeMesh.geometry.dispose();
          if (Array.isArray(this.attackRangeMesh.material)) {
            this.attackRangeMesh.material.forEach((m) => m.dispose());
          } else {
            this.attackRangeMesh.material.dispose();
          }
          this.attackRangeMesh = null;
        }
        break;
      }
      case 'prepareAttack': {
        this.attackPrepareTimer += deltaTime;

        // ★★★ 追加: プレイヤーに向かってゆっくり移動 ★★★
        if (playerPosition) {
          this.moveTowards(playerPosition, deltaTime * 0.2); // 通常の0.2倍の速度
        }
        // ★★★ ここまで ★★★

        // 攻撃範囲Meshを生成・表示（初回のみ）
        if (!this.attackRangeMesh) {
          // ★★★ 変更: PlaneGeometry を使用 ★★★
          const geometry = new THREE.PlaneGeometry(
            this.attackIndicatorWidth, // 幅
            this.attackRange, // 長さ
          );
          const material = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            depthTest: false, // 常に前面に描画
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          // ★★★ 変更: 地面に水平に回転 ★★★
          mesh.rotation.x = -Math.PI / 2;
          // ★★★ 変更: 攻撃方向に向ける ★★★
          const angle = Math.atan2(
            this.attackDirection.x,
            this.attackDirection.z,
          );
          mesh.rotation.z = angle; // Y軸回転ではなくZ軸回転 (PlaneはXY平面なので)

          mesh.visible = true;
          mesh.name = 'attackRangeMesh';
          this.attackRangeMesh = mesh;
          // ★★★ 変更: シーンのルートに追加 ★★★
          if (this.mesh.parent) {
            this.mesh.parent.add(mesh);
          }
        }
        if (this.attackRangeMesh) {
          // ★★★ 変更: 攻撃範囲Meshの位置を敵の前方に設定 ★★★
          const forwardOffset = this.attackDirection
            .clone()
            .multiplyScalar(this.attackRange / 2);
          const meshPosition = this.mesh.position.clone().add(forwardOffset);
          this.attackRangeMesh.position.set(
            meshPosition.x,
            0.05, // 地面すれすれ
            meshPosition.z,
          );
          // ★★★ 変更: 攻撃方向に向ける (毎フレーム更新は不要かも) ★★★
          const angle = Math.atan2(
            this.attackDirection.x,
            this.attackDirection.z,
          );
          this.attackRangeMesh.rotation.z = angle;

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
        } else {
          console.warn('RustyKnight: attackRangeMesh is null in prepareAttack');
        }
        if (this.attackPrepareTimer >= this.attackPrepareTime) {
          this.state = 'attacking';
          this.attackTimer = 0;

          // 攻撃開始時に一瞬明るく表示
          if (
            this.attackRangeMesh &&
            !Array.isArray(this.attackRangeMesh.material)
          ) {
            this.attackRangeMesh.material.opacity = 0.8;
            (
              this.attackRangeMesh.material as THREE.MeshBasicMaterial
            ).color.setRGB(1, 0, 0);
          }
        }
        break;
      }
      case 'attacking': {
        this.attackTimer += deltaTime;
        // 突き攻撃の移動
        const moveDist = this.attackSpeed * deltaTime;
        const moveVec = this.attackDirection.clone().multiplyScalar(moveDist);
        this.mesh.position.add(moveVec);

        // 攻撃判定
        if (!this.hasAttacked && playerPosition && playerObj) {
          // プレイヤーが攻撃範囲内か判定 (矩形範囲で判定)
          // ★★★ 変更: attackDirection を基準にローカル座標を計算 ★★★
          const toPlayer = playerPosition.clone().sub(this.mesh.position);
          const halfWidth = this.attackIndicatorWidth / 2;

          // attackDirection (ローカルZ軸) とそれに直交するベクトル (ローカルX軸) を定義
          const localForward = this.attackDirection; // attackDirection は正規化済みのはず
          // Y軸が上向きと仮定して、外積で右方向ベクトルを計算
          const localRight = new THREE.Vector3()
            .crossVectors(new THREE.Vector3(0, 1, 0), localForward)
            .normalize();

          // toPlayer ベクトルをローカル軸に射影
          const localZ = toPlayer.dot(localForward);
          const localX = toPlayer.dot(localRight);

          // 攻撃範囲 (ローカルZ軸前方、ローカルX軸左右)
          if (
            localZ > 0 && // 敵の前方
            localZ < this.attackRange && // 攻撃距離内
            Math.abs(localX) < halfWidth // 攻撃幅内
          ) {
            if (typeof playerObj.takeDamage === 'function') {
              playerObj.takeDamage(this.damage);
            }
            this.hasAttacked = true; // 一度ヒットしたらこの攻撃中は再ヒットしない
          }
          // ★★★ ここまで変更 ★★★
        }

        // ★★★ 変更なし: 攻撃範囲Meshの位置を更新 ★★★
        if (this.attackRangeMesh) {
          const forwardOffset = this.attackDirection
            .clone()
            .multiplyScalar(this.attackRange / 2);
          const meshPosition = this.mesh.position.clone().add(forwardOffset);
          this.attackRangeMesh.position.set(
            meshPosition.x,
            0.05,
            meshPosition.z,
          );
          // 回転は攻撃開始時の向きのまま
          this.attackRangeMesh.visible = true;
        } else {
          console.warn('RustyKnight: attackRangeMesh is null in attacking');
        }

        if (this.attackTimer >= this.attackDuration) {
          this.state = 'cooldown';
          this.attackCooldown = this.attackInterval;
          // 攻撃範囲Meshを消す
          if (this.attackRangeMesh && this.attackRangeMesh.parent) {
            this.attackRangeMesh.parent.remove(this.attackRangeMesh);
            // ★★★ 修正: disposeも呼ぶ ★★★
            this.attackRangeMesh.geometry.dispose();
            if (Array.isArray(this.attackRangeMesh.material)) {
              this.attackRangeMesh.material.forEach((m) => m.dispose());
            } else {
              this.attackRangeMesh.material.dispose();
            }
            this.attackRangeMesh = null;
          } else {
            console.warn(
              'RustyKnight: attackRangeMesh or its parent is null in attacking end',
            );
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
        // クールダウン中は少しだけ移動可能にする（硬直時間を短く見せる）
        if (playerPosition) {
          this.moveTowards(playerPosition, deltaTime * 0.3); // 通常より遅く
        }
        super.update(deltaTime);
        // 念のため攻撃範囲Meshを消す
        if (this.attackRangeMesh && this.attackRangeMesh.parent) {
          this.attackRangeMesh.parent.remove(this.attackRangeMesh);
          // ★★★ 修正: disposeも呼ぶ ★★★
          this.attackRangeMesh.geometry.dispose();
          if (Array.isArray(this.attackRangeMesh.material)) {
            this.attackRangeMesh.material.forEach((m) => m.dispose());
          } else {
            this.attackRangeMesh.material.dispose();
          }
          this.attackRangeMesh = null;
        }
        break;
      }
    }
    // HPバーの位置更新は Enemy クラスの update で呼ばれるはず
    // super.update(deltaTime); // ここではなく、各ステート内で必要に応じて呼ぶ
  }

  public moveTowards(target: THREE.Vector3, deltaTime: number): void {
    const direction = new THREE.Vector3()
      .subVectors(target, this.mesh.position)
      .setY(0)
      .normalize();
    // ★★★ 変更: moveTowards に渡される deltaTime が既に調整されているので、ここでは speed をそのまま使う ★★★
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
