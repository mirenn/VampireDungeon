import * as THREE from 'three';
import { Player } from '../entities/Player';
import { PathFindingSystem } from '../systems/PathFindingSystem';

// スキルインターフェースを定義
export interface Skill {
  id: string;
  name: string;
  cooldown: number;
  manaCost: number;
  execute: (
    player: Player,
    direction?: THREE.Vector3,
    getEnemies?: () => any[],
    getTombstones?: () => any[],
    pathFindingSystem?: PathFindingSystem, // nullを許容せずundefinedのみ
  ) => void;
}

// スキル名のリテラル型
export type SkillName = 'magicOrb' | 'dashSlash'; // 新しいスキルを追加したらここも拡張

// スキルの実装を集約するクラス
export class Skills {
  // 魔法のオーブ (旧basicAttack)
  static magicOrb(
    player: Player,
    direction?: THREE.Vector3,
    getEnemies?: () => any[],
    getTombstones?: () => any[],
  ): void {
    Skills.createMagicOrbEffect(player, direction, getEnemies, getTombstones);
  }

  // 魔法のオーブ攻撃エフェクトを表示するメソッド
  static createMagicOrbEffect(
    player: Player,
    customDirection?: THREE.Vector3,
    getEnemies?: () => any[],
    getTombstones?: () => any[],
  ): void {
    // 攻撃エフェクト（球）を作成
    const attackEffect = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8,
        emissive: 0xff5500,
        emissiveIntensity: 0.5,
      }),
    );

    // 衝突判定用のバウンディングボックスを設定（十分に大きめに設定）
    attackEffect.userData.boundingBox = new THREE.Box3().setFromObject(
      attackEffect,
    );
    attackEffect.userData.boundingBox.expandByScalar(1.0); // 衝突判定を大きくする（0.5→1.0）
    attackEffect.name = 'playerAttackEffect';

    // プレイヤーの位置を基準にする
    const startPosition = player.mesh.position.clone();
    startPosition.y += 1.3; // プレイヤーの上半身から発射

    // 攻撃方向の設定（カスタム方向があればそれを使用、なければプレイヤーの向き）const direction = customDirection
    const direction = customDirection
      ? customDirection.clone().normalize()
      : player.direction.clone().normalize();

    // エフェクトの初期位置をプレイヤーの少し前に設定
    const offsetDistance = 1.0;
    attackEffect.position
      .copy(startPosition)
      .addScaledVector(direction, offsetDistance);

    // シーンに追加
    player.mesh.parent?.add(attackEffect);

    // アニメーション用変数
    const maxDistance = 10.0; // 最大飛距離
    const speed = 15.0; // 球の速度
    let distance = offsetDistance; // 初期距離
    let isReturning = false; // 帰りかどうかのフラグ
    let lastTimestamp = performance.now();

    // 往路と復路でそれぞれダメージを与えるために、2つのセットを用意
    const damagedEnemiesOutward = new Set<any>(); // 往路でダメージを与えた敵
    const damagedEnemiesReturn = new Set<any>(); // 復路でダメージを与えた敵

    // アニメーション関数
    const animate = (timestamp: number) => {
      // 経過時間（秒）を計算
      const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // 最大100msに制限
      lastTimestamp = timestamp;

      // 移動距離を計算
      const moveDistance = speed * deltaTime;

      if (!isReturning) {
        // 前方へ飛ぶ
        distance += moveDistance;
        attackEffect.position
          .copy(startPosition)
          .addScaledVector(direction, distance);

        // 衝突判定用のバウンディングボックスを更新（より大きく）
        attackEffect.userData.boundingBox = new THREE.Box3().setFromObject(
          attackEffect,
        );
        attackEffect.userData.boundingBox.expandByScalar(1.0); // 拡大係数を大きくする

        // 敵との衝突判定を行う
        if (getEnemies) {
          try {
            const enemies = getEnemies();
            console.log(
              `Checking collision with ${enemies.length} enemies`,
              enemies,
            ); // 詳細なデバッグ情報

            for (const enemy of enemies) {
              // 往路でダメージを与えた敵はスキップ
              if (damagedEnemiesOutward.has(enemy)) continue;

              let collision = false;

              // 明示的にcheckCollisionメソッドを使用
              if (typeof enemy.checkCollision === 'function') {
                collision = enemy.checkCollision(
                  attackEffect.userData.boundingBox,
                );
                console.log(`Using enemy.checkCollision: ${collision}`); // デバッグログ追加
              } else {
                // 通常の敵の場合
                let enemyBoundingBox = enemy.mesh.userData.boundingBox;
                if (!enemyBoundingBox) {
                  enemyBoundingBox = new THREE.Box3().setFromObject(enemy.mesh);
                  enemy.mesh.userData.boundingBox = enemyBoundingBox;
                }

                // バウンディングボックスの交差チェック
                collision =
                  attackEffect.userData.boundingBox.intersectsBox(
                    enemyBoundingBox,
                  );
                console.log(`Box intersection check: ${collision}`); // デバッグログ追加

                // 改善された距離判定
                if (!collision) {
                  const effectCenter = new THREE.Vector3();
                  attackEffect.userData.boundingBox.getCenter(effectCenter);

                  const enemyCenter = new THREE.Vector3();
                  enemyBoundingBox.getCenter(enemyCenter);

                  const distanceBetweenCenters =
                    effectCenter.distanceTo(enemyCenter);
                  // 距離判定を緩める
                  const approximateRadiusSum =
                    enemy.mesh.userData.type === 'jellySlime' ? 2.0 : 1.5;

                  collision = distanceBetweenCenters < approximateRadiusSum;
                  console.log(
                    `Distance check: ${distanceBetweenCenters} < ${approximateRadiusSum} = ${collision}`,
                  ); // デバッグログ追加
                }
              }

              // 衝突した場合
              if (collision) {
                console.log(
                  `Hit detected on ${enemy.mesh.name || 'unnamed enemy'}`,
                );

                // エネミーにダメージを与える
                try {
                  enemy.takeDamage(player.attackPower);
                  console.log(
                    `Applied ${player.attackPower} damage to enemy. Enemy health: ${enemy.health}/${enemy.maxHealth}`,
                  );

                  // HPバーの更新を明示的に呼び出す
                  if (typeof enemy.updateHPBar === 'function') {
                    enemy.updateHPBar();
                  }

                  // この敵には往路でダメージを与えたとマーク
                  damagedEnemiesOutward.add(enemy);
                } catch (error) {
                  console.error('Error during damage application:', error);
                }
              }
            }
          } catch (error) {
            console.error('Error in getEnemies function:', error);
          }
        } else {
          console.warn(
            'getEnemies function was not provided to createMagicOrbEffect',
          );
        }

        // --- 敵との衝突判定の直後に墓石との衝突判定を追加 ---
        // 墓石との衝突判定
        if (getTombstones) {
          const tombstones = getTombstones();
          for (const tombstone of tombstones) {
            if (tombstone.isDestroyed) continue;
            if (
              typeof tombstone.checkCollision === 'function' &&
              tombstone.checkCollision(attackEffect.userData.boundingBox)
            ) {
              tombstone.destroy();
              // 墓石の見た目を消す
              if (tombstone.mesh && tombstone.mesh.parent) {
                tombstone.mesh.parent.remove(tombstone.mesh);
                tombstone.mesh.geometry?.dispose();
                if (tombstone.mesh.material?.dispose)
                  tombstone.mesh.material.dispose();
              }
              // TODO: ナビメッシュ再生成処理をここに追加
            }
          }
        }

        // 最大距離に達したら戻り始める
        if (distance >= maxDistance) {
          isReturning = true;
        }
      } else {
        // プレイヤーへ戻る
        distance -= moveDistance * 1.5; // 帰りは少し速く

        if (distance > 0) {
          // プレイヤーの現在位置を取得（移動している場合に追従）
          const currentPlayerPosition = player.mesh.position.clone();
          currentPlayerPosition.y += 1.3; // 上半身の高さに調整

          // 前方方向ベクトルの基点を現在のプレイヤー位置に更新
          attackEffect.position
            .copy(currentPlayerPosition)
            .addScaledVector(direction, distance);

          // 衝突判定用のバウンディングボックスを更新
          attackEffect.userData.boundingBox = new THREE.Box3().setFromObject(
            attackEffect,
          );
          attackEffect.userData.boundingBox.expandByScalar(1.0);

          // 敵との衝突判定を行う（帰りの場合も）
          if (getEnemies) {
            const enemies = getEnemies();
            for (const enemy of enemies) {
              // 復路でダメージを与えた敵はスキップ（往路でダメージを与えた敵でも復路では再度ダメージを与える）
              if (damagedEnemiesReturn.has(enemy)) continue;

              let collision = false;

              if (typeof enemy.checkCollision === 'function') {
                collision = enemy.checkCollision(
                  attackEffect.userData.boundingBox,
                );
              } else {
                // 通常の敵向け衝突判定
                const enemyBoundingBox = enemy.mesh.userData.boundingBox;
                if (
                  enemyBoundingBox &&
                  attackEffect.userData.boundingBox.intersectsBox(
                    enemyBoundingBox,
                  )
                ) {
                  collision = true;
                }
              }

              if (collision) {
                console.log(
                  `${enemy.mesh.name || 'Enemy'} takes ${player.attackPower} damage (return)`,
                );
                enemy.takeDamage(player.attackPower);
                if (typeof enemy.updateHPBar === 'function') {
                  enemy.updateHPBar();
                }
                // 復路でダメージを与えた敵として記録
                damagedEnemiesReturn.add(enemy);
              }
            }
          }
        } else {
          // プレイヤーに到達したらエフェクト終了
          if (attackEffect.parent) {
            attackEffect.material.dispose();
            attackEffect.geometry.dispose();
            attackEffect.parent.remove(attackEffect);
          }
          return; // アニメーション終了
        }
      }

      // 球を回転させる（見た目の効果）
      attackEffect.rotation.x += deltaTime * 10;
      attackEffect.rotation.y += deltaTime * 8;

      // 途中で不透明度を変更
      const material = attackEffect.material as THREE.MeshStandardMaterial;
      if (isReturning) {
        // 戻るときは徐々に明るく
        material.opacity = Math.min(
          0.8,
          0.4 + (0.4 * (maxDistance - distance)) / maxDistance,
        );
        material.emissiveIntensity =
          0.5 + (0.5 * (maxDistance - distance)) / maxDistance;
      }

      // 次のフレームへ
      requestAnimationFrame(animate);
    };

    // アニメーション開始
    requestAnimationFrame(animate);
  }

  // ダッシュ切りスキルの実装
  static dashSlash(
    player: Player,
    direction?: THREE.Vector3,
    getEnemies?: () => any[],
    getTombstones?: () => any[],
    pathFindingSystem?: PathFindingSystem, // PathFindingSystemを追加
  ): void {
    // 方向の設定
    const dashDirection = direction
      ? direction.clone().normalize()
      : player.direction.clone().normalize();

    // 開始位置を保存
    const startPosition = player.mesh.position.clone();

    // ダッシュ距離の設定（15メートル）
    const maxDashDistance = 15;

    // ダメージを与えた敵を追跡
    const hitEnemies = new Set<any>();

    // 倒した敵を追跡（クールダウンリセット用）
    const killedEnemies = new Set<any>();

    // 斬撃エフェクトを作成
    const slashEffect = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.5),
      new THREE.MeshBasicMaterial({
        color: 0x3366ff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    slashEffect.name = 'slashEffect';

    // エフェクトの位置を設定
    slashEffect.position.copy(startPosition).add(new THREE.Vector3(0, 1, 0));
    slashEffect.lookAt(startPosition.clone().add(dashDirection));
    slashEffect.rotateX(Math.PI / 2); // 刀のような平面に調整

    // シーンに追加
    player.mesh.parent?.add(slashEffect);

    // 軌跡を残すために線を描画
    const trailGeometry = new THREE.BufferGeometry();
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0x3366ff,
      transparent: true,
      opacity: 0.5,
    });

    const trailPoints = [
      startPosition.clone().add(new THREE.Vector3(0, 1, 0)),
      startPosition.clone().add(new THREE.Vector3(0, 1, 0)),
    ];
    trailGeometry.setFromPoints(trailPoints);

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    player.mesh.parent?.add(trail);

    // ダッシュアニメーションのパラメータ
    let dashDistance = 0;
    const dashSpeed = 30; // 高速移動
    let lastTimestamp = performance.now();
    let isDashing = true;
    let obstacleHit = false;

    // アニメーション関数
    const animate = (timestamp: number) => {
      // 経過時間の計算
      const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      lastTimestamp = timestamp;

      if (isDashing) {
        // 移動距離の計算
        const moveDelta = dashSpeed * deltaTime;

        // 壁判定: 次のフレームでの移動先の位置を計算
        const nextPosition = player.mesh.position
          .clone()
          .addScaledVector(dashDirection, moveDelta);

        // ナビメッシュを使って壁判定を行う
        let wallHit = false;
        if (pathFindingSystem && pathFindingSystem.navMesh) {
          // 次の位置のグリッド座標を取得
          const nextGrid = pathFindingSystem.navMesh.worldToGrid(
            nextPosition.x,
            nextPosition.z,
          );
          // そのグリッドのノードを取得
          const nextNode = pathFindingSystem.navMesh.getNode(
            nextGrid.x,
            nextGrid.y,
          );

          // ノードが存在しないか、歩行不可能な場合は壁と判定
          if (!nextNode || !nextNode.isWalkable) {
            console.log(
              `ダッシュ切りが壁に衝突！ 位置: (${nextGrid.x}, ${nextGrid.y})`,
            );
            wallHit = true;
            obstacleHit = true;
          }
        }

        // 最大距離か障害物に当たるまでダッシュ
        if (dashDistance < maxDashDistance && !obstacleHit && !wallHit) {
          // プレイヤーを移動
          dashDistance += moveDelta;
          player.mesh.position.addScaledVector(dashDirection, moveDelta);

          // スラッシュエフェクトの位置を更新
          slashEffect.position
            .copy(player.mesh.position)
            .add(new THREE.Vector3(0, 1, 0));

          // 軌跡の更新
          trailPoints[1]
            .copy(player.mesh.position)
            .add(new THREE.Vector3(0, 1, 0));
          trailGeometry.setFromPoints(trailPoints);

          // 敵との衝突チェック
          if (getEnemies) {
            const enemies = getEnemies();
            for (const enemy of enemies) {
              // すでにヒットした敵はスキップ
              if (hitEnemies.has(enemy)) continue;

              // プレイヤーと敵の衝突判定用のバウンディングボックスを作成
              const playerBox = new THREE.Box3().setFromObject(player.mesh);
              playerBox.expandByScalar(0.5); // 判定を少し大きく

              let collision = false;

              // 敵の衝突チェック関数があればそれを使用
              if (typeof enemy.checkCollision === 'function') {
                collision = enemy.checkCollision(playerBox);
              } else {
                // 通常の衝突判定
                const enemyBox =
                  enemy.mesh.userData.boundingBox ||
                  new THREE.Box3().setFromObject(enemy.mesh);
                collision = playerBox.intersectsBox(enemyBox);

                // 距離判定も追加
                if (!collision) {
                  const playerCenter = new THREE.Vector3();
                  playerBox.getCenter(playerCenter);

                  const enemyCenter = new THREE.Vector3();
                  enemyBox.getCenter(enemyCenter);

                  const distance = playerCenter.distanceTo(enemyCenter);
                  collision = distance < 2.0; // 適切な距離で判定
                }
              }

              // 衝突した場合
              if (collision) {
                console.log(`ダッシュ切りが${enemy.mesh.name || '敵'}に命中!`);

                // 敵の現在HPを記録
                const prevHealth = enemy.health;

                // ダメージを与える（15ダメージ固定）
                enemy.takeDamage(15);

                if (typeof enemy.updateHPBar === 'function') {
                  enemy.updateHPBar();
                }

                // ヒット敵として記録
                hitEnemies.add(enemy);

                // 敵を倒した場合、クールダウンリセット
                if (prevHealth > 0 && enemy.health <= 0) {
                  console.log(`敵を倒した! クールダウンをリセット`);
                  killedEnemies.add(enemy);

                  // プレイヤーのクールダウンを直接リセット
                  player.resetSkillCooldown('dashSlash');
                }
              }
            }
          }

          // 墓石との衝突チェック
          if (getTombstones) {
            const tombstones = getTombstones();
            for (const tombstone of tombstones) {
              if (tombstone.isDestroyed) continue;

              if (
                typeof tombstone.checkCollision === 'function' &&
                tombstone.checkCollision(
                  new THREE.Box3().setFromObject(player.mesh),
                )
              ) {
                tombstone.destroy();
                // 墓石の見た目を消す
                if (tombstone.mesh && tombstone.mesh.parent) {
                  tombstone.mesh.parent.remove(tombstone.mesh);
                  tombstone.mesh.geometry?.dispose();
                  if (tombstone.mesh.material?.dispose) {
                    tombstone.mesh.material.dispose();
                  }
                }
                // 墓石に当たったら止まる
                obstacleHit = true;
                break;
              }
            }
          }
        } else {
          // ダッシュ終了
          isDashing = false;
        }
      } else {
        // ダッシュ後のエフェクト消去
        const opacityDecay = deltaTime * 5; // 徐々に消える速度

        // エフェクトの不透明度を下げる
        const slashMaterial = slashEffect.material as THREE.MeshBasicMaterial;
        slashMaterial.opacity -= opacityDecay;

        trailMaterial.opacity -= opacityDecay;

        // 不透明度がほぼ0になったらエフェクトを削除
        if (slashMaterial.opacity <= 0.05) {
          // エフェクトを削除
          if (slashEffect.parent) {
            slashEffect.parent.remove(slashEffect);
            slashEffect.geometry.dispose();
            slashMaterial.dispose();
          }

          if (trail.parent) {
            trail.parent.remove(trail);
            trail.geometry.dispose();
            trailMaterial.dispose();
          }

          // アニメーションを終了
          return;
        }
      }

      // 次のフレームのアニメーション
      requestAnimationFrame(animate);
    };

    // アニメーションを開始
    requestAnimationFrame(animate);
  }

  // 他のスキル実装はここに追加していく
  // ...
}

// スキルデータベース
export const SkillDatabase: { [key: string]: Skill } = {
  magicOrb: {
    id: 'magicOrb',
    name: '魔法のオーブ',
    cooldown: 6,
    manaCost: 15, // マナコストを設定
    execute: Skills.magicOrb,
  },
  dashSlash: {
    id: 'dashSlash',
    name: 'ダッシュ切り',
    cooldown: 8,
    manaCost: 20,
    execute: Skills.dashSlash,
  },
  // 他のスキルをここに追加していく
};
