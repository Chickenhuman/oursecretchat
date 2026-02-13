// js/managers/ArtifactManager.js

const ARTIFACT_DATA = {
    gunpowder: {
        name: 'Unstable Powder',
        desc: 'Allied soldier death causes an explosion.',
        rarity: 'LEGENDARY',
        image: 'art_gunpowder',
        val: 30,
        radius: 50
    },
    turret: {
        name: 'Auto Turret',
        desc: 'Base turret fires periodically.',
        rarity: 'LEGENDARY',
        image: 'art_turret',
        val: 15,
        cooldown: 5.0,
        range: 600
    },
    vampire: {
        name: 'Vampire Ring',
        desc: 'Heal for part of dealt damage.',
        rarity: 'EPIC',
        image: 'art_vampire',
        val: 0.2
    },
    thorn: {
        name: 'Thorn Armor',
        desc: 'Reflect fixed damage on close hits.',
        rarity: 'EPIC',
        image: 'art_thorn',
        val: 5
    },
    valve: {
        name: 'Gold Valve',
        desc: 'Gain extra cost at round start.',
        rarity: 'RARE',
        image: 'art_valve',
        val: 2
    },
    recycler: {
        name: 'Recycler',
        desc: 'Structure death refunds cost.',
        rarity: 'RARE',
        image: 'art_recycler',
        val: 1
    }
};

const RARITY_COLORS = {
    RARE: '#00ff00',
    EPIC: '#d000ff',
    LEGENDARY: '#ffd700'
};

const ARTIFACT_EFFECTS = {
    turret: {
        onUpdate: (mgr, dt) => {
            const data = mgr._getArtifactData().turret;
            mgr.turretCooldown -= dt;
            if (mgr.turretCooldown <= 0) {
                mgr.fireTurret(data);
                mgr.turretCooldown = data.cooldown;
            }
        }
    },
    gunpowder: {
        onUnitDeath: (mgr, unit) => {
            if (unit.team === 'ALLY' && unit.stats && unit.stats.race === 'soldier') {
                mgr.triggerExplosion(unit, mgr._getArtifactData().gunpowder);
            }
        }
    },
    recycler: {
        onUnitDeath: (mgr, unit) => {
            if (unit.team === 'ALLY' && unit.stats && unit.stats.race === 'structure') {
                const data = mgr._getArtifactData().recycler;
                mgr.scene.playerCost += data.val;
                mgr.scene.updateCostUI();
                mgr.scene.showFloatingText(unit.x, unit.y, `+${data.val} Cost`, '#ffff00');
            }
        }
    },
    valve: {
        onRoundStart: (mgr) => {
            const data = mgr._getArtifactData().valve;
            mgr.scene.playerCost += data.val;
            mgr.scene.updateCostUI();
            mgr.scene.addLog(`${data.name}: Cost +${data.val}`);
        }
    },
    vampire: {
        onDealDamage: (mgr, attacker, _target, damageAmount) => {
            if (attacker.team === 'ALLY') {
                const data = mgr._getArtifactData().vampire;
                const heal = Math.floor(damageAmount * data.val);
                if (heal > 0) {
                    attacker.currentHp = Math.min(attacker.currentHp + heal, attacker.stats.hp);
                }
            }
        }
    },
    thorn: {
        onDealDamage: (mgr, attacker, target) => {
            if (target.team === 'ALLY') {
                const data = mgr._getArtifactData().thorn;
                const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
                if (dist <= 60) {
                    mgr.scene.applyDamage({ scene: mgr.scene }, attacker, data.val);
                }
            }
        }
    }
};

class ArtifactManager {
    constructor(scene, ctx) {
        this.scene = scene;
        this.ctx = ctx || (scene && scene.ctx) || (typeof getGameContext === 'function' ? getGameContext() : null);
        this.turretCooldown = 0;
        this.uiContainer = null;
    }

    _getGameData() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.data) ? this.ctx.data : null;
    }

    _getArtifactData() {
        if (this.ctx && this.ctx.artifactData) return this.ctx.artifactData;
        return ARTIFACT_DATA;
    }

    _runArtifactHook(hook, ...args) {
        this.inventory.forEach(key => {
            const handler = ARTIFACT_EFFECTS[key];
            if (handler && typeof handler[hook] === 'function') {
                handler[hook](this, ...args);
            }
        });
    }

    init() {
        this.createUI();
        this.updateUI();
        this.setupEditor();
    }

    get inventory() {
        const data = this._getGameData();
        return data ? data.artifacts : [];
    }

    addArtifact(key) {
        const artifactData = this._getArtifactData();
        if (!artifactData[key]) return { success: false, reason: 'INVALID_KEY' };

        if (this.hasArtifact(key)) {
            const refundGold = 100;
            const data = this._getGameData();
            if (data) data.addGold(refundGold);
            this.scene.addLog(`Duplicate artifact refund: ${artifactData[key].name} -> ${refundGold}G`, 'log-gold');
            if (this.scene.showFloatingText) {
                this.scene.showFloatingText(this.scene.scale.width / 2, this.scene.scale.height / 2, `Already owned\nGold +${refundGold}`, '#ffd700');
            }
            if (this.scene.updateUI) this.scene.updateUI();
            return { success: false, reason: 'DUPLICATE', refund: refundGold };
        }

        const data = this._getGameData();
        if (data) data.addArtifact(key);
        this.scene.addLog(`Artifact acquired: ${artifactData[key].name}`, 'log-green');
        this.updateUI();
        return { success: true, item: artifactData[key].name };
    }

    getRandomArtifactKey() {
        const allKeys = Object.keys(this._getArtifactData());
        const owned = this.inventory;
        const available = allKeys.filter(key => !owned.includes(key));
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    removeArtifact(key) {
        const idx = this.inventory.indexOf(key);
        if (idx > -1) {
            this.inventory.splice(idx, 1);
            this.scene.addLog(`Artifact removed: ${this._getArtifactData()[key].name}`);
            this.updateUI();
        }
    }

    hasArtifact(key) {
        return this.inventory.includes(key);
    }

    update(dt) {
        this._runArtifactHook('onUpdate', dt);
    }

    onUnitDeath(unit) {
        this._runArtifactHook('onUnitDeath', unit);
    }

    onRoundStart() {
        this._runArtifactHook('onRoundStart');
    }

    onDealDamage(attacker, target, damageAmount) {
        this._runArtifactHook('onDealDamage', attacker, target, damageAmount);
    }

    triggerExplosion(unit, data) {
        const radius = data.radius || 50;
        const damage = data.val || 30;

        this.scene.createExplosion(unit.x, unit.y, radius, 0xffaa00);

        this.scene.activeUnits.forEach(target => {
            if (!target.active) return;
            if (target === unit) return;

            const dist = Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y);
            if (dist <= radius) {
                this.scene.applyDamage({ scene: this.scene }, target, damage);
            }
        });
        this.scene.addLog(`${data.name} explosion!`, 'log-red');
    }

    fireTurret(data) {
        const base = this.scene.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (!base) return;

        const target = this.scene.findNearestEnemy();
        if (target) {
            const dist = Phaser.Math.Distance.Between(base.x, base.y, target.x, target.y);
            const range = data.range || 9999;

            if (dist <= range) {
                const dummyOwner = {
                    x: base.x,
                    y: base.y,
                    stats: { damage: data.val, projectileSpeed: 400, color: 0x00ffff }
                };
                if (typeof Projectile !== 'undefined') {
                    const proj = new Projectile(this.scene, dummyOwner, target);
                    this.scene.activeProjectiles.push(proj);
                }
            }
        }
    }

    getNewArtifactKey(targetRarity = null) {
        const allKeys = Object.keys(this._getArtifactData());
        const owned = this.inventory || [];
        let candidates = allKeys.filter(key => !owned.includes(key));

        if (targetRarity) {
            candidates = candidates.filter(key => this._getArtifactData()[key].rarity === targetRarity);
        }

        if (candidates.length === 0) return null;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return pick;
    }

    createUI() {
        let artContainer = document.getElementById('artifact-container');
        if (!artContainer) {
            artContainer = document.createElement('div');
            artContainer.id = 'artifact-container';
            artContainer.className = 'artifact-container';
            document.body.appendChild(artContainer);
        }
        this.uiDOM = artContainer;
    }

    updateUI() {
        if (!this.uiDOM) return;
        this.uiDOM.innerHTML = '';

        this.inventory.forEach(key => {
            const data = this._getArtifactData()[key];
            if (!data) return;
            const div = document.createElement('div');
            div.className = 'artifact-icon';
            div.style.borderColor = RARITY_COLORS[data.rarity];

            div.innerText = data.name[0] || '?';

            const tooltip = document.createElement('div');
            tooltip.className = 'artifact-tooltip';

            const rarityName = (data.rarity === 'LEGENDARY') ? 'Legendary' : (data.rarity === 'EPIC' ? 'Epic' : 'Rare');
            const rarityColor = RARITY_COLORS[data.rarity];

            tooltip.innerHTML = `
                <div class="art-tooltip-header" style="color:${rarityColor}">
                    ${data.name} <span style="font-size:11px; color:#aaa;">[${rarityName}]</span>
                </div>
                <div class="art-tooltip-desc">${String(data.desc || '').replace(/\n/g, '<br>')}</div>
            `;

            div.appendChild(tooltip);
            this.uiDOM.appendChild(div);
        });
    }

    setupEditor() {
        const editorPanel = document.getElementById('artifact-editor');
        if (!editorPanel) return;

        editorPanel.innerHTML = '<h3>Artifact Editor</h3>';

        Object.keys(this._getArtifactData()).forEach(key => {
            const data = this._getArtifactData()[key];
            const btn = document.createElement('button');
            btn.innerText = data.name;
            btn.style.borderLeft = `5px solid ${RARITY_COLORS[data.rarity]}`;
            btn.className = 'editor-btn';

            btn.onclick = () => {
                if (this.hasArtifact(key)) {
                    this.removeArtifact(key);
                    btn.classList.remove('active');
                } else {
                    this.addArtifact(key);
                    btn.classList.add('active');
                }
            };
            editorPanel.appendChild(btn);
        });
    }
}

window.ARTIFACT_DATA = ARTIFACT_DATA;
