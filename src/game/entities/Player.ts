import * as THREE from 'three';
import { Skill, SkillDatabase } from '../skills/Skills';
import type { SkillName } from '../skills/Skills';
import { PathFindingSystem } from '../systems/PathFindingSystem'; // PathFindingSystemをインポート

// SkillName型かどうかを判定する型ガード関数
function isSkillName(skillId: string): skillId is SkillName {
  return ['magicOrb', 'dashSlash'].includes(skillId);
}

export class Player {
  public mesh: THREE.Object3D;
  public health: number = 100;
  public maxHealth: number = 100;
  public mana: number = 100; // マナの現在値
  public maxMana: number = 100; // マナの最大値
  public manaRegenRate: number = 2; // 毎秒回復するマナ量
  public speed: number = 5;
  public attackPower: number = 10;
  public attackSpeed: number = 1;
  public attackRange: number = 2;
  public experience: number = 0;
  public level: number = 1;

  public direction: THREE.Vector3 = new THREE.Vector3(0, 0, -1);
  private targetDirection: THREE.Vector3 | null = null;
  private nextWaypoint: THREE.Vector3 | null = null;
  private attackCooldown: number = 0;
  private skills: SkillName[] = ['magicOrb', 'dashSlash']; // SkillName型を利用
  private skillCooldowns: { [key: string]: number } = {}; // スキルごとのクールダウン
  private items: string[] = [];
  // キーバインドとスキルの対応関係を管理
  private keyBindings: { [key: string]: SkillName | '' } = {
    Q: 'magicOrb', // 「魔法のオーブ」をQキーにバインド
    W: 'dashSlash',
    E: '',
    R: '',
  };
  // スキルの最大クールダウン時間
  private skillMaxCooldowns: { [key: string]: number } = {
    magicOrb: 7, // 1秒から7秒に変更
  };

  // PathFindingSystemへの参照を保持するプロパティ
  private pathFindingSystem: PathFindingSystem | null = null;

  // オートアタック関連
  private autoAttackTarget: any | null = null; // Enemy型の代わりにanyを使用
  private lastAutoAttackTime: number = 0;

  // パッシブスキル関連
  private attackedEnemies: Map<string, number> = new Map(); // 敵ID -> 攻撃回数
  private speedBonusStacks: number = 0; // 移動速度ボーナススタック数
  private speedBonusEndTime: number = 0; // ボーナス終了時間
  private baseSpeed: number = 5; // 基本移動速度

  constructor() {
    // プレイヤーのメッシュを作成
    const playerGroup = new THREE.Group();

    // 体の作成
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3050ff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.9;
    body.castShadow = true;
    playerGroup.add(body);

    // 頭の作成
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffccaa });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.0;
    head.castShadow = true;
    playerGroup.add(head);

    // スキル表示用のオブジェクト（デフォルトの基本攻撃）
    const skillGeometry = new THREE.BoxGeometry(0.2, 0.2, 1.5);
    const skillMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const skillObject = new THREE.Mesh(skillGeometry, skillMaterial);
    skillObject.position.set(0.6, 1.0, 0.4);
    skillObject.rotation.z = Math.PI / 4;
    skillObject.castShadow = true;
    skillObject.userData.isSkillObject = true;
    playerGroup.add(skillObject);    this.mesh = playerGroup;
    this.mesh.name = 'player';

    // スキルのクールダウンを初期化
    this.skillCooldowns['magicOrb'] = 0;

    // 基本移動速度を保存
    this.baseSpeed = this.speed;
  }
  // バウンディングボックスを更新するメソッド（武器を除外）
  private updateBoundingBox(): void {
    const bodyParts: THREE.Object3D[] = [];

    // 武器以外のパーツを収集
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.isSkillObject) {
        bodyParts.push(child);
      }
    });

    // 武器を除外したバウンディングボックスを計算
    if (bodyParts.length > 0) {
      const box = new THREE.Box3();

      // 最初のパーツでボックスを初期化
      box.setFromObject(bodyParts[0]);

      // 残りのパーツを統合
      for (let i = 1; i < bodyParts.length; i++) {
        const tempBox = new THREE.Box3().setFromObject(bodyParts[i]);
        box.union(tempBox);
      }

      this.mesh.userData.boundingBox = box;
    } else {
      // 万が一適切なパーツがない場合のフォールバック
      this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(
        this.mesh,
      );
    }
  }
  // 滑らかに指定した位置の方向へ向きを変える
  public smoothLookAt(target: THREE.Vector3, rotationSpeed: number): void {
    // 現在位置から目標への方向を計算
    const currentPos = this.mesh.position;
    const targetDirection = new THREE.Vector3()
      .subVectors(target, currentPos)
      .normalize();
    targetDirection.y = 0; // Y軸の回転を無視

    // 方向の長さが有効な場合のみ回転処理を行う
    if (targetDirection.length() > 0.01) {
      // 目標方向の角度
      const targetAngle = Math.atan2(targetDirection.x, targetDirection.z);

      // 現在の角度
      let currentAngle = this.mesh.rotation.y;

      // 角度の差分（最短回転方向を計算）
      let angleDiff = targetAngle - currentAngle;

      // 角度の正規化（-π〜πの範囲にする）
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // 徐々に回転する（rotationSpeedで速度調整）
      if (Math.abs(angleDiff) > 0.01) {
        const rotationAmount =
          Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), rotationSpeed);
        this.mesh.rotation.y += rotationAmount;

        // 方向ベクトルも更新
        this.direction.x = Math.sin(this.mesh.rotation.y);
        this.direction.z = Math.cos(this.mesh.rotation.y);
      } else {
        // ほぼ目標方向に向いたら完全に合わせる
        this.mesh.rotation.y = targetAngle;
        this.direction.copy(targetDirection);
      }
    }
  }

  // 次のウェイポイントへの準備（曲がり角での加速・減速を滑らかにする）
  public prepareNextDirection(
    nextPoint: THREE.Vector3,
    afterNextPoint: THREE.Vector3 | null,
  ): void {
    this.nextWaypoint = nextPoint.clone();

    // 次の移動方向を計算
    if (nextPoint) {
      const targetDir = new THREE.Vector3()
        .subVectors(nextPoint, this.mesh.position)
        .normalize();
      targetDir.y = 0; // Y軸の回転を無視
      this.targetDirection = targetDir;

      // 次の次のポイントがある場合、曲がり角の計算に使用
      if (afterNextPoint) {
        // 計算は特に行わないが、将来の拡張用に保存
      }
    }
  }

  public update(deltaTime: number): void {
    // バウンディングボックスの更新
    this.updateBoundingBox();

    // スキルのクールダウンを更新
    for (const skillId in this.skillCooldowns) {
      if (this.skillCooldowns[skillId] > 0) {
        this.skillCooldowns[skillId] -= deltaTime;
        if (this.skillCooldowns[skillId] < 0) {
          this.skillCooldowns[skillId] = 0;
        }
      }
    }    // マナの自動回復
    this.regenerateMana(deltaTime);

    // パッシブスキルの移動速度ボーナス更新
    this.updateSpeedBonus(deltaTime);

    // UI用にクールダウン情報を更新
    this.updateUISkillCooldowns();

    // 目標方向がある場合は、徐々にその方向へ回転
    if (this.targetDirection && this.targetDirection.length() > 0.01) {
      const currentDir = this.getDirection();
      const targetDir = this.targetDirection;

      // 現在の方向と目標方向のドット積を取得（コサイン類似度）
      const dotProduct = currentDir.dot(targetDir);

      // ほぼ同じ方向を向いている場合は何もしない
      if (dotProduct < 0.99) {
        // 徐々に方向を変える（ここでは単純化して線形補間を使用）
        const newDir = new THREE.Vector3().copy(currentDir);
        newDir.lerp(targetDir, 0.1); // 0.1は補間係数（調整可能）
        newDir.normalize();

        // 方向を更新
        this.direction.copy(newDir);
        this.rotateToDirection();
      } else {
        // 完全に方向を合わせる
        this.direction.copy(targetDir);
        this.targetDirection = null; // 目標達成
      }
    }
  }

  // 向きの更新
  private rotateToDirection(): void {
    if (this.direction.length() > 0.1) {
      const angle = Math.atan2(this.direction.x, this.direction.z);
      this.mesh.rotation.y = angle;
    }
  }

  // スキルの使用条件チェック＆消費処理（旧: useSkill）
  public tryConsumeSkill(skillId: string): boolean {
    if (!isSkillName(skillId) || !this.skills.includes(skillId)) {
      return false; // スキルを所持していない or 不正なスキル名
    }

    const cooldown = this.skillCooldowns[skillId] || 0;
    if (cooldown <= 0) {
      // スキルのマナコストを取得
      const manaCost = this.getSkillManaCost(skillId);

      // マナが足りない場合は使用できない
      if (!this.useMana(manaCost)) {
        console.log(
          `マナが不足しています。必要: ${manaCost}, 現在: ${this.mana}`,
        );
        return false;
      }

      // スキルのクールダウンをリセット
      this.skillCooldowns[skillId] = this.getSkillCooldown(skillId);
      // 最大クールダウン時間も更新
      this.skillMaxCooldowns[skillId] = this.getSkillCooldown(skillId);
      return true;
    }
    return false;
  }

  // マナを消費するメソッド
  public useMana(amount: number): boolean {
    if (this.mana >= amount) {
      this.mana -= amount;
      return true;
    }
    return false;
  }

  // スキルを実行するメソッド
  public executeSkill(
    skillId: string,
    direction?: THREE.Vector3,
    getEnemies?: () => any[],
    getTombstones?: () => any[],
  ): boolean {
    if (this.tryConsumeSkill(skillId)) {
      const skill = SkillDatabase[skillId];
      if (skill) {
        // nullをundefinedに変換して渡す
        const pathFinding =
          this.pathFindingSystem === null ? undefined : this.pathFindingSystem;
        skill.execute(this, direction, getEnemies, getTombstones, pathFinding);
        return true;
      }
    }
    return false;
  }

  // マナを回復するメソッド
  public regenerateMana(deltaTime: number): void {
    const regenAmount = this.manaRegenRate * deltaTime;
    this.mana = Math.min(this.maxMana, this.mana + regenAmount);
  }

  // スキルのマナコストを取得するメソッド
  public getSkillManaCost(skillId: string): number {
    if (SkillDatabase[skillId]) {
      return SkillDatabase[skillId].manaCost || 0;
    }
    return 0; // デフォルトのマナコスト
  }

  // ダメージを受ける
  public takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health < 0) {
      this.health = 0;
    }
    this.showDamageEffect(); // ダメージエフェクトを表示
  }

  // ダメージエフェクトを表示する
  private showDamageEffect(): void {
    // 星型（スパイク状）のShapeを作成
    const spikes = 8;
    const outerRadius = 1.1;
    const innerRadius = 0.45;
    const shape = new THREE.Shape();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    // 薄い厚みを持たせる
    const extrudeSettings = { depth: 0.08, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 1.7, 0); // 頭上
    mesh.rotation.x = -Math.PI / 2; // 上向き
    this.mesh.add(mesh);

    let elapsed = 0;
    const duration = 350; // ミリ秒
    const animate = (timestamp: number) => {
      if (!mesh.userData.start) mesh.userData.start = timestamp;
      elapsed = timestamp - mesh.userData.start;
      // 徐々に透明に
      material.opacity = 0.7 * (1 - elapsed / duration);
      mesh.scale.setScalar(1 + 0.2 * (elapsed / duration)); // 少し拡大
      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        this.mesh.remove(mesh);
        geometry.dispose();
        material.dispose();
      }
    };
    requestAnimationFrame(animate);
  }
  // 回復する
  public heal(amount: number): void {
    this.health += amount;
    if (this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }
  }

  // 経験値を獲得
  public gainExperience(amount: number): boolean {
    this.experience += amount;
    // レベルアップはせず、経験値だけを累積する
    return false; // レベルアップしない
  }

  // スキルを追加
  public addSkill(skillId: string): void {
    if (isSkillName(skillId) && !this.skills.includes(skillId)) {
      this.skills.push(skillId);
      this.skillCooldowns[skillId] = 0; // クールダウンを初期化
    }
  }

  // スキルを所持しているか確認
  public hasSkill(skillId: string): boolean {
    return isSkillName(skillId) && this.skills.includes(skillId);
  }

  // スキルのクールダウン状態を取得
  public getSkillCooldown(skillId: string): number {
    switch (skillId) {
      case 'magicOrb': // 'basicAttack'から'magicOrb'に変更
        return SkillDatabase[skillId].cooldown; // 攻撃速度に依存せず、固定値を使用
      // 他のスキルのクールダウン時間をここに追加
      default:
        // スキルデータベースから取得
        if (SkillDatabase[skillId]) {
          return SkillDatabase[skillId].cooldown;
        }
        return 1; // デフォルトのクールダウン時間
    }
  }

  // スキルのクールダウンをリセットするメソッド
  public resetSkillCooldown(skillId: string): void {
    if (this.skillCooldowns[skillId] !== undefined) {
      this.skillCooldowns[skillId] = 0;
      console.log(`スキル ${skillId} のクールダウンがリセットされました`);
    }
  }

  // すべての所持スキルを取得
  public getSkills(): string[] {
    return [...this.skills];
  }

  // プレイヤーの位置を取得
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  // プレイヤーの方向を取得
  public getDirection(): THREE.Vector3 {
    return this.direction.clone();
  }

  // キーにスキルをバインドするメソッド
  public bindSkillToKey(key: string, skillId: string): boolean {
    // 大文字に変換して統一
    key = key.toUpperCase();

    // 有効なキーかどうか確認
    if (!['Q', 'W', 'E', 'R'].includes(key)) {
      return false;
    }

    // スキルを所持しているか確認
    if (skillId && !this.skills.includes(skillId as SkillName)) {
      return false;
    }

    // キーバインドを更新
    this.keyBindings[key] = isSkillName(skillId) ? skillId : '';
    return true;
  }

  // キーに割り当てられたスキルを取得
  public getSkillForKey(key: string): string {
    key = key.toUpperCase();
    return this.keyBindings[key] || '';
  }

  // 全てのキーバインドを取得
  public getAllKeyBindings(): { [key: string]: string } {
    return { ...this.keyBindings };
  }

  // リソースの解放
  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // 前進
  public moveForward(speed: number): void {
    this.mesh.position.x += this.direction.x * speed;
    this.mesh.position.z += this.direction.z * speed;
  }

  // 後退
  public moveBackward(speed: number): void {
    this.mesh.position.x -= this.direction.x * speed;
    this.mesh.position.z -= this.direction.z * speed;
  }

  // 左移動
  public moveLeft(speed: number): void {
    const leftDir = new THREE.Vector3(-this.direction.z, 0, this.direction.x);
    this.mesh.position.x += leftDir.x * speed;
    this.mesh.position.z += leftDir.z * speed;
  }

  // 右移動
  public moveRight(speed: number): void {
    const rightDir = new THREE.Vector3(this.direction.z, 0, -this.direction.x);
    this.mesh.position.x += rightDir.x * speed;
    this.mesh.position.z += rightDir.z * speed;
  }

  // 指定方向への移動
  public moveInDirection(direction: THREE.Vector3, distance: number): void {
    this.mesh.position.x += direction.x * distance;
    this.mesh.position.z += direction.z * distance;
  }

  // UI用にプレイヤーの情報を更新するメソッド
  private updateUISkillCooldowns(): void {
    // window.gamePlayerがない場合は初期化
    if (!(window as any).gamePlayer) {
      (window as any).gamePlayer = {};
    }

    if (!(window as any).gamePlayer.skills) {
      (window as any).gamePlayer.skills = {};
    }    // プレイヤーの体力とマナ情報を更新
    (window as any).gamePlayer.health = this.health;
    (window as any).gamePlayer.maxHealth = this.maxHealth;
    (window as any).gamePlayer.mana = this.mana;
    (window as any).gamePlayer.maxMana = this.maxMana;

    // パッシブスキル情報も更新
    (window as any).gamePlayer.speedBonusInfo = this.getSpeedBonusInfo();

    // クールダウン情報をUIで使用できる形式に変換
    const cooldowns = {
      Q: {
        max: this.skillMaxCooldowns[this.keyBindings.Q] || 0,
        current: this.skillCooldowns[this.keyBindings.Q] || 0,
        name: this.keyBindings.Q
          ? SkillDatabase[this.keyBindings.Q]?.name || '不明なスキル'
          : '未設定',
      },
      W: {
        max: this.skillMaxCooldowns[this.keyBindings.W] || 0,
        current: this.skillCooldowns[this.keyBindings.W] || 0,
        name: this.keyBindings.W
          ? SkillDatabase[this.keyBindings.W]?.name || '不明なスキル'
          : '未設定',
      },
      E: {
        max: this.skillMaxCooldowns[this.keyBindings.E] || 0,
        current: this.skillCooldowns[this.keyBindings.E] || 0,
        name: this.keyBindings.E
          ? SkillDatabase[this.keyBindings.E]?.name || '不明なスキル'
          : '未設定',
      },
      R: {
        max: this.skillMaxCooldowns[this.keyBindings.R] || 0,
        current: this.skillCooldowns[this.keyBindings.R] || 0,
        name: this.keyBindings.R
          ? SkillDatabase[this.keyBindings.R]?.name || '不明なスキル'
          : '未設定',
      },
    };

    // グローバル変数に設定（UIからアクセスできるようにする）
    (window as any).gamePlayer.skills.cooldowns = cooldowns;
  }

  // PathFindingSystemを設定するメソッド
  public setPathFindingSystem(pathFindingSystem: PathFindingSystem): void {
    this.pathFindingSystem = pathFindingSystem;
    console.log('Player: PathFindingSystem has been set');
  }

  // PathFindingSystemを取得するメソッド（スキル実行時に使用）
  public getPathFindingSystem(): PathFindingSystem | null {
    return this.pathFindingSystem;
  }

  // スキルのクールダウンを任意秒数だけ短縮するメソッド
  public reduceSkillCooldown(skillId: string, seconds: number): void {
    if (this.skillCooldowns[skillId] !== undefined) {
      this.skillCooldowns[skillId] = Math.max(
        0,
        this.skillCooldowns[skillId] - seconds,
      );
      // UI更新も即時反映
      this.updateUISkillCooldowns();
      console.log(`スキル ${skillId} のクールダウンを${seconds}秒短縮しました`);
    }
  }

  // オートアタック機能
  public performAutoAttack(target: any): boolean {
    const currentTime = Date.now();
    const cooldownTime = 1000 / this.attackSpeed; // attackSpeedから攻撃間隔を計算

    // クールダウン中かチェック
    if (currentTime - this.lastAutoAttackTime < cooldownTime) {
      return false;
    }

    // 攻撃範囲内かチェック
    const distance = this.mesh.position.distanceTo(target.mesh.position);
    if (distance > this.attackRange) {
      return false;
    }

    // 攻撃実行
    target.takeDamage(this.attackPower);
    this.lastAutoAttackTime = currentTime;
    this.autoAttackTarget = target;

    // パッシブスキル効果チェック
    this.checkPassiveBonus(target.mesh.uuid);

    console.log(`オートアタック: ${target.mesh.name}に${this.attackPower}ダメージ`);
    return true;
  }

  // 最も近い敵を見つける
  public findNearestEnemy(enemies: any[]): any | null {
    if (enemies.length === 0) return null;

    let nearestEnemy = null;
    let minDistance = Infinity;

    enemies.forEach((enemy) => {
      const distance = this.mesh.position.distanceTo(enemy.mesh.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = enemy;
      }
    });

    return nearestEnemy;
  }

  // パッシブスキル効果チェック
  private checkPassiveBonus(enemyId: string): void {
    const currentAttackCount = this.attackedEnemies.get(enemyId) || 0;
    const newAttackCount = currentAttackCount + 1;
    
    // 攻撃回数を更新
    this.attackedEnemies.set(enemyId, newAttackCount);

    // ボーナス条件チェック
    if (currentAttackCount === 0 || newAttackCount === 5) {
      this.addSpeedBonus();
      if (currentAttackCount === 0) {
        console.log('パッシブ発動: 初回攻撃による移動速度ボーナス');
      } else {
        console.log('パッシブ発動: 5回攻撃による移動速度ボーナス');
      }
    }
  }
  // 移動速度ボーナス更新
  private updateSpeedBonus(_deltaTime: number): void {
    const currentTime = Date.now();
    
    // ボーナス時間が終了した場合
    if (this.speedBonusStacks > 0 && currentTime > this.speedBonusEndTime) {
      this.speedBonusStacks = 0;
      this.recalculateSpeed();
      console.log('移動速度ボーナス終了');
    }
  }

  // 移動速度ボーナス追加
  private addSpeedBonus(): void {
    // スタック追加（最大5スタック = 100%）
    this.speedBonusStacks = Math.min(5, this.speedBonusStacks + 1);
    
    // ボーナス時間を延長（5秒）
    this.speedBonusEndTime = Date.now() + 5000;
    
    // 移動速度を再計算
    this.recalculateSpeed();
    
    console.log(`移動速度ボーナス: ${this.speedBonusStacks}スタック (${this.speedBonusStacks * 20}%)`);
  }

  // 移動速度再計算
  private recalculateSpeed(): void {
    const bonusPercent = this.speedBonusStacks * 20; // 20% per stack
    this.speed = this.baseSpeed * (1 + bonusPercent / 100);
  }

  // 移動速度ボーナス情報取得（UI用）
  public getSpeedBonusInfo(): { stacks: number; endTime: number; bonusPercent: number } {
    return {
      stacks: this.speedBonusStacks,
      endTime: this.speedBonusEndTime,
      bonusPercent: this.speedBonusStacks * 20
    };
  }
}
