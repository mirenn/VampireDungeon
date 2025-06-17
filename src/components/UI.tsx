import React, { useEffect, useState } from 'react';
import '../styles/UI.css';

interface UIProps {}

function UI(props: UIProps) {
  // 単純化したステート
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);  const [mana, setMana] = useState(100); // マナ用のステート追加
  const [maxMana, setMaxMana] = useState(100); // 最大マナ用のステート追加
  const [dunLevel, setDunLevel] = useState(1);
  const weapons = ['basic'];

  // パッシブスキル用のステート
  const [speedBonus, setSpeedBonus] = useState({
    stacks: 0,
    bonusPercent: 0,
    remainingTime: 0
  });

  // スキルのクールダウン用のステート
  const [skillCooldowns, setSkillCooldowns] = useState({
    Q: { max: 5, current: 0, name: '基本攻撃' },
    W: { max: 10, current: 0, name: '未実装' },
    E: { max: 15, current: 0, name: '未実装' },
    R: { max: 30, current: 0, name: '未実装' },
  });
  // ゲームデータの更新を監視
  useEffect(() => {
    const updateUI = () => {
      if ((window as any).gamePlayer) {
        const player = (window as any).gamePlayer;
        setHealth(player.health);
        setMaxHealth(player.maxHealth);
        setMana(player.mana); // マナを更新
        setMaxMana(player.maxMana); // 最大マナを更新

        if (player.skills && player.skills.cooldowns) {
          setSkillCooldowns(player.skills.cooldowns);
        }        // パッシブスキル情報を更新
        if (player.speedBonusInfo) {
          const bonusInfo = player.speedBonusInfo;
          const remainingTime = Math.max(0, (bonusInfo.endTime - Date.now()) / 1000);
          setSpeedBonus({
            stacks: bonusInfo.stacks,
            bonusPercent: bonusInfo.bonusPercent,
            remainingTime: remainingTime
          });
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
    <div
      className="ui-container"
      style={{ border: '2px solid red', padding: '10px' }}
    >
      {/* ステータスパネル */}
      <div className="status-panel">
        {/* ダンジョンレベル */}
        <div className="dungeon-level">ダンジョン レベル: {dunLevel}</div>
      </div>
      {/* スキルバー - 画面中央下 */}
      <div className="skills-bottom-bar">
        {Object.entries(skillCooldowns).map(([key, skill]) => {
          const isDisabled = skill.name === '未設定';
          return (
            <div
              key={key}
              className={`skill-item-bottom ${
                skill.current <= 0 && !isDisabled ? 'ready' : ''
              } ${isDisabled ? 'disabled' : ''}`}
            >
              <div className="skill-key-bottom">{key}</div>
              <div className="skill-name-bottom">{skill.name}</div>
              <div className="skill-cooldown-bg-bottom">
                <div
                  className={`skill-cooldown-fill-bottom ${
                    skill.current <= 0 && !isDisabled ? 'ready' : ''
                  }`}
                  style={{
                    width: `${
                      isDisabled
                        ? 0
                        : getCooldownProgress(skill.current, skill.max)
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          );
        })}{' '}      </div>
      {/* パッシブスキル表示 */}
      {speedBonus.stacks > 0 && (
        <div className="passive-skill-display">
          <div className="passive-skill-name">ハンターの本能</div>
          <div className="passive-skill-info">
            移動速度 +{speedBonus.bonusPercent}% ({speedBonus.stacks}スタック)
          </div>
          <div className="passive-skill-timer">
            残り時間: {speedBonus.remainingTime.toFixed(1)}秒
          </div>
        </div>
      )}
      {/* HP・MPバー - スキルの下 */}
      <div className="health-mana-bars">
        {/* 体力バー */}
        <div className="health-bar-container">
          <div className="health-bar-label">
            HP {health}/{maxHealth}
          </div>
          <div className="health-bar-bg">
            <div
              className="health-bar-fill"
              style={{ width: `${(health / maxHealth) * 100}%` }}
            ></div>
          </div>
        </div>
        {/* マナバー */}
        <div className="mana-bar-container">
          <div className="mana-bar-label">
            MP {mana.toFixed(0)}/{maxMana}
          </div>
          <div className="mana-bar-bg">
            <div
              className="mana-bar-fill"
              style={{ width: `${(mana / maxMana) * 100}%` }}
            ></div>
          </div>
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
}

export default UI;
