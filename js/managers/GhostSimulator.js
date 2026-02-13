// js/managers/GhostSimulator.js

class GhostSimulator {
    constructor(ctx) {
        this.ctx = ctx || (typeof getGameContext === 'function' ? getGameContext() : null);
        this.stepTime = 0.05;
        this.mapGrid = null; 
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

    _getCcRules() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.ccRules) ? this.ctx.ccRules : {};
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

    _getArtifactData() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.artifactData) ? this.ctx.artifactData : {};
    }

    _getEffectiveSkillStats(plan) {
        const base = this._getSkillStats()[plan.name];
        if (!base) return null;

        const stats = JSON.parse(JSON.stringify(base));
        if (!stats.bonusTime || !stats.bonusEffect) return stats;

        const [start, end] = stats.bonusTime;
        const time = (typeof plan.time === 'number') ? plan.time : 0;
        if (time < start || time > end) return stats;

        const effect = stats.bonusEffect;
        const key = effect.stat;
        const val = effect.val;
        if (!key) return stats;

        if (typeof val === 'number') {
            stats[key] = (typeof stats[key] === 'number' ? stats[key] : 0) + val;
        } else if (key === 'cc' && val && typeof val === 'object') {
            stats.cc = { ...(stats.cc || {}), ...val };
        }

        return stats;
    }
    
    // 객체 깊은 복사 (traits 배열 포함)
    fastCloneStats(stats) {
        const newStats = Object.assign({}, stats);
        if (Array.isArray(stats.traits)) {
            newStats.traits = [...stats.traits];
        }
        return newStats;
    }

    run(targetTime, allyPlans, enemyPlans, currentUnits, mapContext) {
        const stepTime = (mapContext && typeof mapContext.simStepTime === 'number' && mapContext.simStepTime > 0)
            ? mapContext.simStepTime
            : this.stepTime;

        // [1] 배치 마커 가시성 제어 (여기에 추가!)
        // 슬라이더 시간(targetTime)과 배치 시간(plan.time)을 비교해 마커를 숨기거나 보여줍니다.
        if (allyPlans) {
            allyPlans.forEach(plan => {
                if (!plan || plan.spawned) return;
                const isFuture = (targetTime < plan.time);

                if (plan.visualMarker) {
                    // Keep marker visible even after time so user can cancel by clicking it.
                    plan.visualMarker.setVisible(true);
                    plan.visualMarker.setAlpha(isFuture ? 0.5 : 0.2);
                }

                if (plan.visualText) {
                    plan.visualText.setVisible(true);
                    plan.visualText.setAlpha(isFuture ? 1.0 : 0.45);
                }
            });
        }
        // 1. 맵 데이터 가져오기
        if (!this.mapGrid) {
            const scene = window.game?.scene?.getScene('BattleScene') || window.game?.scene?.getScene('MapScene');
            if (scene && scene.mapData) {
                this.mapGrid = scene.mapData;
            }
        }

        // 2. 유물 데이터 가져오기
        this.artifacts = [];
        const data = this._getGameData();
        if (data && data.artifacts) {
            this.artifacts = data.artifacts;
        }
        this.turretCooldown = (mapContext && typeof mapContext.turretCooldown === 'number')
            ? mapContext.turretCooldown
            : 0;
        this.commanderCooldown = (mapContext && typeof mapContext.commanderCooldown === 'number')
            ? mapContext.commanderCooldown
            : 0;

        let ghosts = currentUnits.map(u => this.cloneUnit(u));

        const taggedAlly = allyPlans.map(p => ({...p, team: 'ALLY'}));
        const taggedEnemy = enemyPlans.map(p => ({...p, team: 'ENEMY'}));

        const allPlans = [...taggedAlly, ...taggedEnemy]
            .map(p => ({ ...p, executed: false })) 
            .sort((a, b) => a.time - b.time);

        // 지연된 액션(투사체 등) 목록
        let delayedActions = []; 
        if (mapContext && typeof mapContext === 'object') {
            mapContext.delayedActions = delayedActions;
        }

        let simTime = 0; 
        
        // 경로 기록 타이머
        let logTimer = 0;
        const LOG_INTERVAL = 0.2; 

        // ★ [핵심 수정] while 루프 시작
        while (simTime < targetTime) {
            const dt = Math.min(stepTime, targetTime - simTime);
            simTime += dt;
            
            // 1. 계획 실행
            this.processPlans(simTime, allPlans, ghosts, mapContext);
            

            this.processArtifactUpdates(dt, ghosts);
            this.updateGhosts(ghosts, dt, mapContext, simTime, delayedActions);
            this.processDelayedActions(simTime, dt, delayedActions, ghosts);
            this.processCommanderSkill(dt, ghosts, mapContext);


            if (mapContext.easystar) {
                mapContext.easystar.calculate();
            }

            // 4. 경로 기록
            logTimer += dt;
            if (logTimer >= LOG_INTERVAL) {
                logTimer = 0;
                ghosts.forEach(g => {
                    if (g.active && g.isSpawned && !g.isBase) {
                        g.pathLogs.push({ x: g.x, y: g.y });
                    }
                });
            }

            // 5. 기지 파괴 체크 (★ 반드시 while 루프 안에 있어야 함!)
            const allyBase = ghosts.find(g => g.isBase && g.team === 'ALLY');
            const enemyBase = ghosts.find(g => g.isBase && g.team === 'ENEMY');

            if ((allyBase && !allyBase.active) || (enemyBase && !enemyBase.active)) {
                break; // 기지가 파괴되면 시뮬레이션 종료
            }
        } // ★ while 루프 종료

        return ghosts;
    }

    cloneUnit(realUnit) {
        return {
            name: realUnit.name,
            x: realUnit.x,
            y: realUnit.y,
            team: realUnit.team,
            stats: this.fastCloneStats(realUnit.stats),
            currentHp: realUnit.currentHp,
            active: true,
            isSpawned: true, 
            isStealthed: realUnit.isStealthed || false,
            isBase: realUnit.isBase || false,
            stunTimer: realUnit.stunTimer || 0,
            statusEffects: (realUnit.statusEffects && typeof realUnit.statusEffects === 'object')
                ? { ...realUnit.statusEffects }
                : {},
            attackCooldown: realUnit.attackCooldown || 0,
            isCasting: false,
            castTimer: 0,
            pathTimer: 0, 
            pathLogs: [],
            path: [],
// ★ [복제] 실제 유닛이 보너스 상태였다면 복제 (없으면 false)
            isBonus: realUnit.isBonus || false
        };
    }
processPlans(simTime, plans, ghosts, mapContext) {
        plans.forEach(plan => {
            if (!plan.executed && plan.time <= simTime) {
                plan.executed = true;

                if (plan.type === 'Unit') {
                    let stats = null;
                    if (plan.stats) stats = plan.stats;
                    if (!stats) stats = this._getUnitStats()[plan.name];
                    
                    if (stats) {
                        // ★ [수정] 보너스 타임 계산 및 적용
                        let finalStats = this.fastCloneStats(stats);
                        let isBonus = false;

                        // BattleScene과 동일한 로직 적용
                        if (stats.bonusTime && stats.bonusEffect) {
                            const [start, end] = stats.bonusTime;
                            // plan.time: 배치 예정 시간
                            if (plan.time >= start && plan.time <= end) {
                                const effect = stats.bonusEffect;
                                if (effect.unit === '%') {
                                    finalStats[effect.stat] = Math.floor(finalStats[effect.stat] * (1 + effect.val / 100));
                                } else {
                                    finalStats[effect.stat] += effect.val;
                                }
                                isBonus = true; // 보너스 적용됨 표시
                            }
                        }

                        const count = stats.count || 1;
                        for(let i=0; i<count; i++) {
                            const offsetX = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].x : 0;
                            const offsetY = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].y : 0;

                            ghosts.push({
                                name: plan.name,
                                x: plan.x + offsetX,
                                y: plan.y + offsetY,
                                team: plan.team, 
                                stats: finalStats, // 강화된 스탯 사용
                                currentHp: finalStats.hp,
                                active: true,
                                isSpawned: true,
                                attackCooldown: 0,
                                stunTimer: 0,
                                statusEffects: {},
                                isCasting: false,
                                castTimer: 0,
                                pathTimer: 0,
                                pathLogs: [],
                                path: [],
                                isBonus: isBonus // ★ 시각 처리를 위한 플래그 전달
                            });
                        }
                    }
                } 
                else if (plan.type === 'Skill') {
                    this.applySkillSimulation(plan, ghosts, simTime, mapContext);
                }
            }
        });
    }
    
    applySkillSimulation(plan, ghosts, simTime, mapContext = null) {
        const stats = this._getEffectiveSkillStats(plan);
        if (!stats) return;
        const simSpeed = (mapContext && typeof mapContext.timeSpeed === 'number' && mapContext.timeSpeed > 0)
            ? mapContext.timeSpeed
            : 1.0;
        const impactDelay = 0.4 * simSpeed; // setTimeout(400ms) in real-time -> scaled in battleTime by timeSpeed.
        const hostileTeam = (plan.team === 'ALLY') ? 'ENEMY' : 'ALLY';
        const queue = (mapContext && Array.isArray(mapContext.delayedActions))
            ? mapContext.delayedActions
            : null;

        if (!queue) {
            // Fallback for callers without delayed action queue.
            this.resolveSkillImpact(plan, stats, hostileTeam, ghosts);
            return;
        }

        queue.push({
            type: 'skill_impact',
            hitTime: simTime + impactDelay,
            plan,
            hostileTeam,
            stats
        });
    }

    resolveSkillImpact(plan, stats, hostileTeam, ghosts) {
        ghosts.forEach(ghost => {
            if (!ghost.active) return;
            const dist = Phaser.Math.Distance.Between(plan.x, plan.y, ghost.x, ghost.y);
            if (dist > (stats.radius || 0)) return;
            if (!stats.friendlyFire && ghost.team !== hostileTeam) return;

            if (stats.damage > 0) {
                ghost.currentHp -= stats.damage;
                this.checkDeath(ghost, ghosts);
            }
            if (stats.shield > 0 && ghost.active) {
                ghost.currentHp = Math.min((ghost.currentHp || 0) + stats.shield, ghost.stats.hp);
            }
            if (stats.stun > 0 && ghost.active) {
                ghost.stunTimer += stats.stun;
                ghost.statusEffects = ghost.statusEffects || {};
                ghost.statusEffects.STUN = Math.max(ghost.statusEffects.STUN || 0, stats.stun);
                if (ghost.isCasting) {
                    ghost.isCasting = false;
                    ghost.castTimer = 0;
                }
            }
            if (stats.cc && ghost.active) {
                ghost.statusEffects = ghost.statusEffects || {};
                for (const [type, duration] of Object.entries(stats.cc)) {
                    if (typeof duration !== 'number' || duration <= 0) continue;
                    ghost.statusEffects[type] = Math.max(ghost.statusEffects[type] || 0, duration);
                }
            }
        });
    }

    updateGhosts(ghosts, dt, mapContext, simTime, delayedActions) {
        ghosts.forEach(ghost => {
            if (!ghost || !ghost.active) return;

            ghost.statusEffects = ghost.statusEffects || {};
            // Backward-compat for old stun field on snapshot objects.
            if (ghost.stunTimer && ghost.stunTimer > 0) {
                ghost.statusEffects.STUN = Math.max(ghost.statusEffects.STUN || 0, ghost.stunTimer);
                ghost.stunTimer = Math.max(0, ghost.stunTimer - dt);
            }
            if (typeof ghost.checkCC !== 'function') {
                ghost.checkCC = () => this.getGhostCcState(ghost);
            }

            GameLogic.runUnitLogic(
                ghost,
                ghosts,
                dt,
                mapContext.grid,
                mapContext.tileSize,
                mapContext.easystar,
                true
            );

            if (ghost._simAttackTarget) {
                this.executeAttack(ghost, ghosts, ghost._simAttackTarget, simTime, delayedActions);
                ghost._simAttackTarget = null;
            }
        });
    }


    findNearestTargetGhost(me, ghosts) {
        let nearest = null;
        let minDist = Infinity;
        ghosts.forEach(other => {
            if (!other.active || !other.isSpawned) return;
            if (other.currentHp <= 0) return;
            if (other.team === me.team) return;
            if (other.isStealthed) return;
            const d = Phaser.Math.Distance.Between(me.x, me.y, other.x, other.y);
            if (d < minDist) {
                minDist = d;
                nearest = other;
            }
        });
        return nearest;
    }

    findInjuredAllyGhost(me, ghosts) {
        let nearest = null;
        let minDist = Infinity;
        ghosts.forEach(other => {
            if (!other.active || !other.isSpawned) return;
            if (other.currentHp <= 0) return;
            if (other.team !== me.team) return;
            if (other === me) return;
            if (other.currentHp >= other.stats.hp) return;
            if (other.isBase) return;
            const d = Phaser.Math.Distance.Between(me.x, me.y, other.x, other.y);
            if (d < minDist) {
                minDist = d;
                nearest = other;
            }
        });
        return nearest;
    }

    getGhostCcState(ghost) {
        const ccRules = this._getCcRules();
        const result = { canMove: true, canAttack: true, cancelCast: false };
        const effects = ghost.statusEffects || {};

        for (const type of Object.keys(effects)) {
            const rule = ccRules[type];
            if (!rule) continue;
            if (rule.canMove === false) result.canMove = false;
            if (rule.canAttack === false) result.canAttack = false;
            if (rule.cancelCast) result.cancelCast = true;
        }
        return result;
    }
    
    processDelayedActions(simTime, dt, delayedActions, allGhosts) {
        for (let i = delayedActions.length - 1; i >= 0; i--) {
            const action = delayedActions[i];
            if (action.type === 'projectile') {
                if (action.target && action.target.active && action.target.currentHp > 0) {
                    action.lastX = action.target.x;
                    action.lastY = action.target.y;
                }

                const angle = Phaser.Math.Angle.Between(action.x, action.y, action.lastX, action.lastY);
                action.x += Math.cos(angle) * action.speed * dt;
                action.y += Math.sin(angle) * action.speed * dt;

                const dist = Phaser.Math.Distance.Between(action.x, action.y, action.lastX, action.lastY);
                if (dist < 20) {
                    if (action.target && action.target.active && action.target.currentHp > 0) {
                        this.applyDamage(action.attacker, action.target, action.damage, allGhosts);
                    }
                    delayedActions.splice(i, 1);
                }
                continue;
            }

            if (action.type === 'skill_impact') {
                if (simTime >= action.hitTime) {
                    this.resolveSkillImpact(action.plan, action.stats, action.hostileTeam, allGhosts);
                    delayedActions.splice(i, 1);
                }
                continue;
            }

            if (simTime >= action.hitTime) {
                if (action.target && action.target.active) {
                    this.applyDamage(action.attacker, action.target, action.damage, allGhosts);
                }
                delayedActions.splice(i, 1);
            }
        }
    }

    processArtifactUpdates(dt, allGhosts) {
        if (!this.hasArtifact('turret')) return;
        const artifactData = this._getArtifactData();
        const turret = artifactData.turret || { val: 15, cooldown: 5.0, range: 600 };
        this.turretCooldown -= dt;
        if (this.turretCooldown > 0) return;

        const allyBase = allGhosts.find(g => g.active && g.isBase && g.team === 'ALLY');
        if (!allyBase) {
            this.turretCooldown = turret.cooldown || 5.0;
            return;
        }

        let target = null;
        let minDist = Infinity;
        allGhosts.forEach(g => {
            if (!g.active || g.team !== 'ENEMY') return;
            if (g.isStealthed) return;
            const d = Phaser.Math.Distance.Between(allyBase.x, allyBase.y, g.x, g.y);
            if (d <= (turret.range || 600) && d < minDist) {
                minDist = d;
                target = g;
            }
        });

        if (target) {
            this.applyDamage({ team: 'ALLY' }, target, turret.val || 15, allGhosts);
        }
        this.turretCooldown = turret.cooldown || 5.0;
    }

    processCommanderSkill(dt, allGhosts, mapContext) {
        const commanders = this._getCommanders();
        const cmd = commanders[this._getSelectedCommander()];
        if (!cmd || cmd.type !== 'ACTIVE_ATK') return;

        if (this.commanderCooldown > 0) {
            this.commanderCooldown -= dt;
            return;
        }

        const originX = 100;
        const originY = mapContext && mapContext.height ? (mapContext.height / 2) : 360;
        let nearest = null;
        let minDist = Infinity;
        allGhosts.forEach(g => {
            if (!g.active || g.team !== 'ENEMY' || g.isStealthed) return;
            const d = Phaser.Math.Distance.Between(originX, originY, g.x, g.y);
            if (d < minDist) {
                minDist = d;
                nearest = g;
            }
        });

        if (nearest) {
            this.applyDamage({ team: 'ALLY' }, nearest, cmd.damage || 0, allGhosts);
            this.commanderCooldown = cmd.cooldown || 0;
        }
    }

    executeAttack(attacker, allGhosts, target = null, simTime = 0, delayedActions = []) {
        if (!target || !target.active) {
            target = this.findNearestTargetGhost(attacker, allGhosts);
        }

        if (target && target.active) {
            // Real battle does not re-check range at hit/cast-complete time.
            // If attack was started, it resolves on the locked target if still active.
            const damage = attacker.stats.damage || 10;
            const isProjectile = ((attacker.stats.attackType || 'SINGLE') === 'SHOOT');
            const attackType = attacker.stats.attackType || 'SINGLE';
            const projSpeed = attacker.stats.projectileSpeed || 300;

            if (target.team === attacker.team && !isProjectile) {
                target.currentHp = Math.min(target.currentHp + damage, target.stats.hp);
                return;
            }

            if (isProjectile) {
                delayedActions.push({
                    type: 'projectile',
                    x: attacker.x,
                    y: attacker.y,
                    lastX: target.x,
                    lastY: target.y,
                    speed: projSpeed,
                    attacker: attacker,
                    target: target,
                    damage: damage
                });
            } else {
                // Match CombatManager SPLASH behavior: hit main target first, then fan-shaped AoE.
                this.applyDamage(attacker, target, damage, allGhosts);
                this.onDealDamageArtifacts(attacker, target, damage, allGhosts);

                if (attackType === 'SPLASH') {
                    const radius = attacker.stats.splashRadius || 80;
                    const angleVal = attacker.stats.splashAngle || 120;
                    const fanAngleRad = Phaser.Math.DegToRad(angleVal);
                    const mainAngle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);

                    allGhosts.forEach(other => {
                        if (!other.active) return;
                        if (other.team === attacker.team) return;
                        if (other === target) return;
                        if (other.isStealthed) return;

                        const d = Phaser.Math.Distance.Between(attacker.x, attacker.y, other.x, other.y);
                        if (d > ((attacker.stats.range || 0) + radius)) return;

                        const a = Phaser.Math.Angle.Between(attacker.x, attacker.y, other.x, other.y);
                        if (Math.abs(Phaser.Math.Angle.Wrap(a - mainAngle)) <= (fanAngleRad / 2)) {
                            this.applyDamage(attacker, other, damage, allGhosts);
                            this.onDealDamageArtifacts(attacker, other, damage, allGhosts);
                        }
                    });
                }
            }
        }
    }

    applyDamage(attacker, target, damage, allGhosts) {
        target.currentHp -= damage;

        this.checkDeath(target, allGhosts);
    }

    onDealDamageArtifacts(attacker, target, damageAmount, allGhosts) {
        const artifactData = this._getArtifactData();
        if (this.hasArtifact('vampire') && attacker && attacker.team === 'ALLY') {
            const val = (artifactData.vampire && typeof artifactData.vampire.val === 'number') ? artifactData.vampire.val : 0.2;
            const heal = Math.floor(damageAmount * val);
            if (heal > 0) attacker.currentHp = Math.min(attacker.currentHp + heal, attacker.stats.hp);
        }

        if (this.hasArtifact('thorn') && target && target.team === 'ALLY') {
            const val = (artifactData.thorn && typeof artifactData.thorn.val === 'number') ? artifactData.thorn.val : 5;
            const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
            if (dist <= 60) {
                this.applyDamage({ team: target.team }, attacker, val, allGhosts);
            }
        }
    }

    checkDeath(unit, allGhosts) {
        if (unit.currentHp <= 0) {
            unit.active = false;
            unit.currentHp = 0;

            if (unit.team === 'ALLY') {
                const race = (unit.stats && unit.stats.race) ? unit.stats.race : '';
                if (this.hasArtifact('gunpowder') && race === 'soldier') {
                    const artifactData = this._getArtifactData();
                    const radius = (artifactData.gunpowder && artifactData.gunpowder.radius) ? artifactData.gunpowder.radius : 50;
                    const damage = (artifactData.gunpowder && artifactData.gunpowder.val) ? artifactData.gunpowder.val : 30;
                    this.triggerExplosion(unit.x, unit.y, radius, damage, 'ENEMY', allGhosts);
                }
            }
        }
    }

    hasArtifact(id) {
        return this.artifacts && this.artifacts.includes(id);
    }

    triggerExplosion(x, y, radius, damage, targetTeam, allGhosts) {
        allGhosts.forEach(g => {
            if (g.active && g.team === targetTeam) {
                const dist = Phaser.Math.Distance.Between(x, y, g.x, g.y);
                if (dist <= radius) {
                    g.currentHp -= damage;
                    if (g.currentHp <= 0) {
                        g.active = false;
                        g.currentHp = 0;
                    }
                }
            }
        });
    }

    moveTowards(ghost, targetX, targetY, dt, mapContext = null) {
        const dx = targetX - ghost.x;
        const dy = targetY - ghost.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist <= ghost.stats.range - 5) return; 

        const speed = ghost.stats.speed;
        const moveDist = speed * dt;
        
        const angle = Math.atan2(dy, dx);
        let vx = Math.cos(angle) * moveDist;
        let vy = Math.sin(angle) * moveDist;

        const gridRef = (mapContext && mapContext.grid) ? mapContext.grid : this.mapGrid;
        const tileSize = (mapContext && mapContext.tileSize) ? mapContext.tileSize : 32;
        if (gridRef) {
            
            const nextX = ghost.x + vx;
            const nextY = ghost.y + vy;
            
            const gridX = Math.floor(nextX / tileSize);
            const gridY = Math.floor(nextY / tileSize);

            if (gridY >= 0 && gridY < gridRef.length && gridX >= 0 && gridX < gridRef[0].length) {
                if (gridRef[gridY][gridX] === 1) {
                    const gridX_only = Math.floor((ghost.x + vx) / tileSize);
                    const gridY_curr = Math.floor(ghost.y / tileSize);
                    
                    if (gridRef[gridY_curr][gridX_only] !== 1) {
                        vy = 0; 
                    } else {
                        const gridX_curr = Math.floor(ghost.x / tileSize);
                        const gridY_only = Math.floor((ghost.y + vy) / tileSize);
                        
                        if (gridRef[gridY_only][gridX_curr] !== 1) {
                            vx = 0; 
                        } else {
                            vx = 0;
                            vy = 0;
                        }
                    }
                }
            }
        }

        ghost.x += vx;
        ghost.y += vy;
    }
}
