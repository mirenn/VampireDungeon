import { useEffect, useRef } from 'react';
import { GameManager } from './game/GameManager';
import UI from './components/UI';
import './styles/App.css';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // GameManagerのインスタンスを作成
    gameManagerRef.current = new GameManager(containerRef.current);
    
    // ゲームの初期化と開始
    gameManagerRef.current.init();
    gameManagerRef.current.start();

    // クリーンアップ関数
    return () => {
      if (gameManagerRef.current) {
        gameManagerRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="app">
      <div className="game-container" ref={containerRef}></div>
      <UI />
    </div>
  );
}

export default App;