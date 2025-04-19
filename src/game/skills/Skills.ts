import * as THREE from 'three';
import { Player } from '../entities/Player';

// スキルインターフェースを定義
export interface Skill {
  id: string; // スキルID
  name: string; // スキルの表示名
  cooldown: number; // クールダウン時間（秒）
  manaCost: number; // マナコスト
  execute: (
    player: Player,
    direction?: THREE.Vector3,
    getEnemies?: () => any[],
  ) => void; // スキル実行関数
}

// スキルの実装を集約するクラス
export class Skills {
  // 魔法のオーブ (旧basicAttack)
  static magicOrb(
    player: Player,
    direction?: THREE.Vector3,
    getEnemies?: () => any[],
  ): void {
    // 魔法のオーブエフェクトを表示
    Skills.createMagicOrbEffect(player, direction, getEnemies);
  }

  // 魔法のオーブ攻撃エフェクトを表示するメソッド
  static createMagicOrbEffect(
    player: Player,
    customDirection?: THREE.Vector3,
    getEnemies?: () => any[],
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
  // 他のスキルをここに追加していく
};
