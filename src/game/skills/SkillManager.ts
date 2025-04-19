import * as THREE from 'three';
import { Player } from '../entities/Player';
import { Skill, SkillDatabase } from './Skills';

/**
 * スキルシステムを管理するクラス
 * スキルの登録、取得、実行などの機能を提供
 */
export class SkillManager {
  private static instance: SkillManager;
  private customSkills: { [key: string]: Skill } = {};

  // シングルトンパターン
  private constructor() {}

  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager();
    }
    return SkillManager.instance;
  }

  /**
   * カスタムスキルを登録
   * @param skill スキル情報
   */
  public registerSkill(skill: Skill): void {
    this.customSkills[skill.id] = skill;
    console.log(`スキル「${skill.name}」(${skill.id})が登録されました`);
  }

  /**
   * 新しいスキルをプレイヤーに追加
   *
   * この関数は「スキルをプレイヤーの所持スキルリストに追加する」だけで、
   * QWERなどのキーへのバインドは行いません。
   * （スキルのバインドは bindSkillToKey などで別途行います）
   *
   * @param player プレイヤーオブジェクト
   * @param skillId スキルID
   * @returns 追加に成功したかどうか
   */
  public addSkillToPlayer(player: Player, skillId: string): boolean {
    // スキルが存在するか確認
    const skill = this.getSkill(skillId);
    if (!skill) {
      console.error(`スキル ${skillId} が見つかりません`);
      return false;
    }

    // プレイヤーにスキルを追加
    player.addSkill(skillId);
    console.log(`プレイヤーにスキル「${skill.name}」が追加されました`);
    return true;
  }

  /**
   * スキルを取得
   * @param skillId スキルID
   * @returns スキル情報
   */
  public getSkill(skillId: string): Skill | undefined {
    // カスタムスキルを優先
    if (this.customSkills[skillId]) {
      return this.customSkills[skillId];
    }

    // 標準スキルを検索
    return SkillDatabase[skillId];
  }

  /**
   * スキルの実行を試みる（マナチェック付き）
   * @param player プレイヤーオブジェクト
   * @param skillId スキルID
   * @param direction 方向ベクトル
   * @param getEnemies 敵取得関数
   * @returns 実行に成功したかどうか
   */
  public executeSkill(
    player: Player,
    skillId: string,
    direction?: THREE.Vector3,
    getEnemies?: () => any[],
  ): boolean {
    // スキルが存在するか確認
    const skill = this.getSkill(skillId);
    if (!skill) {
      console.error(`スキル ${skillId} が見つかりません`);
      return false;
    }

    // マナコストを確認
    if (player.mana < skill.manaCost) {
      console.log(
        `マナが不足しています。必要: ${skill.manaCost}, 現在: ${player.mana}`,
      );
      return false;
    }

    // スキル実行（プレイヤー内部でマナ消費の処理が行われる）
    return player.executeSkill(skillId, direction, getEnemies);
  }

  /**
   * 利用可能な全てのスキルIDを取得
   * @returns スキルIDの配列
   */
  public getAllSkillIds(): string[] {
    const baseSkillIds = Object.keys(SkillDatabase);
    const customSkillIds = Object.keys(this.customSkills);

    // 重複を排除
    return [...new Set([...baseSkillIds, ...customSkillIds])];
  }

  /**
   * プレイヤーが所持していないスキルのIDを取得
   * @param player プレイヤーオブジェクト
   * @returns スキルIDの配列
   */
  public getUnownedSkillIds(player: Player): string[] {
    const allSkills = this.getAllSkillIds();
    const playerSkills = player.getSkills();

    // プレイヤーが持っていないスキルをフィルタリング
    return allSkills.filter((id) => !playerSkills.includes(id));
  }

  /**
   * ランダムなスキルIDを指定数取得（プレイヤーが所持していないものから）
   * @param player プレイヤーオブジェクト
   * @param count 取得するスキル数
   * @returns スキルIDの配列
   */
  public getRandomUnownedSkills(player: Player, count: number): string[] {
    const unownedSkills = this.getUnownedSkillIds(player);
    if (unownedSkills.length === 0) return [];

    // 配列をシャッフル
    const shuffled = [...unownedSkills].sort(() => 0.5 - Math.random());

    // 必要な数だけ返す
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * 空のスキルスロットキー（QWER）を取得
   * @param player プレイヤーオブジェクト
   * @returns 空のキー配列
   */
  public getEmptySkillSlots(player: Player): string[] {
    const keyBindings = player.getAllKeyBindings();
    const emptySlots: string[] = [];

    for (const key in keyBindings) {
      if (!keyBindings[key]) {
        emptySlots.push(key);
      }
    }

    return emptySlots;
  }

  /**
   * 指定したキーにスキルをバインドする
   * @param player プレイヤーオブジェクト
   * @param skillId スキルID
   * @param key バインドするキー（Q, W, E, R）
   * @returns バインドに成功したかどうか
   */
  public bindSkillToKey(player: Player, skillId: string, key: string): boolean {
    // キーを大文字に統一
    key = key.toUpperCase();

    // キーの検証
    if (!['Q', 'W', 'E', 'R'].includes(key)) {
      console.error(
        `無効なキーです: ${key} - 有効なキーは Q, W, E, R のみです`,
      );
      return false;
    }

    // スキルの検証
    const skill = this.getSkill(skillId);
    if (!skill) {
      console.error(`スキル ${skillId} が見つかりません`);
      return false;
    }

    // プレイヤーがスキルを所持しているか確認
    if (!player.hasSkill(skillId)) {
      // スキルを所持していなければ追加
      this.addSkillToPlayer(player, skillId);
    }

    // 指定されたキーにスキルをバインド
    const result = player.bindSkillToKey(key, skillId);

    if (result) {
      console.log(`スキル「${skill.name}」を ${key} キーにバインドしました`);
    } else {
      console.error(
        `スキル「${skill.name}」の ${key} キーへのバインドに失敗しました`,
      );
    }

    return result;
  }

  /**
   * 指定したキーから現在バインドされているスキルを解除する
   * @param player プレイヤーオブジェクト
   * @param key スキルを解除するキー（Q, W, E, R）
   * @returns 解除に成功したかどうか
   */
  public unbindSkillFromKey(player: Player, key: string): boolean {
    // キーを大文字に統一
    key = key.toUpperCase();

    // キーの検証
    if (!['Q', 'W', 'E', 'R'].includes(key)) {
      console.error(
        `無効なキーです: ${key} - 有効なキーは Q, W, E, R のみです`,
      );
      return false;
    }

    // 現在バインドされているスキルを取得
    const currentSkillId = player.getSkillForKey(key);
    if (!currentSkillId) {
      console.log(`${key} キーにはスキルがバインドされていません`);
      return false;
    }

    // キーからスキルをバインド解除（空文字をセット）
    const result = player.bindSkillToKey(key, '');

    if (result) {
      console.log(`${key} キーからスキルのバインドを解除しました`);
    }

    return result;
  }

  /**
   * プレイヤーのスキルスロットとバインド情報を取得
   * @param player プレイヤーオブジェクト
   * @returns スキルスロット情報
   */
  public getPlayerSkillBindings(player: Player): any {
    const bindings = player.getAllKeyBindings();
    const result: any = {};

    for (const key in bindings) {
      const skillId = bindings[key];
      const skill = skillId ? this.getSkill(skillId) : null;

      result[key] = {
        key: key,
        skillId: skillId,
        name: skill ? skill.name : '未設定',
        cooldown: skill ? skill.cooldown : 0,
        isEmpty: !skillId,
      };
    }

    return result;
  }

  /**
   * スキルをキーにバインド（空きスロットがある場合）
   * @param player プレイヤーオブジェクト
   * @param skillId スキルID
   * @param preferredKey 優先的に使用したいキー（オプション）
   * @returns バインドに成功したかどうか
   */
  public bindSkillToEmptySlot(
    player: Player,
    skillId: string,
    preferredKey?: string,
  ): boolean {
    // 既にプレイヤーがスキルを持っているか確認
    if (!player.hasSkill(skillId)) {
      this.addSkillToPlayer(player, skillId);
    }

    // 優先キーが指定されている場合、そのキーが空いているか確認
    if (preferredKey) {
      const key = preferredKey.toUpperCase();
      if (['Q', 'W', 'E', 'R'].includes(key)) {
        const currentSkill = player.getSkillForKey(key);
        if (!currentSkill) {
          // 優先キーが空いている場合はそこにバインド
          return this.bindSkillToKey(player, skillId, key);
        }
      }
    }

    // 空のスロットを探す
    const emptySlots = this.getEmptySkillSlots(player);
    if (emptySlots.length === 0) {
      console.log('空のスキルスロットがありません');
      return false;
    }

    // 最初の空スロットにバインド
    const slot = emptySlots[0];
    return this.bindSkillToKey(player, skillId, slot);
  }

  /**
   * スキルの説明文を生成
   * @param skillId スキルID
   * @returns 説明文
   */
  public getSkillDescription(skillId: string): string {
    const skill = this.getSkill(skillId);
    if (!skill) return '不明なスキル';

    // IDによって異なる説明を生成
    switch (skillId) {
      case 'magicOrb':
        return `魔法のオーブをカーソル方向に射出する。往路と復路で2回ダメージを与える。コスト:${skill.manaCost}マナ`;
      default:
        return `${skill.name}スキル コスト:${skill.manaCost}マナ`;
    }
  }

  /**
   * スキル選択肢の配列を生成（UI表示用）
   * @param skillIds スキルIDの配列
   * @returns 表示用データ
   */
  public generateSkillOptions(skillIds: string[]): any[] {
    return skillIds
      .map((id) => {
        const skill = this.getSkill(id);
        if (!skill) return null;

        return {
          id: id,
          name: skill.name,
          description: this.getSkillDescription(id),
          cooldown: skill.cooldown,
        };
      })
      .filter((item) => item !== null);
  }
}
