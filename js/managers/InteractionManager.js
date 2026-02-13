// js/managers/InteractionManager.js

class InteractionManager {
    constructor(scene, ctx) {
        this.scene = scene;
        this.ctx = ctx || (scene && scene.ctx) || (typeof getGameContext === 'function' ? getGameContext() : null);
    }

    _getUnitStats() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.unitStats) ? this.ctx.unitStats : {};
    }

    _getSkillStats() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.skillStats) ? this.ctx.skillStats : {};
    }

    _hasInfiltrate(stats) {
        if (!stats || !Array.isArray(stats.traits)) return false;
        return (
            stats.traits.includes('Infiltrate') ||
            stats.traits.includes('침투') ||
            stats.traits.includes('移⑦닾')
        );
    }

    _getRules() {
        if (this.scene && typeof this.scene._getRules === 'function') {
            return this.scene._getRules();
        }
        return {
            TILES: { EMPTY: 0, BLOCKED: 1, DEPLOY: 2, WATCH: 3, OUTFIELD: 4 }
        };
    }

    handleMapClick(pointer) {
        if (this.scene.isPlaying) return;
        const selectedIdx = this.scene.cardManager ? this.scene.cardManager.selectedCardIdx : -1;
        const isPlacingCard = (selectedIdx !== -1);
        if (!isPlacingCard) {
            // Cancel by marker click only when not placing a new card.
            if (this._tryCancelPlanAt(pointer.x, pointer.y)) return;
        }

        const tileX = Math.floor(pointer.x / this.scene.tileSize);
        const tileY = Math.floor(pointer.y / this.scene.tileSize);

        const rules = this._getRules();
        const T = rules.TILES;

        if (this.scene.isEditorMode) {
            if (this.scene.grid[tileY] && this.scene.grid[tileY][tileX] !== undefined) {
                const current = this.scene.grid[tileY][tileX];
                this.scene.grid[tileY][tileX] = (current + 1) % (T.OUTFIELD + 1);
                this.scene.drawEditorGrid();
            }
            return;
        }

        if (selectedIdx === -1) return;

        const card = this.scene.cardManager.hand[selectedIdx];
        if (!card || typeof card !== 'object') return;

        const type = card.type;
        const name = card.name;
        if (type !== 'Unit' && type !== 'Skill') return;

        const stat = (this.scene.getAdjustedStats && typeof this.scene.getAdjustedStats === 'function')
            ? this.scene.getAdjustedStats(type, name)
            : ((type === 'Unit') ? this._getUnitStats()[name] : this._getSkillStats()[name]);
        if (!stat) return;

        if (tileX < 0 || tileX >= this.scene.mapWidth || tileY < 0 || tileY >= this.scene.mapHeight) return;

        const tileVal = this.scene.grid[tileY][tileX];

        if (type === 'Unit') {
            const hasInfiltrate = this._hasInfiltrate(stat);
            if (tileVal === T.BLOCKED) return this.scene.showFloatingText(pointer.x, pointer.y, 'Blocked tile', '#ff0000');
            if (tileVal === T.WATCH) return this.scene.showFloatingText(pointer.x, pointer.y, 'Enemy watch zone', '#ff0000');
            if (tileVal !== T.DEPLOY && !hasInfiltrate) return this.scene.showFloatingText(pointer.x, pointer.y, 'Not a deploy tile', '#ff0000');
        } else {
            // Skill target placement
            if (tileVal === T.OUTFIELD) return this.scene.showFloatingText(pointer.x, pointer.y, 'Out of field', '#ff0000');
            if (tileVal === T.BLOCKED) return this.scene.showFloatingText(pointer.x, pointer.y, 'Invalid target tile', '#ff0000');
        }

        const realCost = (type === 'Unit' && this.scene.getRealTimeCost)
            ? this.scene.getRealTimeCost(name)
            : stat.cost;
        if (this.scene.playerCost < realCost) return this.scene.showFloatingText(pointer.x, pointer.y, 'Not enough cost', '#ff0000');

        const targetIdx = this.scene.cardManager.selectedCardIdx;
        this.scene.cardManager.selectedCardIdx = -1;
        this.drawDeploymentZones(false);

        this.scene.playerCost -= realCost;
        this.scene.updateCostUI();
        this.scene.cardManager.animateCardUse(targetIdx);

        const slider = document.getElementById('timeline-slider');
        const currentTime = slider ? (slider.value / 100).toFixed(1) : 0;

        const markerRadius = (type === 'Skill' && stat.radius) ? Math.max(12, Math.floor(stat.radius / 2)) : 15;
        const markerColor = (type === 'Skill') ? (stat.color || 0x66aaff) : (stat.color || 0x00ff00);
        const marker = this.scene.add.circle(pointer.x, pointer.y, markerRadius, markerColor);
        marker.setAlpha(0.5);

        const offsets = (type === 'Unit')
            ? GameLogic.getSpawnOffsets(stat.count || 1, 30)
            : [];

        const plan = {
            type,
            name,
            x: pointer.x,
            y: pointer.y,
            time: parseFloat(currentTime),
            spawned: false,
            visualMarker: marker,
            offsets,
            paidCost: realCost
        };

        marker.setInteractive({ cursor: 'pointer' });
        marker.on('pointerdown', () => {
            if (this.scene.cardManager && this.scene.cardManager.selectedCardIdx !== -1) return;
            this.cancelDeployment(plan);
        });

        this.scene.deployedObjects.push(plan);
        if (this.scene && typeof this.scene._traceEvent === 'function') {
            this.scene._traceEvent('plan_add', {
                type: plan.type,
                name: plan.name,
                x: Math.round(plan.x),
                y: Math.round(plan.y),
                at: +plan.time.toFixed(2),
                cost: plan.paidCost
            });
        }
        this.scene.updateGhostSimulation();
    }

    _tryCancelPlanAt(x, y) {
        const plans = this.scene.deployedObjects || [];
        for (let i = plans.length - 1; i >= 0; i--) {
            const plan = plans[i];
            if (!plan || plan.spawned) continue;
            const marker = plan.visualMarker;
            if (!marker) continue;

            const radius = ((marker.radius || 15) * Math.max(marker.scaleX || 1, marker.scaleY || 1)) + 6;
            const dist = Phaser.Math.Distance.Between(x, y, marker.x, marker.y);
            if (dist <= radius) {
                this.cancelDeployment(plan);
                return true;
            }
        }
        return false;
    }

    drawDeploymentZones(shouldDraw) {
        const rules = this._getRules();
        const T = rules.TILES;

        this.scene.fieldGraphics.clear();
        this.scene.fieldGraphics.setVisible(false);

        if (this.scene.isEditorMode || this.scene.isPlaying || !shouldDraw || this.scene.cardManager.selectedCardIdx === -1) {
            return;
        }

        const card = this.scene.cardManager.hand[this.scene.cardManager.selectedCardIdx];
        if (!card || typeof card !== 'object') return;

        const type = card.type;
        const name = card.name;
        if (type !== 'Unit' && type !== 'Skill') return;

        const stats = this.scene.getAdjustedStats(type, name);
        if (!stats) return;

        this.scene.fieldGraphics.setVisible(true);
        this.scene.fieldGraphics.fillStyle(type === 'Skill' ? 0x66aaff : 0x00ff00, 0.3);

        for (let y = 0; y < this.scene.mapHeight; y++) {
            for (let x = 0; x < this.scene.mapWidth; x++) {
                const tileVal = (this.scene.grid[y] && this.scene.grid[y][x] !== undefined) ? this.scene.grid[y][x] : 1;
                let isDrawable = false;

                if (type === 'Skill') {
                    if (tileVal !== T.BLOCKED && tileVal !== T.OUTFIELD) isDrawable = true;
                } else {
                    const hasInfiltrate = this._hasInfiltrate(stats);
                    if (hasInfiltrate) {
                        if (tileVal !== T.BLOCKED && tileVal !== T.WATCH && tileVal !== T.OUTFIELD) isDrawable = true;
                    } else if (tileVal === T.DEPLOY) {
                        isDrawable = true;
                    }
                }

                if (isDrawable) {
                    this.scene.fieldGraphics.fillRect(
                        x * this.scene.tileSize,
                        y * this.scene.tileSize,
                        this.scene.tileSize,
                        this.scene.tileSize
                    );
                }
            }
        }
    }

    cancelDeployment(plan) {
        if (this.scene.isPlaying) return;

        const cardObj = { type: plan.type, name: plan.name };
        const refundAmount = (plan.paidCost !== undefined)
            ? plan.paidCost
            : ((this._getUnitStats()[plan.name] && this._getUnitStats()[plan.name].cost) || 0);

        this.scene.playerCost += refundAmount;
        this.scene.updateCostUI();

        this.scene.cardManager.hand.push(cardObj);
        this.scene.cardManager.renderHand();

        if (plan.visualMarker) plan.visualMarker.destroy();
        if (plan.visualText) plan.visualText.destroy();

        const index = this.scene.deployedObjects.indexOf(plan);
        if (index > -1) this.scene.deployedObjects.splice(index, 1);
        if (this.scene && typeof this.scene._traceEvent === 'function') {
            this.scene._traceEvent('plan_cancel', {
                type: plan.type,
                name: plan.name,
                at: +plan.time.toFixed(2),
                refund: refundAmount
            });
        }

        this.scene.updateGhostSimulation();
    }

    resetAllPlans() {
        if (this.scene.isPlaying || this.scene.deployedObjects.length === 0) return;

        this.scene.showPopup(
            'Reset plans',
            'Cancel all current deployment plans?',
            () => {
                for (let i = this.scene.deployedObjects.length - 1; i >= 0; i--) {
                    this.cancelDeployment(this.scene.deployedObjects[i]);
                }
                this.scene.predictionGraphics.clear();
            },
            true
        );
    }
}
