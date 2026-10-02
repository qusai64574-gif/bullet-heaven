// upgrades.js - Upgrade system

const UpgradeSystem = {
  availableUpgrades: [],
  currentChoices: [],

  init() {
    this.availableUpgrades = Object.keys(UPGRADES);
  },

  getRandomChoices(count) {
    const choices = [];
    const player = Engine.player;

    const available = this.availableUpgrades.filter(id => {
      const upgrade = UPGRADES[id];
      const currentLevel = this.getUpgradeLevel(id);
      return currentLevel < upgrade.maxLevel;
    });

    const shuffled = available.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      choices.push(shuffled[i]);
    }

    this.currentChoices = choices;
    return choices;
  },

  getUpgradeLevel(upgradeId) {
    if (!Engine.player.upgradeLevels) {
      Engine.player.upgradeLevels = {};
    }
    return Engine.player.upgradeLevels[upgradeId] || 0;
  },

  applyUpgrade(upgradeId) {
    const player = Engine.player;
    const upgrade = UPGRADES[upgradeId];

    if (!upgrade) return;

    if (!player.upgradeLevels) {
      player.upgradeLevels = {};
    }
    player.upgradeLevels[upgradeId] = (player.upgradeLevels[upgradeId] || 0) + 1;

    upgrade.apply(player);

    this.checkEvolution(upgradeId);

    Engine.state = 'playing';
    Engine.paused = false;
    UI.hideLevelUp();
  },

  checkEvolution(upgradeId) {
    const player = Engine.player;

    for (const [evoKey, evoData] of Object.entries(EVOLUTIONS)) {
      const [weaponId, requiredUpgrade] = evoKey.split('+');

      const weapon = player.weapons.find(w => w.id === weaponId);
      if (!weapon || weapon.evolution) continue;

      const hasUpgrade = (player.upgradeLevels[requiredUpgrade] || 0) > 0;
      if (!hasUpgrade) continue;

      const weaponIndex = player.weapons.indexOf(weapon);
      player.weapons[weaponIndex] = {
        ...evoData,
        level: 1,
        cooldown: 0,
        orbitAngle: 0,
      };

      Engine.addFloatingText(player.x, player.y - 60, `${evoData.name}!`, '#ff00ff', 2.5);
      Engine.addScreenShake(1.5);
      Engine.addCameraPunch(1);

      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2;
        Engine.particles.push(new Particle(
          player.x, player.y,
          Math.cos(angle) * 200,
          Math.sin(angle) * 200,
          '#ff00ff', 1, 6
        ));
      }
    }
  },

  getUpgradeDescription(upgradeId) {
    const upgrade = UPGRADES[upgradeId];
    if (!upgrade) return '';

    const level = this.getUpgradeLevel(upgradeId);
    const nextLevel = level + 1;

    return `${upgrade.description} (Level ${level}/${upgrade.maxLevel})`;
  },
};
