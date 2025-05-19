/**
 * This BlackMage is a boss character. Like a bullet hell shooter, it creates bullet patterns and moves according to specific movement patterns.
 * When its HP drops below certain thresholds, it changes its attack pattern.
 */
import * as THREE from 'three';
import { Enemy } from './Enemy';
import { Player } from './Player';

type Bullet = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  colorPhase?: number; // パターン3用
};

export class BlackMage extends Enemy {
  private state: 'pattern1' | 'pattern2' | 'pattern3' = 'pattern1';
  private patternTimer: number = 0;
  private patternDuration: number = 7; // 各パターンの持続時間
  private bullets: Bullet[] = [];
  private bulletCooldown: number = 0;
  private mageMesh: THREE.Mesh;

  // 追加: HP閾値
  private phase: 1 | 2 | 3 = 1;

  // 追加: 移動用
  private moveDirection: number = 1;
  private moveTimer: number = 0;

  constructor(x: number, y: number) {
    super();
    this.health = 300;
    this.maxHealth = 300;
    this.damage = 25;
    this.speed = 1.2;
    this.experienceValue = 200;

    this.mesh.clear();

    // 黒の魔導士の簡易メッシュ（円柱＋球体＋帽子）
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 1.4, 16),
      new THREE.MeshStandardMaterial({
        color: 0x222233,
        metalness: 0.3,
        roughness: 0.8,
      }),
    );
    body.position.y = 0.7;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x333344,
        metalness: 0.5,
        roughness: 0.7,
      }),
    );
    head.position.y = 1.45;

    // 帽子
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.7, 16),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.7,
        roughness: 0.5,
      }),
    );
    hat.position.y = 1.85;

    this.mageMesh = new THREE.Mesh();
    this.mageMesh.add(body);
    this.mageMesh.add(head);
    this.mageMesh.add(hat);
    this.mageMesh.position.y = 0;
    this.mageMesh.scale.set(2, 2, 2);

    this.mesh.add(this.mageMesh);
    this.mesh.name = 'blackMage';

    this.createHPBar();

    this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);
    this.mesh.userData.boundingBox.expandByScalar(0.3);
    this.mesh.userData.type = 'blackMage';
    this.mesh.position.set(x, 0, y);

    // 追加: 初期化時の座標ログ
    console.log('[BlackMage] 初期化位置:', this.mesh.position);
  }

  public update(deltaTime: number, playerObj?: Player | null): void {
    // HPによるフェーズ分岐
    if (this.health < this.maxHealth * 0.33) {
      this.phase = 3;
    } else if (this.health < this.maxHealth * 0.66) {
      this.phase = 2;
    } else {
      this.phase = 1;
    }

    // フェーズごとに攻撃パターン・移動パターンを決定
    switch (this.phase) {
      case 1:
        this.state = 'pattern1';
        this.movePattern1(deltaTime);
        break;
      case 2:
        this.state = 'pattern2';
        this.movePattern2(deltaTime, playerObj);
        break;
      case 3:
        this.state = 'pattern3';
        this.movePattern3(deltaTime);
        break;
    }

    // パターンごとの弾幕
    if (this.state === 'pattern1') {
      this.handlePattern1(deltaTime);
    } else if (this.state === 'pattern2') {
      this.handlePattern2(deltaTime);
    } else if (this.state === 'pattern3') {
      this.handlePattern3(deltaTime);
    }

    // 弾の移動・寿命管理・当たり判定
    this.updateBullets(deltaTime, playerObj);

    super.update(deltaTime); // HPバーなど
  }

  // パターン1: 水平方向・垂直方向の弾幕
  private handlePattern1(deltaTime: number) {
    this.bulletCooldown -= deltaTime;
    if (this.bulletCooldown <= 0) {
      const mageX = this.mesh.position.x;
      const mageZ = this.mesh.position.z;
      const minCoord = 42;
      const maxCoord = 78;
      const spawnOffset = 1; // 敵の少し外側から出すためのオフセット
      const bulletRadius = 0.2; // 弾の半径を大きくする
      const bulletSegments = 10; // 見た目を少し滑らかに

      // 水平方向の弾 (画面右端から左へ)
      // 弾の数を減らし、間隔を調整
      const numHorizontalBullets = 5;
      for (let i = 0; i < numHorizontalBullets; i++) {
        const y = 0.6 + i * 0.35; // 高さと間隔を調整
        const spawnX = maxCoord + spawnOffset; // 右端から
        // Z座標は敵の現在のZ位置を中心に、範囲内に収まるように調整
        const spawnZ = Math.max(
          minCoord,
          Math.min(maxCoord, mageZ + (Math.random() - 0.5) * 10),
        );

        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(
            bulletRadius,
            bulletSegments,
            bulletSegments,
          ),
          new THREE.MeshStandardMaterial({
            color: 0x3399ff,
            emissive: 0x003366,
          }),
        );
        mesh.position.set(spawnX, y, spawnZ);
        mesh.castShadow = true; // 影を落とす
        const velocity = new THREE.Vector3(-3.5, 0.3, 0); // 右→左＋少し上昇
        this.mesh.parent?.add(mesh);
        this.bullets.push({ mesh, velocity, lifetime: 10 }); // 生存時間を調整
      }

      // 垂直方向の弾 (画面奥から手前へ)
      // 弾の数を減らす
      const numVerticalBullets = 4;
      for (let i = 0; i < numVerticalBullets; i++) {
        // X座標は敵の現在のX位置を中心に、範囲内に収まるように調整
        const spawnX = Math.max(
          minCoord,
          Math.min(maxCoord, mageX + (Math.random() - 0.5) * 12), // 少し範囲を広げる
        );
        const spawnZ = maxCoord + spawnOffset; // 奥から
        const y = 1.0 + Math.random() * 1.5; // 高さ (ランダム性追加)

        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(
            bulletRadius,
            bulletSegments,
            bulletSegments,
          ),
          new THREE.MeshStandardMaterial({
            color: 0x33ff99,
            emissive: 0x003322,
          }),
        );
        mesh.position.set(spawnX, y, spawnZ);
        mesh.castShadow = true; // 影を落とす
        // 奥→手前、緩急をつける
        const vz = -2.0 - Math.sin(Date.now() * 0.001 + i) * 0.7;
        const velocity = new THREE.Vector3(0, (Math.random() - 0.5) * 0.5, vz);
        this.mesh.parent?.add(mesh);
        this.bullets.push({ mesh, velocity, lifetime: 10 }); // 生存時間を調整
      }
      this.bulletCooldown = 1.0; // クールダウンを少し調整 (弾が減った分、頻度を少し下げるか検討)
    }
  }

  // パターン2: 周囲に玉発生、回転しながら広がり戻る
  private handlePattern2(deltaTime: number) {
    this.bulletCooldown -= deltaTime;
    if (this.bulletCooldown <= 0) {
      const center = this.mesh.position.clone();
      const numBullets = 16;
      const time = this.patternTimer;
      for (let i = 0; i < numBullets; i++) {
        const angle = (2 * Math.PI * i) / numBullets + time * 1.2;
        const radius = 1.2 + Math.sin(time * 2 + i) * 0.5;
        const pos = center
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(angle) * radius,
              1.1 + Math.sin(angle * 2 + time) * 0.2,
              Math.sin(angle) * radius,
            ),
          );
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 10, 10),
          new THREE.MeshStandardMaterial({
            color: 0x9933ff,
            emissive: 0x330066,
          }),
        );
        mesh.position.copy(pos);
        mesh.castShadow = true; // 影を落とす
        this.mesh.parent?.add(mesh);
        // 回転しながら広がり、戻る動き
        const velocity = new THREE.Vector3(
          Math.cos(angle + time) * 1.2,
          0,
          Math.sin(angle + time) * 1.2,
        ).multiplyScalar(Math.sin(time) > 0 ? 0.7 : -0.7);
        this.bullets.push({ mesh, velocity, lifetime: 2.5 });
      }
      this.bulletCooldown = 1.2;
    }
  }

  // パターン3: 速い玉遅い玉乱雑に発生、色変化
  private handlePattern3(deltaTime: number) {
    this.bulletCooldown -= deltaTime;
    if (this.bulletCooldown <= 0) {
      const center = this.mesh.position.clone();
      const numBullets = 7 + Math.floor(Math.random() * 6);
      for (let i = 0; i < numBullets; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0x660000,
          }),
        );
        mesh.position.copy(center).add(new THREE.Vector3(0, 0, 0)); // y座標を0に変更
        mesh.castShadow = true; // 影を落とす
        const velocity = new THREE.Vector3(
          Math.cos(angle) * speed,
          (Math.random() - 0.5) * 2,
          Math.sin(angle) * speed,
        );
        this.mesh.parent?.add(mesh);
        this.bullets.push({ mesh, velocity, lifetime: 2.5, colorPhase: 0 });
      }
      this.bulletCooldown = 0.25;
    }
  }

  // 弾の移動・寿命・当たり判定・色変化
  private updateBullets(deltaTime: number, playerObj?: Player | null) {
    const removeList: Bullet[] = [];
    for (const bullet of this.bullets) {
      bullet.mesh.position.addScaledVector(bullet.velocity, deltaTime);

      // パターン3: 色変化
      if (bullet.colorPhase !== undefined) {
        bullet.colorPhase! += deltaTime;
        let color = 0xff3300;
        if (bullet.colorPhase! > 0.7) color = 0xff9900;
        if (bullet.colorPhase! > 1.2) color = 0xffff00;
        if (bullet.mesh.material && (bullet.mesh.material as any).color) {
          (bullet.mesh.material as any).color.setHex(color);
        }
        // 黄色になってから1秒で消える
        if (bullet.colorPhase! > 2.2) bullet.lifetime = 0;
      }

      bullet.lifetime -= deltaTime;
      if (bullet.lifetime <= 0) {
        removeList.push(bullet);
        bullet.mesh.parent?.remove(bullet.mesh); // シーンからメッシュを削除
        bullet.mesh.geometry.dispose();
        (bullet.mesh.material as THREE.Material).dispose();
        continue;
      }

      // プレイヤーとの当たり判定
      if (playerObj) {
        // 弾のバウンディングボックスを生成または更新
        if (!bullet.mesh.userData.boundingBox) {
          bullet.mesh.userData.boundingBox = new THREE.Box3().setFromObject(
            bullet.mesh,
          );
        } else {
          bullet.mesh.userData.boundingBox.setFromObject(bullet.mesh);
        }

        // プレイヤーのバウンディングボックスを取得
        const playerBoundingBox = playerObj.mesh.userData.boundingBox;

        if (
          playerBoundingBox &&
          bullet.mesh.userData.boundingBox.intersectsBox(playerBoundingBox)
        ) {
          playerObj.takeDamage(this.damage);
          removeList.push(bullet);
          bullet.mesh.parent?.remove(bullet.mesh); // シーンからメッシュを削除
          bullet.mesh.geometry.dispose();
          (bullet.mesh.material as THREE.Material).dispose();
          // console.log('Player hit by bullet!');
        }
      }
    }
    // 配列から削除
    this.bullets = this.bullets.filter((b) => !removeList.includes(b));
  }

  // 追加: パターン1の移動（x,z: 42~78, y: 0固定で円運動）
  private movePattern1(deltaTime: number) {
    this.moveTimer += deltaTime;
    // x,z: 42~78の範囲で円運動、yは0固定
    const centerX = 60;
    const centerZ = 60;
    const range = 18; // (78-42)/2
    this.mesh.position.x = centerX + Math.cos(this.moveTimer * 0.7) * range;
    this.mesh.position.z = centerZ + Math.sin(this.moveTimer * 0.7) * range;
    this.mesh.position.y = 0;
    //console.log('[BlackMage] movePattern1:', this.mesh.position);
  }

  // 追加: パターン2の移動（プレイヤーをゆっくり追尾、範囲制限、yは0固定）
  private movePattern2(deltaTime: number, playerObj?: Player | null) {
    if (!playerObj) return;
    const playerPos = playerObj.getPosition();
    // yは0固定でx,zのみ追尾
    const dir = new THREE.Vector3(
      playerPos.x - this.mesh.position.x,
      0,
      playerPos.z - this.mesh.position.z,
    );
    if (dir.length() > 0.1) {
      dir.normalize();
      this.mesh.position.addScaledVector(dir, this.speed * 0.5 * deltaTime);
    }
    // 範囲制限
    this.mesh.position.x = Math.max(42, Math.min(78, this.mesh.position.x));
    this.mesh.position.z = Math.max(42, Math.min(78, this.mesh.position.z));
    this.mesh.position.y = 0;
    //console.log('[BlackMage] movePattern2:', this.mesh.position);
  }

  // 追加: パターン3の移動（ランダムにテレポート、範囲制限、yは0固定）
  private movePattern3(deltaTime: number) {
    this.moveTimer += deltaTime;
    if (this.moveTimer > 3) {
      this.moveTimer = 0;
      // x,z: 42~78の範囲でランダムな位置にテレポート、yは0固定
      const x = 42 + Math.random() * (78 - 42);
      const z = 42 + Math.random() * (78 - 42);
      this.mesh.position.set(x, 0, z);
      //console.log('[BlackMage] movePattern3 テレポート:', this.mesh.position);
    } else {
      this.mesh.position.y = 0;
      //console.log('[BlackMage] movePattern3:', this.mesh.position);
    }
  }

  public dispose(): void {
    if (this.mageMesh) {
      this.mageMesh.traverse((obj: any) => {
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
    for (const bullet of this.bullets) {
      if (bullet.mesh.parent) bullet.mesh.parent.remove(bullet.mesh);
      if (bullet.mesh.geometry) bullet.mesh.geometry.dispose();
      if (bullet.mesh.material) (bullet.mesh.material as any).dispose();
    }
    this.bullets = [];
    super.dispose();
  }

  protected updateHPBarPosition(): void {
    const hpBarContainer = (this as any).hpBarContainer;
    if (hpBarContainer) {
      hpBarContainer.position.y = 2.7;
      const worldPosition = new THREE.Vector3();
      this.mesh.getWorldPosition(worldPosition);
      hpBarContainer.position.y = 2.7;
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
