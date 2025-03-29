import React, { useEffect, useState } from 'react';
import '../styles/UI.css';

interface UIProps {}

const UI: React.FC<UIProps> = () => {
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [level, setLevel] = useState(1);
  const [experience, setExperience] = useState(0);
  const [expNeeded, setExpNeeded] = useState(100);
  const [dunLevel, setDunLevel] = useState(1);
  const [weapons, setWeapons] = useState(['basic']);

  // 実際のゲームでは、GameManagerからのデータ更新を監視してUIを更新
  useEffect(() => {
    const updateUI = () => {
      // ここでは仮の値更新のデモ
      // 実際のゲームではwindow.gameなどのグローバルオブジェクトや
      // コンテキストからプレイヤー情報を取得する
      if ((window as any).gamePlayer) {
        const player = (window as any).gamePlayer;
        setHealth(player.health);
        setMaxHealth(player.maxHealth);
        setLevel(player.level);
        setExperience(player.experience);
        setExpNeeded(player.level * 100);
      }
      
      if ((window as any).gameLevel) {
        setDunLevel((window as any).gameLevel);
      }
    };

    // 定期的に更新
    const interval = setInterval(updateUI, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ui-container">
      {/* ステータスパネル */}
      <div className="status-panel">
        {/* 体力バー */}
        <div className="health-bar-container">
          <div className="health-bar-label">HP {health}/{maxHealth}</div>
          <div className="health-bar-bg">
            <div 
              className="health-bar-fill" 
              style={{ width: `${(health / maxHealth) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* 経験値バー */}
        <div className="exp-bar-container">
          <div className="exp-bar-label">LV {level} - EXP {experience}/{expNeeded}</div>
          <div className="exp-bar-bg">
            <div 
              className="exp-bar-fill" 
              style={{ width: `${(experience / expNeeded) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* ダンジョンレベル */}
        <div className="dungeon-level">
          ダンジョン レベル: {dunLevel}
        </div>
      </div>
      
      {/* 武器・アイテム欄 */}
      <div className="items-panel">
        <h3>装備中の武器</h3>
        <ul className="weapons-list">
          {weapons.map((weapon, index) => (
            <li key={index} className="weapon-item">
              {weapon}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UI;