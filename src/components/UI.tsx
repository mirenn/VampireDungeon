import React, { useEffect, useState } from 'react';
import '../styles/UI.css';

interface UIProps {}

const UI: React.FC<UIProps> = () => {
  // 単純化したステート
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [dunLevel, setDunLevel] = useState(1);
  const weapons = ['basic'];
  
  // スキルのクールダウン用のステート
  const [skillCooldowns, setSkillCooldowns] = useState({
    Q: { max: 5, current: 0, name: "基本攻撃" },
    W: { max: 10, current: 0, name: "未実装" },
    E: { max: 15, current: 0, name: "未実装" },
    R: { max: 30, current: 0, name: "未実装" }
  });

  // ゲームデータの更新を監視
  useEffect(() => {
    const updateUI = () => {
      if ((window as any).gamePlayer) {
        const player = (window as any).gamePlayer;
        setHealth(player.health);
        setMaxHealth(player.maxHealth);
        
        if (player.skills && player.skills.cooldowns) {
          setSkillCooldowns(player.skills.cooldowns);
        }
      }
      
      if ((window as any).gameLevel) {
        setDunLevel((window as any).gameLevel);
      }
    };

    const interval = setInterval(updateUI, 100);
    return () => clearInterval(interval);
  }, []);

  // クールダウンの進行度を計算する
  const getCooldownProgress = (current: number, max: number) => {
    if (max === 0) return 100;
    return ((max - current) / max) * 100;
  };

  return (
    <div className="ui-container" style={{ border: '2px solid red', padding: '10px' }}>
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
        
        {/* スキルクールダウン表示 */}
        <div className="skills-container">
          <h3>スキル</h3>
          <div className="skills-grid">
            {Object.entries(skillCooldowns).map(([key, skill]) => (
              <div key={key} className="skill-item">
                <div className="skill-key">{key}</div>
                <div className="skill-name">{skill.name}</div>
                <div className="skill-cooldown-bg">
                  <div 
                    className="skill-cooldown-fill" 
                    style={{ width: `${getCooldownProgress(skill.current, skill.max)}%` }}
                  ></div>
                </div>
                <div className="skill-cooldown-text">
                  {skill.current > 0 ? `${skill.current.toFixed(1)}s` : '準備完了'}
                </div>
              </div>
            ))}
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