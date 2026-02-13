class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    _t(key, params) {
        return (typeof window.t === 'function') ? window.t(key, params) : key;
    }

preload() {


        /*this.load.image('img_swordman', 'assets/icon/swordman.png');
        this.load.image('img_archer', 'assets/icon/archer.png');
        this.load.image('img_healer', 'assets/icon/healer.png');
        this.load.image('img_wall', 'assets/icon/wall.png');
        this.load.image('img_assassin', 'assets/icon/assassin.png');
        this.load.image('img_enemy', 'assets/icon/enemy.png');
        */

        this.load.image('bg_battle', 'assets/maps/battle_bg1.png');
        this.load.image('cmd_knight', 'assets/commanders/knight.png');
        //this.load.image('base_knight', 'assets/base/base_knight.png');
        



        
        const ctx = (typeof getGameContext === 'function') ? getGameContext() : null;
        const unitStats = (ctx && ctx.unitStats) ? ctx.unitStats : {};
        const skillStats = (ctx && ctx.skillStats) ? ctx.skillStats : {};
        const allStats = { ...unitStats, ...skillStats };
        const availableChars = new Set(Array.isArray(window.CHAR_IMAGE_FILES) ? window.CHAR_IMAGE_FILES : []);
        this.load.image('illust_noimg', 'assets/noimg.png');

        for (const [name, stat] of Object.entries(allStats)) {
            if (stat.image) {

                const fileName = stat.image.replace('img_', '');
                const imgPath = availableChars.has(fileName) ? `assets/chars/${fileName}.png` : 'assets/noimg.png';


                this.load.image(`illust_${fileName}`, imgPath);
            }
        }
    }

        // this.load.image('base_mage', 'assets/base/base_mage.png');
    

create() {

        const slider = document.getElementById('timeline-slider');
        if (slider) slider.style.display = 'block';
        
        const hand = document.getElementById('hand-container');
        if (hand) hand.style.display = 'flex'; 
        
        const topBar = document.getElementById('ui-top-bar');
        const bottomBar = document.getElementById('ui-bottom-bar');
        if (topBar) topBar.style.display = 'flex';
        if (bottomBar) bottomBar.style.display = 'flex';


        const timeDisplay = document.getElementById('time-display');
        
        if (typeof SVG_MANAGER !== 'undefined') {
            SVG_MANAGER.initTextures(this);
        }
        if (slider) {
            slider.value = 0; 
        }
        if (timeDisplay) {
            timeDisplay.innerText = "0.0s"; 
        }
        

        this.ctx = (typeof getGameContext === 'function') ? getGameContext() : null;
        this.svgManager = new SVGManager(this);
        this.simulator = new GhostSimulator(this.ctx);
        this.enemyAI = new EnemyAI(this, this.ctx);

        this.cardManager = new CardDeckManager(this, this.ctx);
        this.interactionManager = new InteractionManager(this, this.ctx);
        this.combatManager = new CombatManager(this, this.ctx);
        this.uiManager = new UIManager(this);
        this.ghostGroup = this.add.group();
        this.previewPools = { sprites: [], circles: [], texts: [], rects: [] };
        this.previewPoolCursor = { sprites: 0, circles: 0, texts: 0, rects: 0 };
       if (this.svgManager && this._getUnitStats()) {
            this.svgManager.prebakeAllTextures();
        }
        this.fieldGraphics = this.add.graphics();
        this.fieldGraphics.setDepth(10); 
        this.fieldGraphics.setVisible(false); 
        this.uiManager.toggleArtifactUI(true);
        

 
    

        this.uiManager.setupSpeedControls();
        this.uiManager.setupTimelineEvents(); 
        this.uiManager.updateCostUI();

        const data = this._getGameData();
        if (data && data.deck.length === 0) {
            data.startNewGame();
        }
        

        this.currentRound = 1;
        this.playerCost = 10;
        this.isPlaying = false;
        this.battleTime = 0;
        this.timeSpeed = 1.0;
        this.commanderCooldown = 0;
        this.battleFixedStep = 1 / 60;
        this.battleTimeAcc = 0;
        this.battleMaxFrame = 0.25;

        this.deployedObjects = [];
        this.enemyWave = [];
        this.activeUnits = [];
        this.activeProjectiles = [];
        this.simCompareDebug = null;
        this.simTrace = null;


        const stageNum = (data && data.stage) ? data.stage : 1; 
        const currentMapId = `Map${stageNum}`;
        const mapData = this._getMapData(currentMapId);
        if (mapData) {
            this.mapData = mapData; 
} else {

            this.mapData = { tileSize: 40, mapWidth: 32, mapHeight: 18, image: 'bg_battle' };
        }
        
        this.tileSize = this.mapData.tileSize;
        this.mapWidth = this.mapData.mapWidth;
        this.mapHeight = this.mapData.mapHeight;
        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, this.mapData.image);
        bg.setDisplaySize(this.scale.width, this.scale.height);
        bg.setTint(0xaaaaaa);
        
     this.grid = this.mapData.getGrid(this.mapWidth, this.mapHeight);
        // Keep dimensions aligned with actual grid to avoid map/logic mismatch.
        if (Array.isArray(this.grid) && this.grid.length > 0 && Array.isArray(this.grid[0])) {
            this.mapHeight = this.grid.length;
            this.mapWidth = this.grid[0].length;
            if (this.mapData) {
                this.mapData.mapWidth = this.mapWidth;
                this.mapData.mapHeight = this.mapHeight;
            }
        }
        this.createOutfieldLine();

        this.easystar = new EasyStar.js();
        this.easystar.setGrid(this.grid); 
        this.easystar.setAcceptableTiles(this._getRules().PATH_TILES);
        this.easystar.enableDiagonals(); 
        this.easystar.disableCornerCutting();
        this.easystar.enableSync();

this.simEasystar = new EasyStar.js();
this.simEasystar.setGrid(this.grid);
this.simEasystar.setAcceptableTiles(this._getRules().PATH_TILES);
this.simEasystar.enableDiagonals();
this.simEasystar.disableCornerCutting();
this.simEasystar.enableSync();
this.simEasystar.setIterationsPerCalculation(1000000000);

        this.graphics = this.add.graphics();
        this.predictionGraphics = this.add.graphics(); 
        this.skillGraphics = this.add.graphics();
        this.skillGraphics.setDepth(100);

        this.createBase('ALLY');
        this.createBase('ENEMY');

        this.statusText = this.add.text(10, 10, this._t('battle.stageTurn', { stage: stageNum, turn: this.currentRound }), { fontSize: '16px', color: '#fff' });


this.input.on('pointerdown', (pointer) => {


        if (this.isPlaying) return; 


        this.interactionManager.handleMapClick(pointer);
    });
        

        const btnGo = document.getElementById('btn-turn-end');
        if (btnGo) {
            const newBtnGo = btnGo.cloneNode(true);
            btnGo.parentNode.replaceChild(newBtnGo, btnGo);
            newBtnGo.addEventListener('click', () => this.startRound());
        }
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) {
            const newBtnReset = btnReset.cloneNode(true);
            btnReset.parentNode.replaceChild(newBtnReset, btnReset);
            newBtnReset.addEventListener('click', () => this.interactionManager.resetAllPlans());
        }
        
        const btnPopupCancel = document.getElementById('btn-popup-cancel');
        if (btnPopupCancel) {
            btnPopupCancel.onclick = () => {
                document.getElementById('game-popup').style.display = 'none';
            };
        }


        const deckBtn = document.getElementById('deck-pile');
        if (deckBtn) deckBtn.onclick = () => {
            const sorted = [...this.cardManager.deck].sort((a, b) => {
                const an = (a && a.name) ? a.name : '';
                const bn = (b && b.name) ? b.name : '';
                return an.localeCompare(bn);
            });
            this.cardManager.openCardViewer(this._t('battle.viewerDeck'), sorted);
        };
        const discardBtn = document.getElementById('discard-pile');
        if (discardBtn) discardBtn.onclick = () => this.cardManager.openCardViewer(this._t('battle.viewerDiscard'), this.cardManager.discard);
        const sealBtn = document.getElementById('seal-pile');
        if (sealBtn) sealBtn.onclick = (e) => { e.stopPropagation(); this.cardManager.openCardViewer(this._t('battle.viewerSealed'), this.cardManager.sealed); };
        const closeBtn = document.getElementById('btn-viewer-close');
        if (closeBtn) closeBtn.onclick = () => document.getElementById('card-viewer-modal').style.display = 'none';


        this.cardManager.initDeck(); 
        this.cardManager.drawCard(5);
        this.updateCostUI();
        this.enemyAI.generateWave((data && data.stage) ? data.stage : 1);
        
        this.artifactManager = new ArtifactManager(this, this.ctx);
        this.artifactManager.init(); 
        this.toggleBattleUI(false);
        this.createTimelineUI();

    }

createOutfieldLine() {
        const rules = this._getRules();
        const T = rules.TILES;

        let lastPlayableRow = -1;
        for (let y = this.grid.length - 1; y >= 0; y--) {

            const hasPlayableTile = this.grid[y].some(tileVal => tileVal !== T.OUTFIELD);
            if (hasPlayableTile) {
                lastPlayableRow = y;
                break;
            }
        }


        if (lastPlayableRow === -1) return;



        const limitY = (lastPlayableRow + 1) * this.tileSize;


        const graphics = this.add.graphics();
        graphics.setDepth(20);


        graphics.lineStyle(4, 0xff0055, 0.3);
        const mapPixelWidth = this.mapWidth * this.tileSize;
        graphics.lineBetween(0, limitY, mapPixelWidth, limitY);

        graphics.lineStyle(2, 0xff0055, 0.8);
        graphics.lineBetween(0, limitY, mapPixelWidth, limitY);
        
        graphics.lineStyle(1, 0xffffff, 1.0);
        graphics.lineBetween(0, limitY, mapPixelWidth, limitY);


        const labelBox = this.add.container(mapPixelWidth / 2, limitY);
        labelBox.setDepth(21);

        const bg = this.add.rectangle(0, 0, 140, 20, 0x000000, 0.8);
        bg.setStrokeStyle(1, 0xff0055);

        const text = this.add.text(0, 0, "DEPLOYMENT LIMIT", {
            fontSize: '11px',
            fontFamily: 'Rajdhani, sans-serif',
            color: '#ff0055',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        labelBox.add([bg, text]);
        

        this.mapData.limitPixelY = limitY;
    }
   

    getAdjustedStats(type, name) {
        const unitStats = this._getUnitStats();
        const skillStats = this._getSkillStats();
        const base = (type === 'Unit') ? unitStats[name] : skillStats[name];
        let stats = JSON.parse(JSON.stringify(base)); 
        const commanders = this._getCommanders();
        const cmd = commanders[this._getSelectedCommander()];
        if (cmd && cmd.type === 'PASSIVE_BUFF') {
            if (type === 'Unit' && stats.race === '보병') {
                stats.hp = Math.floor(stats.hp * 1.2);
                stats.damage = Math.floor(stats.damage * 1.2);
            }
        } else if (cmd && cmd.type === 'PASSIVE_COST') {
            if (type === 'Skill') {
                stats.cost = Math.max(0, stats.cost - 1);
            }
        }
        return stats;
    }


update(time, delta) {
        if (!this.isPlaying) {

            this.updateBonusUI();
        } else {
        this.updateGhostSimulation();
        const scaled = Math.min((delta / 1000) * this.timeSpeed, this.battleMaxFrame);
        this.battleTimeAcc += scaled;
        let guard = 0;
        while (this.isPlaying && this.battleTimeAcc + 1e-9 >= this.battleFixedStep && guard < 20) {
            this.battleTimeAcc -= this.battleFixedStep;
            guard++;
            if (this._stepBattleTick(this.battleFixedStep)) {
                this.battleTimeAcc = 0;
                break;
            }
        }
        this.drawCommanderHUD();
    }
    }

    _stepBattleTick(dt) {
        if (this.artifactManager) this.artifactManager.update(dt);
        this.battleTime += dt;
        this.uiManager.updateTimeUI();
        this.easystar.calculate();

        this.checkSpawns();

        this.activeUnits.forEach(unit => {
            if (unit.active && unit.update) unit.update(dt);
        });

        const enemyBase = this.activeUnits.find(u => u.isBase && u.team === 'ENEMY');
        if (enemyBase && (enemyBase.currentHp <= 0 || !enemyBase.active)) {
            this.checkGameEnd('ENEMY_DESTROYED');
            return true;
        }

        const myBase = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (myBase && (myBase.currentHp <= 0 || !myBase.active)) {
            this.checkGameEnd('ALLY_DESTROYED');
            return true;
        }

        this.activeUnits = this.activeUnits.filter(u => u.active);

        this.activeProjectiles.forEach(proj => {
            if (proj.active && proj.update) proj.update(dt);
        });
        this.activeProjectiles = this.activeProjectiles.filter(p => p.active);
        this._tickSimCompare();

        const rules = this._getRules();
        const ROUND_TIME_LIMIT = rules.ROUND_TIME_LIMIT;
        const MAX_ROUNDS = rules.MAX_ROUNDS;
        if (this.battleTime >= ROUND_TIME_LIMIT) {
            if (this.currentRound >= MAX_ROUNDS) {
                this.addLog(this._t('battle.endByTime'), "log-purple");
                this.checkGameEnd('TIME_OVER');
            } else {
                this.endRound();
            }
            return true;
        }

        const cmd = this._getCommanders()[this._getSelectedCommander()];
        if (cmd && cmd.type === 'ACTIVE_ATK') {
            if (this.commanderCooldown > 0) {
                this.commanderCooldown -= dt;
            } else {
                const target = this.findNearestEnemy();
                if (target) {
                    const dist = Phaser.Math.Distance.Between(100, this.scale.height / 2, target.x, target.y);
                    if (dist <= cmd.range) {
                        this.fireCommanderSkill(target, cmd);
                        this.commanderCooldown = cmd.cooldown;
                    }
                }
            }
        }
        return false;
    }

updateBonusUI() {
        const indicator = document.getElementById('timeline-bonus-bar');
        if (!indicator) return;

        const mgr = this.cardManager;

        if (!mgr || mgr.selectedCardIdx === -1 || !mgr.hand[mgr.selectedCardIdx]) {
            indicator.style.display = 'none';
            return;
        }

        const card = mgr.hand[mgr.selectedCardIdx];
        if (!card || typeof card !== 'object') return;
        const type = card.type;
        const name = card.name;
        const stats = this.getAdjustedStats(type, name);

        if (stats && stats.bonusTime) {
            const [start, end] = stats.bonusTime; 
            const maxTime = this._getRules().ROUND_TIME_LIMIT;



            const leftPercent = (start / maxTime) * 100;
            const widthPercent = ((end - start) / maxTime) * 100;

            indicator.style.left = `${leftPercent}%`;
            indicator.style.width = `${widthPercent}%`;
            
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }


    findNearestToPoint(x, y, targetTeam) {
        let nearest = null, minDist = 9999;
        this.activeUnits.forEach(u => {
            if (u.active && u.team === targetTeam && !u.isStealthed) {
                const d = Phaser.Math.Distance.Between(x, y, u.x, u.y);
                if (d < minDist) { minDist = d; nearest = u; }
            }
        });
        return nearest;
    }


    drawDeploymentZones(shouldDraw) {
        if (!this.interactionManager || typeof this.interactionManager.drawDeploymentZones !== 'function') return;
        this.interactionManager.drawDeploymentZones(shouldDraw);
    }

    cancelDeployment(plan) {
        if (!this.interactionManager || typeof this.interactionManager.cancelDeployment !== 'function') return;
        this.interactionManager.cancelDeployment(plan);
    }



checkSpawns() {

        this.deployedObjects.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {

                plan.spawned = true;

                if (plan.type === 'Unit') {
                    const stats = this.getAdjustedStats('Unit', plan.name); 
                    const spawnCount = stats.count || 1;
                    this._traceEvent('spawn_plan_ally_unit', { name: plan.name, count: spawnCount, at: +plan.time.toFixed(2) });
                    for (let i = 0; i < spawnCount; i++) {
                        const offsetX = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].x : 0;
                        const offsetY = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].y : 0;
                        


                        if (this.spawnUnitWithEffect) {
                            this.spawnUnitWithEffect(plan.name, plan.x + offsetX, plan.y + offsetY, plan.time);
                        } else {

                            this.spawnUnit(plan.x + offsetX, plan.y + offsetY, 'ALLY', plan.name);
                        }
                    }
                } else {

                    this._debugLog(`[CheckSpawns] skill activation: ${plan.name}`);
                    this._traceEvent('spawn_plan_ally_skill', { name: plan.name, x: Math.round(plan.x), y: Math.round(plan.y), at: +plan.time.toFixed(2) });
                    this.applySkillEffect(plan, 'ENEMY');
                }
                

                if (plan.visualMarker) plan.visualMarker.destroy();
                if (plan.visualText) plan.visualText.destroy();
            }
        });


        this.enemyWave.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {
                plan.spawned = true;
                
                if (plan.type === 'Unit') {
                    const stats = this._getEnemyStats(plan.name);
                    
                    if (!stats) {
                        console.error(`[Spawns] ${this._t('battle.spawnDataMissing', { name: plan.name })}`);
                        return;
                    }

                    const spawnCount = stats.count || 1;
                    this._traceEvent('spawn_plan_enemy_unit', { name: plan.name, count: spawnCount, at: +plan.time.toFixed(2) });
                    for (let i = 0; i < spawnCount; i++) {
                        const offsetX = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].x : 0;
                        const offsetY = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].y : 0;



                        this.spawnUnit(plan.x + offsetX, plan.y + offsetY, 'ENEMY', plan.name);
                    }
                } else {

                    this._traceEvent('spawn_plan_enemy_skill', { name: plan.name, x: Math.round(plan.x), y: Math.round(plan.y), at: +plan.time.toFixed(2) });
                    this.applySkillEffect(plan, 'ALLY');
                }
            }
        });
    }
spawnUnit(x, y, team, name, customStats = null) {


        let stats = customStats;
        
        if (!stats) {
            stats = (team === 'ALLY') ? this.getAdjustedStats('Unit', name) : this._getEnemyStats(name);
        }


        if (!stats) {
            console.error(`[Spawn Error] ${this._t('battle.spawnDataNotFound', { name })}`);
            return null;
        }


        let unit;
        try {
            unit = new Unit(this, x, y, name, team, stats);
        } catch (e) {
            console.error(`[Spawn Error] ${this._t('battle.spawnCreateFail', { name })}`, e);
            return null;
        }


        unit.team = team;
        
        if (this.activeUnits) {
            this.activeUnits.push(unit);
        }

        return unit;
    }

 // js/scenes/BattleScene.js


    spawnUnitWithEffect(cardName, x, y, time) {

        const baseStats = this.getAdjustedStats('Unit', cardName);
        

        let finalStats = JSON.parse(JSON.stringify(baseStats));
        let appliedBonus = false;


        if (baseStats.bonusTime && baseStats.bonusEffect) {
            const [start, end] = baseStats.bonusTime;
            

            if (time >= start && time <= end) {
                const effect = baseStats.bonusEffect;
                

                if (effect.unit === '%') {
                    finalStats[effect.stat] = Math.floor(finalStats[effect.stat] * (1 + effect.val / 100));
                } 

                else {
                    finalStats[effect.stat] += effect.val;
                }
                
                appliedBonus = true;
            }
        }


        const unit = this.spawnUnit(x, y, 'ALLY', cardName, finalStats);


        if (appliedBonus && unit) {
            // (1) 濡쒓렇 異쒕젰
            const bonusText = this.cardManager.getBonusText(baseStats.bonusEffect);
            this.addLog(`✨${cardName}: ${this._t('battle.timingBonus', { bonus: bonusText })}`, "log-green");


            // createExplosion(x, y, radius, color)
            this.combatManager.createExplosion(unit.x, unit.y, 80, 0x00ffcc); 


            this.combatManager.showFloatingText(
                unit.x, 
                unit.y - 50,
                `✨${this._t('battle.timingBonusTitle')}\n${bonusText}`,
                '#00ffcc',
                '18px'
            );
            

            unit.setAlpha(0.5);
            unit.setScale(1.5);
            

            if (unit.bodySprite) unit.bodySprite.setTint(0xffffff);

            this.tweens.add({
                targets: unit,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 400,
                ease: 'Back.out',
                onComplete: () => {

                    if (unit && unit.active) unit.resetTint();
                }
            });
        }
    }

addLog(msg, colorClass = '') {
        this.uiManager.addLog(msg, colorClass);
    }

applySkillEffect(plan, hostileTeam) {
        if (this.combatManager) {
            this.combatManager.applySkillEffect(plan, hostileTeam);
        } else {
            console.error(`[BattleScene] ${this._t('battle.combatManagerMissing')}`);
        }
    }

    applyDamage(attacker, target, damage) {
this.combatManager.applyDamage(attacker, target, damage);
    }

    createExplosion(x, y, radius, color) {
this.combatManager.createExplosion(x, y, radius, color);
    }

showFloatingText(x, y, msg, color) {
        this.combatManager.showFloatingText(x, y, msg, color);
    }

killUnit(unit) {
        this.combatManager.killUnit(unit);
    }

 createBase(team) {

    const centerY = this.scale.height / 2;

    const x = (team === 'ALLY') ? 100 : (this.scale.width - 100); 
    const y = centerY;

    let stats = {};
    let unitName = '';
    const data = this._getGameData() || { campaign: { currentNodeId: 0 }, getNode: () => null };
    const commanders = this._getCommanders();


    if (team === 'ALLY') {

        const cmdKey = this._getSelectedCommander();
        const cmdData = commanders[cmdKey] || commanders['knight'];

        unitName = `Base_${cmdKey}`; 
        
stats = {
            hp: cmdData.hp,
            damage: 0,
            speed: 0,
            range: 0,
            isStructure: true,
            

            parts: {
                body: `base_${cmdKey}`,
                weapon: null,
                acc: null
            }
        };


        if (data && !(data.stage === 1 && data.campaign.day === 1)) {
            if (data.currentHp) stats.currentHp = data.currentHp;
        }

    } else {

        const currId = data.campaign.currentNodeId;
        const currNode = data.getNode(currId);
        
        let enemyId = currNode ? currNode.enemyId : null;
        const enemyPool = this._getEnemyDataPool();
        let enemyCmd = enemyPool[enemyId];


        if (!enemyCmd) {
            console.warn(`[Battle] ${this._t('battle.enemyDataMissing', { id: enemyId })}`);
            enemyCmd = enemyPool['goblin_rookie'] || { hp: 1000, image: 'enemy_base' }; 
        }

        this.currentEnemyData = enemyCmd; 
        unitName = `Base_Enemy`; 
        
stats = {
            hp: enemyCmd.hp,
            damage: 0,
            speed: 0,
            range: 0,
            isStructure: true,
            

            parts: {
                body: 'base_enemy',
                weapon: null,
                acc: null
            }
        };
    }


    const baseUnit = this.spawnUnit(x, y, team, unitName, stats);
    

    if (baseUnit) {
        baseUnit.isBase = true;
        baseUnit.isSpawned = true;


        if (baseUnit.bodySprite) {

            baseUnit.bodySprite.setDisplaySize(100, 120);
            

            baseUnit.bodySprite.setOrigin(0.5, 1.0); 
        }


        if (baseUnit.body) {
            baseUnit.body.setImmovable(true);
            baseUnit.body.moves = false;
        }



        baseUnit.on('dead', () => {
            this._debugLog(`[Battle] base destroyed: ${team}`);
            
            if (team === 'ALLY') {

                if (typeof this.handleGameOver === 'function') {
                    this.handleGameOver();
                } else {
                    this._debugLog("clearGame function missing");
                }
            } else {

                if (typeof this.handleStageClear === 'function') {
                    this.handleStageClear();
                } else {
                    this._debugLog("nextStage function missing");
                }
            }
        });
    }

    return baseUnit;
}



checkGameEnd(reason) {
        if (!this.isPlaying) return;
        this._finalizeSimCompare(`GAME_END:${reason}`);
        
        this.isPlaying = false;
        this.uiManager.toggleBattleUI(false);

        if (reason === 'ENEMY_DESTROYED') {

            this._debugLog("win: enemy base destroyed");
            const data = this._getGameData();
            if (data) data.completeCurrentNode();
            this.showRewardPopup(this._t('battle.winEnemyBase'));
            
        } else if (reason === 'ALLY_DESTROYED') {

            this._debugLog("lose: ally base destroyed");
            this.handleGameOver(this._t('battle.loseAllyBase'));

        } else if (reason === 'TIME_OVER') {

            const myBase = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
            const enemyBase = this.activeUnits.find(u => u.isBase && u.team === 'ENEMY');
            const myHp = myBase ? myBase.currentHp : 0;
            const enemyHp = enemyBase ? enemyBase.currentHp : 0;
            
            if (myHp >= enemyHp) {

                this._debugLog("timeout: ally hp advantage");
                const data = this._getGameData();
                if (data) data.completeCurrentNode();
                this.showRewardPopup(this._t('battle.timeOverAdv'));
            } else {

                this._debugLog("timeout: enemy hp advantage");
                this.handleGameOver(this._t('battle.timeOverDisadv'));
            }
        }
    }
   // js/scenes/BattleScene.js
// js/scenes/BattleScene.js
showRewardPopup(winMsg) {

        const uiIds = ['timeline-slider', 'hand-container', 'ui-top-bar', 'ui-bottom-bar', 'btn-turn-end', 'btn-reset'];
        uiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });


        const rewards = this.cardManager.generateRewards ? this.cardManager.generateRewards() : [];
        if (rewards.length === 0) {
            rewards.push(
                { type: 'Unit', name: '검사' },
                { type: 'Unit', name: '궁수' },
                { type: 'Skill', name: '화염구' }
            );
        }


        let popup = document.getElementById('reward-popup');
        if (popup) popup.remove();

        popup = document.createElement('div');
        popup.id = 'reward-popup';


        popup.innerHTML = `
            <div class="reward-box">
                <div class="reward-title">${this._t('battle.victoryTitle')}</div>
                <div class="reward-subtitle">${winMsg || this._t('battle.victorySubtitle')}</div>
                <div class="reward-card-container" id="reward-cards"></div>
                <button class="btn-reward-skip" id="btn-skip-reward">${this._t('battle.skipReward')}</button>
            </div>
        `;
        
        document.body.appendChild(popup);


        const cardContainer = popup.querySelector('#reward-cards');

        rewards.forEach((card) => {

            const cardNode = this.cardManager.createCardElement(card);
            if (!card || typeof card !== 'object') return;
            const type = card.type;
            const name = card.name;
            const stats = (type === 'Unit') ? this._getUnitStats()[name] : this._getSkillStats()[name];
            const rarity = stats.rarity || 'COMMON';


            cardNode.classList.remove('card-in-viewer'); 
            cardNode.style.position = 'relative'; 
            cardNode.style.transform = 'scale(1.0)';
            cardNode.style.margin = '0';
            cardNode.style.cursor = 'pointer';
            cardNode.style.opacity = '1';
            

            if (rarity === 'RARE') cardNode.style.boxShadow = `0 0 15px rgba(0, 255, 0, 0.5)`;
            else if (rarity === 'EPIC') cardNode.style.boxShadow = `0 0 20px rgba(200, 0, 255, 0.6)`;
            else if (rarity === 'LEGENDARY') cardNode.style.boxShadow = `0 0 25px rgba(255, 215, 0, 0.8)`;


            cardNode.onclick = () => {
                const data = this._getGameData();
                if (data) {
                    data.addCard({ type, name });
                    data.addGold(50);
                }
                

                if(this.scene.get('ShopScene')) {
                    this.scene.get('ShopScene').showCustomPopup(this._t('battle.rewardGot'), this._t('battle.rewardGotMsg', { name }));
                } else {
                    alert(this._t('battle.rewardAlert', { name }));
                }

                document.body.removeChild(popup);
                this.scene.start('MapScene');
            };


            cardNode.onmouseenter = () => { 
                cardNode.style.transform = 'scale(1.1) translateY(-10px)'; 
                cardNode.style.zIndex = '100'; 
            };
            cardNode.onmouseleave = () => { 
                cardNode.style.transform = 'scale(1.0)'; 
                cardNode.style.zIndex = ''; 
              
            };

            cardContainer.appendChild(cardNode);
        });


        document.getElementById('btn-skip-reward').onclick = () => {
            const data = this._getGameData();
            if (data) data.addGold(50);
            document.body.removeChild(popup);
            this.scene.start('MapScene');
        };
    }

    handleGameOver(reason) {
        this.statusText.setText(this._t('battle.gameOver'));
        this.addLog(this._t('battle.defeatLog'), "log-red");
        const finalReason = reason || this._t('battle.defaultDefeatReason');
        this.showPopup(
            this._t('battle.gameOverTitle'),
            this._t('battle.gameOverReset', { reason: finalReason }),
            () => {
            const data = this._getGameData();
            if (data) data.startNewGame();
            this.scene.start('TitleScene');
            }
        );
    }


    runPreSimulation() {
        const simulationResults = this.simulator.run(
            this._getRules().ROUND_TIME_LIMIT,
            [],   
            [],   
            this.activeUnits, 
            { 
                width: this.scale.width, 
                height: this.scale.height,
                grid: this.grid,
                tileSize: this.tileSize,
                easystar: this.simEasystar,
                commanderCooldown: this.commanderCooldown,
                timeSpeed: this.timeSpeed || 1.0,
                turretCooldown: (this.artifactManager && typeof this.artifactManager.turretCooldown === 'number')
                    ? this.artifactManager.turretCooldown
                    : 0
            }
        );
        return simulationResults; 
    }

    _beginPreviewFrame() {
        this.previewPoolCursor.sprites = 0;
        this.previewPoolCursor.circles = 0;
        this.previewPoolCursor.texts = 0;
        this.previewPoolCursor.rects = 0;
    }

    _endPreviewFrame() {
        const pools = this.previewPools;
        const c = this.previewPoolCursor;

        for (let i = c.sprites; i < pools.sprites.length; i++) {
            if (pools.sprites[i] && pools.sprites[i].active) pools.sprites[i].setVisible(false);
        }
        for (let i = c.circles; i < pools.circles.length; i++) {
            if (pools.circles[i] && pools.circles[i].active) pools.circles[i].setVisible(false);
        }
        for (let i = c.texts; i < pools.texts.length; i++) {
            if (pools.texts[i] && pools.texts[i].active) pools.texts[i].setVisible(false);
        }
        for (let i = c.rects; i < pools.rects.length; i++) {
            if (pools.rects[i] && pools.rects[i].active) pools.rects[i].setVisible(false);
        }
    }

    _acquirePreviewSprite(textureKey, x, y) {
        const idx = this.previewPoolCursor.sprites++;
        let obj = this.previewPools.sprites[idx];
        if (!obj || !obj.active) {
            obj = this.add.sprite(x, y, textureKey);
            this.previewPools.sprites[idx] = obj;
            this.ghostGroup.add(obj);
        } else {
            if (obj.texture && obj.texture.key !== textureKey && this.textures.exists(textureKey)) {
                obj.setTexture(textureKey);
            }
            obj.setPosition(x, y);
        }
        obj.setVisible(true);
        return obj;
    }

    _acquirePreviewCircle(x, y, radius, color, alpha, strokeWidth = 0, strokeColor = color, strokeAlpha = 1) {
        const idx = this.previewPoolCursor.circles++;
        let obj = this.previewPools.circles[idx];
        if (!obj || !obj.active) {
            obj = this.add.circle(x, y, radius, color, alpha);
            this.previewPools.circles[idx] = obj;
            this.ghostGroup.add(obj);
        } else {
            obj.setPosition(x, y);
            obj.setRadius(radius);
            obj.setFillStyle(color, alpha);
        }

        if (strokeWidth > 0) obj.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
        else obj.setStrokeStyle(0, strokeColor, 0);

        obj.setVisible(true);
        return obj;
    }

    _acquirePreviewText(x, y, value, style) {
        const idx = this.previewPoolCursor.texts++;
        let obj = this.previewPools.texts[idx];
        if (!obj || !obj.active) {
            obj = this.add.text(x, y, value, style).setOrigin(0.5);
            this.previewPools.texts[idx] = obj;
            this.ghostGroup.add(obj);
        } else {
            obj.setPosition(x, y);
            obj.setText(value);
            obj.setStyle(style);
            obj.setOrigin(0.5);
        }
        obj.setVisible(true);
        return obj;
    }

    _acquirePreviewRect(x, y, width, height, color, alpha = 1) {
        const idx = this.previewPoolCursor.rects++;
        let obj = this.previewPools.rects[idx];
        if (!obj || !obj.active) {
            obj = this.add.rectangle(x, y, width, height, color, alpha);
            this.previewPools.rects[idx] = obj;
            this.ghostGroup.add(obj);
        } else {
            obj.setPosition(x, y);
            obj.setSize(width, height);
            obj.setFillStyle(color, alpha);
        }
        obj.setVisible(true);
        return obj;
    }



 // js/scenes/BattleScene.js
// js/scenes/BattleScene.js

    updateGhostSimulation() {
        const now = Date.now();

        if (this.lastSimTime && (now - this.lastSimTime < 50)) {
            return; 
        }
        this.lastSimTime = now;


        this._beginPreviewFrame();
        this.predictionGraphics.clear(); 
        


        
        let currentTime;
        if (this.isPlaying) {

            currentTime = this.battleTime; 
        } else {

            const slider = document.getElementById('timeline-slider');
            if (!slider) {
                this._endPreviewFrame();
                return;
            }
            currentTime = parseFloat(slider.value) / 100;
        }



        if (!this.isPlaying) {
            const builtPlans = this._buildSimPlans();
            const allyPlansWithTeam = builtPlans.ally;
            const enemyPlansWithTeam = builtPlans.enemy;

            const results = this.simulator.run(
                currentTime, 
                allyPlansWithTeam, 
                enemyPlansWithTeam, 
                this.activeUnits, 
                { 
                    width: this.scale.width, 
                    height: this.scale.height,
                    grid: this.grid,          
                    tileSize: this.tileSize,  
                    easystar: this.simEasystar,
                    commanderCooldown: this.commanderCooldown,
                    timeSpeed: this.timeSpeed || 1.0,
                    turretCooldown: (this.artifactManager && typeof this.artifactManager.turretCooldown === 'number')
                        ? this.artifactManager.turretCooldown
                        : 0
                }
            );


            results.forEach(vUnit => {
                if (!vUnit.isSpawned) return; 
                
                const color = (vUnit.team === 'ALLY') ? 0x00ff00 : 0xff0000;


                this.predictionGraphics.lineStyle(2, color, 0.5); 
                this.predictionGraphics.beginPath();

                let hasHistory = false;
                if (vUnit.pathLogs && vUnit.pathLogs.length > 0) {
                    this.predictionGraphics.moveTo(vUnit.pathLogs[0].x, vUnit.pathLogs[0].y);
                    for (let i = 1; i < vUnit.pathLogs.length; i++) {
                        this.predictionGraphics.lineTo(vUnit.pathLogs[i].x, vUnit.pathLogs[i].y);
                    }
                    this.predictionGraphics.lineTo(vUnit.x, vUnit.y);
                    hasHistory = true;
                }
                if (vUnit.path && vUnit.path.length > 0) {
                    if (!hasHistory) this.predictionGraphics.moveTo(vUnit.x, vUnit.y);
                    vUnit.path.forEach(node => {
                        const pixelX = node.x * this.tileSize + this.tileSize / 2;
                        const pixelY = node.y * this.tileSize + this.tileSize / 2;
                        this.predictionGraphics.lineTo(pixelX, pixelY);
                    });
                }
                this.predictionGraphics.strokePath();


                if (vUnit.active) {
                    this.createGhost(vUnit.x, vUnit.y, vUnit.name, color, 0.7, vUnit.currentHp, vUnit.stats.hp, vUnit.isBonus);
                } else {
                    this._acquirePreviewText(vUnit.x, vUnit.y, '☠', { fontSize: '24px', stroke: '#000', strokeThickness: 3 });
                }
            });
        }



        this.deployedObjects.forEach(plan => {
            if (plan.time < currentTime || plan.spawned) return;

            if (plan.type === 'Unit') {
                let isBonus = false;
                const stats = this.getAdjustedStats('Unit', plan.name);
                if (!stats) return;

                if (stats.bonusTime) {
                    const [start, end] = stats.bonusTime;
                    if (plan.time >= start && plan.time <= end) {
                        isBonus = true;
                    }
                }

                this.createGhost(
                    plan.x,
                    plan.y,
                    plan.name,
                    0x00ff00,
                    0.3,
                    stats.hp,
                    stats.hp,
                    isBonus
                );

                this._acquirePreviewText(plan.x, plan.y + 30, `${plan.time.toFixed(1)}s`, {
                    fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 2
                });
                return;
            }

            if (plan.type === 'Skill') {
                const stats = this.getAdjustedStats('Skill', plan.name);
                if (!stats) return;

                const radius = Math.max(12, Math.floor(stats.radius || 40));
                const color = stats.color || 0x66aaff;

                this._acquirePreviewCircle(plan.x, plan.y, radius, color, 0.18, 2, color, 0.7);
                this._acquirePreviewCircle(plan.x, plan.y, 8, color, 0.9);

                this._acquirePreviewText(plan.x, plan.y - radius - 14, `${plan.name}`, {
                    fontSize: '11px',
                    color: '#aaddff',
                    stroke: '#000',
                    strokeThickness: 2
                });

                this._acquirePreviewText(plan.x, plan.y + radius + 12, `${plan.time.toFixed(1)}s`, {
                    fontSize: '12px',
                    color: '#fff',
                    stroke: '#000',
                    strokeThickness: 2
                });
            }
        });


        this.enemyWave.forEach(plan => {
            if (plan.time > currentTime && plan.type === 'Unit' && !plan.spawned) {
                this.createGhost(plan.x, plan.y, plan.name, 0xff0000, 0.3, 100, 100, false);
            }
        });

        this._endPreviewFrame();
    }

    drawPredictions() {
        this.updateGhostSimulation();
    }

    _startSimCompare() {
        const rules = this._getRules();
        if (!rules.DEBUG_SIM_COMPARE) {
            this.simCompareDebug = null;
            return;
        }

        const seedUnits = this.activeUnits
            .filter(u => u && u.active && u.isSpawned)
            .map(u => this.simulator.cloneUnit(u));

        const builtPlans = this._buildSimPlans();
        this.simCompareDebug = {
            round: this.currentRound,
            interval: rules.SIM_COMPARE_INTERVAL || 1.0,
            nextSampleTime: rules.SIM_COMPARE_INTERVAL || 1.0,
            simStepTime: rules.SIM_COMPARE_STEP || this.battleFixedStep || (1 / 60),
            seedUnits,
            commanderCooldown: this.commanderCooldown,
            turretCooldown: (this.artifactManager && typeof this.artifactManager.turretCooldown === 'number')
                ? this.artifactManager.turretCooldown
                : 0,
            allyPlans: builtPlans.ally,
            enemyPlans: builtPlans.enemy,
            samples: []
        };
        this.simTrace = {
            enabled: !!rules.DEBUG_SIM_TRACE,
            maxEvents: rules.SIM_TRACE_MAX_EVENTS || 300,
            events: []
        };
        this._traceEvent('round_start', { round: this.currentRound });
        this._captureSimCompareSample(0);
        this._debugLog('[SimCompare] started', this.simCompareDebug);
        this.addLog('[Debug] 예측-실전 오차 추적 시작', 'log-purple');
    }

    _traceEvent(type, payload = {}) {
        if (!this.simTrace || !this.simTrace.enabled) return;
        const evt = {
            t: +((this.battleTime || 0).toFixed(2)),
            type,
            ...payload
        };
        this.simTrace.events.push(evt);
        if (this.simTrace.events.length > this.simTrace.maxEvents) {
            this.simTrace.events.shift();
        }
    }

    _buildSimPlans() {
        const ally = this.deployedObjects.map(p => {
            const stats = (p.type === 'Unit') ? this.getAdjustedStats('Unit', p.name) : this.getAdjustedStats('Skill', p.name);
            return { ...p, team: 'ALLY', stats: stats || p.stats };
        });
        const enemy = this.enemyWave.map(p => {
            let stats = null;
            if (p.type === 'Unit') stats = this._getEnemyStats(p.name);
            else if (p.type === 'Skill') stats = this.getAdjustedStats('Skill', p.name);
            return { ...p, team: 'ENEMY', stats: stats || p.stats };
        });
        return { ally, enemy };
    }

    _tickSimCompare() {
        if (!this.simCompareDebug || !this.isPlaying) return;
        const s = this.simCompareDebug;
        while (this.battleTime + 1e-6 >= s.nextSampleTime) {
            this._captureSimCompareSample(s.nextSampleTime);
            s.nextSampleTime += s.interval;
        }
    }

    _captureSimCompareSample(sampleTime) {
        const s = this.simCompareDebug;
        if (!s) return;
        const roundLimit = this._getRules().ROUND_TIME_LIMIT || 10.0;
        // Round-end boundary (exact 10.0s) often has frame-order jitter between real vs sim.
        // Compare just before boundary to avoid counting a one-frame phantom hit as systemic error.
        const compareTime = (sampleTime >= roundLimit - 1e-6)
            ? Math.max(0, sampleTime - 0.001)
            : sampleTime;

        const mapContext = {
            width: this.scale.width,
            height: this.scale.height,
            grid: this.grid,
            tileSize: this.tileSize,
            easystar: this.simEasystar,
            commanderCooldown: s.commanderCooldown || 0,
            timeSpeed: this.timeSpeed || 1.0,
            turretCooldown: s.turretCooldown || 0,
            simStepTime: s.simStepTime || 0.02
        };
        const seed = s.seedUnits.map(u => JSON.parse(JSON.stringify(u)));
        const predicted = this.simulator.run(compareTime, s.allyPlans, s.enemyPlans, seed, mapContext);
        const actual = this._snapshotActualState();
        const delta = this._computeSimDelta(predicted, actual);

        s.samples.push({ t: sampleTime, delta });
        this._debugLog(`[SimCompare][t=${sampleTime.toFixed(2)}]`, delta);
    }

    _snapshotActualState() {
        const units = [];
        this.activeUnits.forEach(u => {
            if (!u || !u.isSpawned) return;
            units.push({
                name: u.name,
                team: u.team,
                isBase: !!u.isBase,
                active: !!u.active,
                currentHp: Math.max(0, u.currentHp || 0),
                x: u.x,
                y: u.y
            });
        });
        return units;
    }

    _summarizeState(units) {
        const base = {
            ALLY: { alive: 0, totalHp: 0, baseHp: 0 },
            ENEMY: { alive: 0, totalHp: 0, baseHp: 0 }
        };

        units.forEach(u => {
            if (!u || !base[u.team]) return;
            if (u.active) {
                base[u.team].alive += 1;
                base[u.team].totalHp += Math.max(0, u.currentHp || 0);
            }
            if (u.isBase) {
                base[u.team].baseHp = Math.max(0, u.currentHp || 0);
            }
        });
        return base;
    }

    _computeSimDelta(predicted, actual) {
        const p = this._summarizeState(predicted);
        const a = this._summarizeState(actual);
        return {
            ally: {
                aliveDiff: p.ALLY.alive - a.ALLY.alive,
                hpDiff: Math.round(p.ALLY.totalHp - a.ALLY.totalHp),
                baseHpDiff: Math.round(p.ALLY.baseHp - a.ALLY.baseHp)
            },
            enemy: {
                aliveDiff: p.ENEMY.alive - a.ENEMY.alive,
                hpDiff: Math.round(p.ENEMY.totalHp - a.ENEMY.totalHp),
                baseHpDiff: Math.round(p.ENEMY.baseHp - a.ENEMY.baseHp)
            }
        };
    }

    _finalizeSimCompare(tag = 'END') {
        const s = this.simCompareDebug;
        if (!s) return;
        const count = s.samples.length;
        if (count === 0) {
            this.addLog(`[Debug] 오차 샘플 없음 (${tag})`, 'log-purple');
            this.simCompareDebug = null;
            return;
        }

        let allyAbsHp = 0;
        let enemyAbsHp = 0;
        let allyAbsBaseHp = 0;
        let enemyAbsBaseHp = 0;
        let allyAbsAlive = 0;
        let enemyAbsAlive = 0;
        s.samples.forEach(x => {
            allyAbsHp += Math.abs(x.delta.ally.hpDiff);
            enemyAbsHp += Math.abs(x.delta.enemy.hpDiff);
            allyAbsBaseHp += Math.abs(x.delta.ally.baseHpDiff);
            enemyAbsBaseHp += Math.abs(x.delta.enemy.baseHpDiff);
            allyAbsAlive += Math.abs(x.delta.ally.aliveDiff);
            enemyAbsAlive += Math.abs(x.delta.enemy.aliveDiff);
        });

        const summary = {
            samples: count,
            avgAllyHpErr: Math.round(allyAbsHp / count),
            avgEnemyHpErr: Math.round(enemyAbsHp / count),
            avgAllyBaseHpErr: Math.round(allyAbsBaseHp / count),
            avgEnemyBaseHpErr: Math.round(enemyAbsBaseHp / count),
            avgAllyAliveErr: +(allyAbsAlive / count).toFixed(2),
            avgEnemyAliveErr: +(enemyAbsAlive / count).toFixed(2),
            tag
        };

        this._debugLog('[SimCompare][Summary]', summary, s.samples);
        this.addLog(`[Debug] 오차 요약 AHP:${summary.avgAllyHpErr} EHP:${summary.avgEnemyHpErr} AB:${summary.avgAllyBaseHpErr} EB:${summary.avgEnemyBaseHpErr}`, 'log-purple');
        console.log('[SimCompare][Summary]', summary);
        console.table(s.samples.map(x => ({ t: +x.t.toFixed(2), ...x.delta.ally, eAliveDiff: x.delta.enemy.aliveDiff, eHpDiff: x.delta.enemy.hpDiff, eBaseHpDiff: x.delta.enemy.baseHpDiff })));
        if (this.simTrace && this.simTrace.enabled) {
            console.log('[SimTrace][Summary]', { tag, count: this.simTrace.events.length });
            console.table(this.simTrace.events);
        }
        this.simCompareDebug = null;
        this.simTrace = null;
    }

createGhost(x, y, name, color, alpha, currentHp, maxHp, isBonus = false) {
        let imgKey = '';
        const unitStats = this._getUnitStats();
        if (unitStats && unitStats[name] && unitStats[name].image) {
             imgKey = unitStats[name].image; 
        } else {
             imgKey = 'img_' + name; 
        }

        let ghost;
        if (this.textures.exists(imgKey)) {
            ghost = this._acquirePreviewSprite(imgKey, x, y);
            ghost.setDisplaySize(40, 40);
            if (isBonus) ghost.setTint(0x00ffcc);
            else ghost.setTint(0x888888);
        } else {
            ghost = this._acquirePreviewCircle(x, y, 15, isBonus ? 0x00ffcc : color, alpha);
        }
        

        if (name === '기지') {
            ghost.setAlpha(0); 
        } else {
            ghost.setAlpha(alpha);
        }
        

        if (currentHp < maxHp) {
            const ratio = Phaser.Math.Clamp(currentHp / maxHp, 0, 1);
            

            const barWidth = (name === '기지') ? 60 : 30;
            const yOffset = (name === '기지') ? 65 : 25;

            this._acquirePreviewRect(x, y - yOffset, barWidth, 5, 0x000000, 1);

            const hpColor = (ratio < 0.3) ? 0xff0000 : 0xffff00; 
            this._acquirePreviewRect(x, y - yOffset, barWidth * ratio, 5, hpColor, 1);
        }

        return ghost;
    }


updateCostUI() {
        this.uiManager.updateCostUI();
    }
    createTimelineUI() {
        const slider = document.getElementById('timeline-slider');
        if (!slider) return;

        const wrapper = slider.parentElement; 
        

        let trackContainer = document.getElementById('slider-track-container');
        if (!trackContainer) {
            trackContainer = document.createElement('div');
            trackContainer.id = 'slider-track-container';
            

            trackContainer.style.flexGrow = '1'; 
            trackContainer.style.position = 'relative'; 
            trackContainer.style.height = '100%';
            trackContainer.style.display = 'flex';
            trackContainer.style.alignItems = 'center';
            trackContainer.style.margin = '0 10px'; 


            wrapper.insertBefore(trackContainer, slider); 
            trackContainer.appendChild(slider);           
        }



        let visualTrack = document.getElementById('timeline-visual-track');
        if (!visualTrack) {
            visualTrack = document.createElement('div');
            visualTrack.id = 'timeline-visual-track';
            trackContainer.appendChild(visualTrack);
        }
        
        visualTrack.style.position = 'absolute';
        visualTrack.style.width = '100%';
        visualTrack.style.height = '6px';
        visualTrack.style.backgroundColor = '#444';
        visualTrack.style.borderRadius = '3px';
        visualTrack.style.top = '50%';
        visualTrack.style.transform = 'translateY(-50%)';
        visualTrack.style.zIndex = '1';


        let indicator = document.getElementById('timeline-bonus-bar');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'timeline-bonus-bar';
            trackContainer.appendChild(indicator);
        }

        indicator.style.position = 'absolute';
        indicator.style.height = '6px'; 
        indicator.style.top = '50%';    
        indicator.style.transform = 'translateY(-50%)'; 
        indicator.style.backgroundColor = '#00ffcc'; 
        indicator.style.opacity = '1.0';
        indicator.style.pointerEvents = 'none'; 
        indicator.style.borderRadius = '3px';
        indicator.style.zIndex = '2';
        indicator.style.display = 'none';



        slider.style.width = '100%';
        slider.style.margin = '0';
        slider.style.position = 'relative';
        slider.style.zIndex = '3';
        slider.style.background = 'transparent';
        


    }

showPopup(title, msg, onConfirm, isConfirm) {
        this.uiManager.showPopup(title, msg, onConfirm, isConfirm);
    }

startRound() {
        if (this.isPlaying) return;

        const constants = this._getConstants();
        if (this.cardManager.hand.length > constants.MAX_HAND) {
            this.showPopup(
                this._t('battle.warnTitle'),
                this._t('battle.handOverflow', { current: this.cardManager.hand.length, max: constants.MAX_HAND })
            );
            return;
        }
        
        this.ghostGroup.clear(true, true);
        this.isPlaying = true;
        
        if (this.artifactManager) this.artifactManager.onRoundStart();
        this.battleTime = 0; 
        this.battleTimeAcc = 0;
        

        const slider = document.getElementById('timeline-slider');
        if(slider) slider.max = 1000; 

        this.statusText.setText(this._t('battle.roundInProgress', { turn: this.currentRound }));
        this.toggleBattleUI(true);
        this.addLog(this._t('battle.roundStartLog', { turn: this.currentRound }), "log-blue");
        this._traceEvent('start_round_click', { round: this.currentRound });
        this._startSimCompare();
        
        this.cardManager.selectedCardIdx = -1;
        this.cardManager.renderHand();
        this.predictionGraphics.clear();
    }

endRound() {
        this._traceEvent('round_end', { round: this.currentRound });
        this._finalizeSimCompare('ROUND_END');
        this.isPlaying = false;
        this.battleTime = 0;
        this.battleTimeAcc = 0;
        this.currentRound++;
        this.toggleBattleUI(false);
        const constants = this._getConstants();
        let recovered = this.playerCost + constants.RECOVERY_COST;
        if (recovered > constants.MAX_COST) recovered = constants.MAX_COST;
        this.playerCost = recovered;
        this.cardManager.drawCard(3);

        this.addLog(this._t('battle.roundEndLog'));
        this.statusText.setText(this._t('battle.roundReady', { turn: this.currentRound }));
        
        const slider = document.getElementById('timeline-slider');
        if(slider) slider.value = 0;
        const display = document.getElementById('time-display');
        if(display) display.innerText = "0.0s";
        
        this.updateCostUI();
        
        this.deployedObjects = this.deployedObjects.filter(plan => !plan.spawned);
        this.enemyWave = this.enemyWave.filter(plan => !plan.spawned);


        this.enemyAI.generateWave((this._getGameData() && this._getGameData().stage) ? this._getGameData().stage : 1);
        
        this.predictionGraphics.clear();
    }

toggleBattleUI(isBattle) {
        this.uiManager.toggleBattleUI(isBattle);
    }

    findNearestEnemy() {
        let nearest = null;
        let minDist = 9999;
        
        const originX = 100;
        const originY = this.scale.height / 2;

        this.activeUnits.forEach(u => {
            if (u.active && u.team === 'ENEMY' && !u.isStealthed) {
                const dist = Phaser.Math.Distance.Between(originX, originY, u.x, u.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = u;
                }
            }
        });
        return nearest;
    }

fireCommanderSkill(target, cmd) {
        this.combatManager.fireCommanderSkill(target, cmd);
    }

    drawCommanderHUD() {
        this.skillGraphics.clear();
        const cmd = this._getCommanders()[this._getSelectedCommander()];
        if (!cmd || cmd.type !== 'ACTIVE_ATK') return;

        const base = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (!base) return;

        const totalCool = cmd.cooldown;
        const currentCool = this.commanderCooldown;
        const ratio = Phaser.Math.Clamp(1 - (currentCool / totalCool), 0, 1);

        const x = base.x;
        const y = base.y;
        const radius = 60; 

        this.skillGraphics.lineStyle(4, 0x333333, 0.5);
        this.skillGraphics.strokeCircle(x, y, radius);

        const color = (ratio >= 1) ? 0x00ff00 : 0xffff00;
        
        this.skillGraphics.lineStyle(4, color, 0.8);
        this.skillGraphics.beginPath();
        
        const startAngle = Phaser.Math.DegToRad(-90);
        const endAngle = Phaser.Math.DegToRad(-90 + (360 * ratio));
        
        this.skillGraphics.arc(x, y, radius, startAngle, endAngle, false);
        this.skillGraphics.strokePath();
    }


    _getGameData() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.data) ? this.ctx.data : null;
    }

    _getUnitStats() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.unitStats) ? this.ctx.unitStats : {};
    }

    _getSkillStats() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.skillStats) ? this.ctx.skillStats : {};
    }

    _getConstants() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        if (this.ctx && this.ctx.constants) return this.ctx.constants;
        return {
            MAX_HAND: 7,
            MAX_COST: 50,
            RECOVERY_COST: 10
        };
    }

    _getRules() {
        const constants = this._getConstants();
        const source = (this.ctx && this.ctx.rules) ? this.ctx.rules : {};
        return {
            ROUND_TIME_LIMIT: source.ROUND_TIME_LIMIT || constants.ROUND_TIME_LIMIT || 10.0,
            MAX_ROUNDS: source.MAX_ROUNDS || constants.MAX_ROUNDS || 10,
            DEBUG_LOGS: (source.DEBUG_LOGS !== undefined)
                ? !!source.DEBUG_LOGS
                : !!constants.DEBUG_LOGS,
            DEBUG_SIM_COMPARE: (source.DEBUG_SIM_COMPARE !== undefined)
                ? !!source.DEBUG_SIM_COMPARE
                : (constants.DEBUG_SIM_COMPARE !== undefined ? !!constants.DEBUG_SIM_COMPARE : true),
            SIM_COMPARE_INTERVAL: source.SIM_COMPARE_INTERVAL || constants.SIM_COMPARE_INTERVAL || 1.0,
            SIM_COMPARE_STEP: source.SIM_COMPARE_STEP || constants.SIM_COMPARE_STEP || (1 / 60),
            DEBUG_SIM_TRACE: (source.DEBUG_SIM_TRACE !== undefined)
                ? !!source.DEBUG_SIM_TRACE
                : (constants.DEBUG_SIM_TRACE !== undefined ? !!constants.DEBUG_SIM_TRACE : true),
            SIM_TRACE_MAX_EVENTS: source.SIM_TRACE_MAX_EVENTS || constants.SIM_TRACE_MAX_EVENTS || 300,
            TILES: source.TILES || constants.TILES || { EMPTY: 0, BLOCKED: 1, DEPLOY: 2, WATCH: 3, OUTFIELD: 4 },
            PATH_TILES: source.PATH_TILES || constants.PATH_TILES || [0, 2, 3]
        };
    }

    _debugLog(...args) {
        if (!this._getRules().DEBUG_LOGS) return;
        console.log(...args);
    }

    _getCommanders() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.commanders) ? this.ctx.commanders : {};
    }

    _getSelectedCommander() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        if (this.ctx && typeof this.ctx.getSelectedCommander === 'function') return this.ctx.getSelectedCommander();
        return 'knight';
    }

    _getEnemyStats(name) {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        if (this.ctx && typeof this.ctx.getEnemyStats === 'function') return this.ctx.getEnemyStats(name);
        return null;
    }

    _getEnemyDataPool() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.enemyDataPool) ? this.ctx.enemyDataPool : {};
    }

    _getMapData(id) {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        if (this.ctx && typeof this.ctx.getMapData === 'function') return this.ctx.getMapData(id);
        return null;
    }

    getRealTimeCost(unitName) {

        const stat = this._getUnitStats()[unitName];
        if (!stat) return 0;

        let finalCost = stat.cost;


        if (stat.bonusTime) {
            let currentTime = 0;

            if (this.isPlaying) {

                currentTime = this.battleTime;
            } else {

                const slider = document.getElementById('timeline-slider');
                if (slider) {
                    currentTime = parseFloat(slider.value) / 100;
                }
            }


            const [start, end] = stat.bonusTime;
            if (currentTime >= start && currentTime <= end) {

                if (stat.bonusEffect && stat.bonusEffect.stat === 'cost') {
                    finalCost += stat.bonusEffect.val;
                }
            }
        }

        return Math.max(0, finalCost);
    }
}

