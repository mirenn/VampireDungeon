import * as THREE from 'three';

export class Enemy {
  public mesh: THREE.Object3D;
  public health: number = 30;
  public maxHealth: number = 30;
  public damage: number = 5;
  public speed: number = 3;
  public experienceValue: number = 20;
  
  private attackCooldown: number = 0;
  private attackInterval: number = 1; // 1秒ごとに攻撃

  // 視認範囲と状態
  public detectionRange: number = 10; // プレイヤーを視認できる範囲
  public isPlayerDetected: boolean = false; // プレイヤーを視認しているか
  private detectionMesh: THREE.Mesh | null = null; // 視認範囲の可視化メッシュ
  private isDetectionVisible: boolean = false; // 視認範囲が表示されているか

  // HPバー関連
  protected hpBarContainer: THREE.Group | null = null; // HPバー全体を含むグループ
  protected hpBarBackground: THREE.Mesh | null = null; // HPバーの背景
  protected hpBarFill: THREE.Mesh | null = null; // HPバーのフィル部分

  constructor() {
    // 敵のメッシュを作成
    const enemyGroup = new THREE.Group();
    
    // 体の作成（赤い円柱）
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75;
    body.castShadow = true;
    enemyGroup.add(body);
    
    // 頭の作成（黒いもの）
    const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.7;
    head.castShadow = true;
    enemyGroup.add(head);
    
    this.mesh = enemyGroup;
    this.mesh.name = 'enemy';
    
    // 衝突判定用のバウンディングボックス - より大きく設定
    this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);
    this.mesh.userData.boundingBox.expandByScalar(0.2); // 少し大きめに設定
    this.mesh.userData.type = 'enemy';

    // 視認範囲の可視化メッシュを作成（初期状態では非表示）
    this.createDetectionRangeMesh();
    
    // HPバーを作成
    this.createHPBar();
  }
  
  public update(deltaTime: number): void {
    // バウンディングボックスの更新 - より正確に
    const box = new THREE.Box3().setFromObject(this.mesh);
    box.expandByScalar(0.2); // 少し大きめに
    this.mesh.userData.boundingBox = box;
    
    // 攻撃クールダウンの更新
    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
    }

    // 視認範囲メッシュの位置を更新
    if (this.detectionMesh) {
      this.detectionMesh.position.copy(this.mesh.position);
    }
    
    // HPバーの位置をキャラクターの位置に合わせて更新
    this.updateHPBarPosition();
  }
  
  // HPバーを作成
  public createHPBar(): void {
    // HPバー全体を含むグループ
    this.hpBarContainer = new THREE.Group();
    
    // HPバーの背景（グレー）
    const backgroundGeometry = new THREE.PlaneGeometry(1.2, 0.15);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x444444,
      side: THREE.DoubleSide,
      depthTest: false
    });
    this.hpBarBackground = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    
    // HPバーのフィル部分（緑）
    const fillGeometry = new THREE.PlaneGeometry(1.2, 0.15);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      depthTest: false
    });
    this.hpBarFill = new THREE.Mesh(fillGeometry, fillMaterial);
    
    // フィル部分の原点を左端に設定
    this.hpBarFill.position.x = 0;
    this.hpBarFill.geometry.translate(0.6, 0, 0);
    
    // HPバーコンテナに追加
    this.hpBarContainer.add(this.hpBarBackground);
    this.hpBarContainer.add(this.hpBarFill);
    
    // HPバーの初期位置設定
    this.updateHPBarPosition();
    
    // HPバーをメッシュに追加
    this.mesh.add(this.hpBarContainer);
    
    // 初期状態でのHPバーの更新
    this.updateHPBar();
  }
    // HPバーの位置を更新
  protected updateHPBarPosition(): void {
    if (this.hpBarContainer) {
      // 敵の上部に配置（メッシュの高さに応じて調整）
      const meshHeight = this.calculateMeshHeight();
      this.hpBarContainer.position.y = meshHeight + 0.3; // メッシュの高さ + 余白
      
      // HPバーがカメラの方向を向くように更新（ビルボード効果）
      this.hpBarContainer.quaternion.copy(this.mesh.parent?.quaternion.clone().invert() || new THREE.Quaternion());
      this.hpBarContainer.rotation.x = Math.PI / 2; // 水平になるよう回転
    }
  }
  
  // メッシュの高さを計算
  protected calculateMeshHeight(): number {
    // バウンディングボックスから高さを計算
    const boundingBox = new THREE.Box3().setFromObject(this.mesh);
    return boundingBox.max.y - boundingBox.min.y;
  }
  
  // HPバーの表示を更新
  public updateHPBar(): void {
    if (this.hpBarFill) {
      // HP比率を計算
      const hpRatio = Math.max(0, this.health / this.maxHealth);
      
      // サイズを直接設定するためにジオメトリを新しく作り直す
      const newWidth = 1.2 * hpRatio; // オリジナル幅（1.2）にHP比率を掛ける
      const newGeometry = new THREE.PlaneGeometry(newWidth, 0.15);
      
      // ジオメトリを左揃えにするために位置調整
      newGeometry.translate(newWidth / 2, 0, 0);
      
      // 古いジオメトリを破棄して新しいものに置き換え
      const oldGeometry = this.hpBarFill.geometry;
      this.hpBarFill.geometry = newGeometry;
      oldGeometry.dispose();
      
      // HPバーの位置を左端に揃える
      this.hpBarFill.position.x = -0.6;
      
      // HP残量に応じて色を変更
      const fillMaterial = this.hpBarFill.material as THREE.MeshBasicMaterial;
      if (hpRatio > 0.6) {
        fillMaterial.color.setHex(0x00ff00); // 緑（HP多い）
      } else if (hpRatio > 0.3) {
        fillMaterial.color.setHex(0xffff00); // 黄色（HP中程度）
      } else {
        fillMaterial.color.setHex(0xff0000); // 赤（HP少ない）
      }
    }
  }
  
  // プレイヤーに向かって移動
  public moveTowards(target: THREE.Vector3, deltaTime: number): void {
    const direction = new THREE.Vector3()
      .subVectors(target, this.mesh.position)
      .normalize();
    
    // Y軸（高さ）は無視
    direction.y = 0;
    
    // 移動速度を計算
    const moveDistance = this.speed * deltaTime;
    
    // 移動ベクトルを計算して適用
    const moveVec = direction.clone().multiplyScalar(moveDistance);
    this.mesh.position.add(moveVec);
    
    // 向きの更新
    if (direction.length() > 0.1) {
      const angle = Math.atan2(direction.x, direction.z);
      this.mesh.rotation.y = angle;
    }
  }
  
  // プレイヤーを視認しているか判定
  public checkPlayerDetection(playerPosition: THREE.Vector3): boolean {
    const distance = this.mesh.position.distanceTo(playerPosition);
    this.isPlayerDetected = distance <= this.detectionRange;
    
    // 視認状態に応じて視認範囲メッシュの色を変更
    if (this.detectionMesh) {
      const material = this.detectionMesh.material as THREE.MeshBasicMaterial;
      if (this.isPlayerDetected) {
        material.color.set(0xff0000); // 視認中は赤色
        material.opacity = 0.3;
      } else {
        material.color.set(0xffff00); // 非視認中は黄色
        material.opacity = 0.15;
      }
    }
    
    return this.isPlayerDetected;
  }

  // 視認範囲を可視化するメッシュを作成
  private createDetectionRangeMesh(): void {
    const geometry = new THREE.CylinderGeometry(this.detectionRange, this.detectionRange, 0.1, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    });
    
    this.detectionMesh = new THREE.Mesh(geometry, material);
    this.detectionMesh.position.copy(this.mesh.position);
    this.detectionMesh.position.y = 0.05; // 地面近くに配置
    this.detectionMesh.visible = this.isDetectionVisible;
  }

  // 視認範囲の可視化メッシュをシーンに追加
  public addDetectionRangeToScene(scene: THREE.Scene): void {
    if (this.detectionMesh) {
      scene.add(this.detectionMesh);
      this.isDetectionVisible = true;
      this.detectionMesh.visible = true;
    }
  }

  // 視認範囲の可視化メッシュをシーンから削除
  public removeDetectionRangeFromScene(scene: THREE.Scene): void {
    if (this.detectionMesh) {
      scene.remove(this.detectionMesh);
      this.isDetectionVisible = false;
    }
  }

  // 視認範囲の可視化メッシュの表示/非表示を切り替え
  public toggleDetectionRange(scene: THREE.Scene): void {
    if (this.isDetectionVisible) {
      this.removeDetectionRangeFromScene(scene);
    } else {
      this.addDetectionRangeToScene(scene);
    }
  }
  
  // 攻撃
  public attack(): boolean {
    if (this.attackCooldown <= 0) {
      // 攻撃クールダウンをリセット
      this.attackCooldown = this.attackInterval;
      return true;
    }
    return false;
  }
  
  // ダメージを受ける
  public takeDamage(amount: number): void {
    console.log(`Enemy taking damage: ${amount}`);
    this.health -= amount;
    if (this.health < 0) {
      this.health = 0;
    }
    
    // HPバーを更新
    this.updateHPBar();
  }
  
  // 敵の位置を取得
  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }
  
  // 衝突判定用のヘルパー関数
  public checkCollision(box: THREE.Box3): boolean {
    if (!this.mesh.userData.boundingBox) {
      this.mesh.userData.boundingBox = new THREE.Box3().setFromObject(this.mesh);
    }
    return this.mesh.userData.boundingBox.intersectsBox(box);
  }
  
  // リソースの解放
  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // 視認範囲メッシュのリソース解放
    if (this.detectionMesh) {
      this.detectionMesh.geometry.dispose();
      (this.detectionMesh.material as THREE.Material).dispose();
    }
  }
}