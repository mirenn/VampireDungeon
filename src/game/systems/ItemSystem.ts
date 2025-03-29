import * as THREE from 'three';
import { Item } from '../entities/Item';
import { Player } from '../entities/Player';

export class ItemSystem {
  private items: Item[] = [];
  private player: Player | null = null;
  private collectDistance: number = 1.5;  // アイテム収集の距離

  constructor(private scene: THREE.Scene) {}

  public init(): void {
    // 初期化処理
  }

  public update(deltaTime: number): void {
    if (!this.player) return;
    
    const playerPosition = this.player.getPosition();
    
    // アイテムの更新処理
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      
      // アイテムのアニメーション更新
      item.update(deltaTime);
      
      // プレイヤーとの距離をチェック
      const distance = playerPosition.distanceTo(item.getPosition());
      
      // プレイヤーが近づいたらアイテムを拾う
      if (distance <= this.collectDistance) {
        // アイテムの効果を適用
        this.applyItemEffect(item);
        
        // アイテムを削除
        this.scene.remove(item.mesh);
        item.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  // ドロップアイテムをスポーン
  public spawnItem(position: THREE.Vector3): void {
    // ランダムなアイテムタイプを選択
    const itemTypes = ['health', 'weapon', 'speed', 'power'];
    const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    
    // アイテムを作成
    const item = new Item(randomType);
    item.mesh.position.copy(position);
    item.mesh.position.y = 0.5;  // 地面の上に配置
    
    // シーンに追加
    this.scene.add(item.mesh);
    this.items.push(item);
  }

  // アイテムの効果を適用
  private applyItemEffect(item: Item): void {
    if (!this.player) return;
    
    switch (item.type) {
      case 'health':
        // 体力回復
        this.player.heal(20);
        console.log('Health restored: +20');
        break;
        
      case 'weapon':
        // 武器強化
        this.player.addWeapon('enhanced');
        this.player.attackPower += 5;
        console.log('Weapon enhanced: +5 attack power');
        break;
        
      case 'speed':
        // 移動速度アップ
        this.player.speed += 1;
        console.log('Speed increased: +1');
        break;
        
      case 'power':
        // 攻撃力アップ
        this.player.attackPower += 3;
        console.log('Attack power increased: +3');
        break;
    }
  }

  // プレイヤーの参照を設定
  public setPlayer(player: Player): void {
    this.player = player;
  }

  // 全てのアイテムを取得
  public getItems(): Item[] {
    return this.items;
  }

  // リソースの解放
  public dispose(): void {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
      item.dispose();
    }
    this.items = [];
  }
}