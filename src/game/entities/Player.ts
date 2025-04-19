import * as THREE from 'three';
import { Skill, SkillDatabase } from '../skills/Skills';

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
  private skills: string[] = ['magicOrb']; // 初期スキルを「魔法のオーブ」に変更
  private skillCooldowns: { [key: string]: number } = {}; // スキルごとのクールダウン
  private items: string[] = [];
  // キーバインドとスキルの対応関係を管理
  private keyBindings: { [key: string]: string } = {
    Q: 'magicOrb', // 「魔法のオーブ」をQキーにバインド
    W: '',
    E: '',
    R: '',
  };
  // スキルの最大クールダウン時間
  private skillMaxCooldowns: { [key: string]: number } = {
    magicOrb: 7, // 1秒から7秒に変更
  };

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
    playerGroup.add(skillObject);

    this.mesh = playerGroup;
    this.mesh.name = 'player';

    // スキルのクールダウンを初期化
    this.skillCooldowns['magicOrb'] = 0;
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
    }

    // マナの自動回復
    this.regenerateMana(deltaTime);

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
    if (!this.skills.includes(skillId)) {
      return false; // スキルを所持していない
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
  ): boolean {
    if (this.tryConsumeSkill(skillId)) {
      const skill = SkillDatabase[skillId];
      if (skill) {
        skill.execute(this, direction, getEnemies);
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
    if (!this.skills.includes(skillId)) {
      this.skills.push(skillId);
      this.skillCooldowns[skillId] = 0; // クールダウンを初期化
    }
  }

  // スキルを所持しているか確認
  public hasSkill(skillId: string): boolean {
    return this.skills.includes(skillId);
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
    if (skillId && !this.skills.includes(skillId)) {
      return false;
    }

    // キーバインドを更新
    this.keyBindings[key] = skillId;
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
    }

    // プレイヤーの体力とマナ情報を更新
    (window as any).gamePlayer.health = this.health;
    (window as any).gamePlayer.maxHealth = this.maxHealth;
    (window as any).gamePlayer.mana = this.mana;
    (window as any).gamePlayer.maxMana = this.maxMana;

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
}
