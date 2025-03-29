import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PlayerSystem } from './systems/PlayerSystem';
import { EnemySystem } from './systems/EnemySystem';
import { ItemSystem } from './systems/ItemSystem';
import { LevelSystem } from './systems/LevelSystem';

export class GameManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private clock: THREE.Clock;
  
  private playerSystem: PlayerSystem;
  private enemySystem: EnemySystem;
  private itemSystem: ItemSystem;
  private levelSystem: LevelSystem;
  
  private isRunning: boolean = false;

  constructor(private container: HTMLElement) {
    // シーンの作成
    this.scene = new THREE.Scene();
    
    // カメラの作成
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 20, 20);
    this.camera.lookAt(0, 0, 0);
    
    // レンダラーの作成
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    // コントロールの作成
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.5; // 視点の制限（地面よりも下に行かないように）
    
    // クロックの初期化
    this.clock = new THREE.Clock();
    
    // システムの初期化
    this.playerSystem = new PlayerSystem(this.scene);
    this.enemySystem = new EnemySystem(this.scene);
    this.itemSystem = new ItemSystem(this.scene);
    this.levelSystem = new LevelSystem(this.scene);
    
    // イベントリスナーの設定
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  // ゲームの初期化
  public init(): void {
    // 環境光の追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // 平行光源の追加（太陽光）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    // 地面の追加
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a472a,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // 水平にする
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // 各システムの初期化
    this.playerSystem.init();
    this.enemySystem.init();
    this.itemSystem.init();
    this.levelSystem.init();
    
    // レベルの読み込み
    this.levelSystem.loadLevel(1);
  }
  
  // ゲームの開始
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.clock.start();
    this.animate();
  }
  
  // ゲームの停止
  public stop(): void {
    this.isRunning = false;
    this.clock.stop();
  }
  
  // リソースの解放
  public dispose(): void {
    this.stop();
    
    // イベントリスナーの削除
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    // システムのクリーンアップ
    this.playerSystem.dispose();
    this.enemySystem.dispose();
    this.itemSystem.dispose();
    this.levelSystem.dispose();
    
    // Three.jsリソースの解放
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
  
  // リサイズ対応
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // アニメーションループ
  private animate = (): void => {
    if (!this.isRunning) return;
    
    requestAnimationFrame(this.animate);
    
    const deltaTime = this.clock.getDelta();
    
    // 各システムの更新
    this.playerSystem.update(deltaTime);
    this.enemySystem.update(deltaTime);
    this.itemSystem.update(deltaTime);
    this.levelSystem.update(deltaTime);
    
    // コントロールの更新
    this.controls.update();
    
    // レンダリング
    this.renderer.render(this.scene, this.camera);
  };
}