// js/scenes/MapScene.js

class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    _t(key, params) {
        return (typeof window.t === 'function') ? window.t(key, params) : key;
    }

    create() {
        this.ctx = (typeof getGameContext === 'function') ? getGameContext() : null;

        const uiIds = ['timeline-slider', 'hand-container', 'ui-top-bar', 'ui-bottom-bar'];
        uiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });


        this.selectedNode = null; 
        this.isProcessing = false;
        


        this.nodeMap = {}; 


        const data = this._getGameData();
        const mapW = data.campaign.mapWidth;
        const mapH = data.campaign.mapHeight;
        
        this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.physics.world.setBounds(0, 0, mapW, mapH);
        this.cameras.main.setBackgroundColor('#1a1a1a'); 
        this.artifactManager = new ArtifactManager(this, this.ctx || (typeof getGameContext === 'function' ? getGameContext() : null));
        this.artifactManager.init(); // load existing artifacts
        this.artifactManager.updateUI();



        if (this.textures.exists('bg_path')) {
            const bg = this.add.tileSprite(mapW/2, mapH/2, mapW, mapH, 'bg_path');
            bg.setScrollFactor(0.5);
            bg.setAlpha(0.1);
        }


        const zoomRatio = this.scale.width / mapW;
        this.cameras.main.setZoom(Math.max(zoomRatio * 0.9, 0.5));
        this.cameras.main.centerOn(mapW / 2, mapH / 2);



        this.bgEffectGraphics = this.add.graphics().setDepth(0);

        this.lineGraphics = this.add.graphics().setDepth(1);

        this.previewGraphics = this.add.graphics().setDepth(2);
        

        this.deadlineLine = this.add.rectangle(data.campaign.deadlineX, mapH/2, 4, mapH, 0xff0000).setOrigin(1, 0.5).setDepth(3);
        this.deadlineOverlay = this.add.rectangle(data.campaign.deadlineX - mapW/2, mapH/2, mapW, mapH, 0xff0000, 0.1).setOrigin(1, 0.5).setDepth(3);


        this.nodeContainer = this.add.container(0, 0).setDepth(10);


        this.infoText = this.add.text(20, 20, '', { 
            fontSize: '20px', fill: '#eeeeee', backgroundColor: '#000000cc', padding: {x:15, y:10} 
        }).setScrollFactor(0).setDepth(100);


        this.drawMap();


        this.input.on('pointermove', (p) => {
            if (!p.isDown) return;
            this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
        });
        
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const newZoom = this.cameras.main.zoom - deltaY * 0.001;
            this.cameras.main.zoom = Phaser.Math.Clamp(newZoom, 0.3, 2.0);
        });


        this.actionBtnContainer = this.add.container(this.scale.width / 2, this.scale.height * 0.85).setScrollFactor(0).setDepth(100);
        this.createActionButtonUI(); 
        this.createPlayerMarker();
        this.updateUI(); 
    }

    _getGameData() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        if (this.ctx && this.ctx.data) return this.ctx.data;
        throw new Error('Game data not available in context');
    }

    _getRules() {
        const constants = (this.ctx && this.ctx.constants) ? this.ctx.constants : {};
        return {
            DEBUG_LOGS: !!constants.DEBUG_LOGS
        };
    }

    _debugLog(...args) {
        if (!this._getRules().DEBUG_LOGS) return;
        console.log(...args);
    }



createActionButtonUI() {
    const bg = this.add.rectangle(0, 0, 320, 60, 0x222222);
    bg.setStrokeStyle(2, 0x888888);
    bg.name = 'btn_bg'; 

    const text = this.add.text(0, 0, this._t('map.actionButton'), {
        fontSize: '20px', fontStyle: 'bold', color: '#fff' 
    }).setOrigin(0.5);
    text.name = 'btn_text';

    this.actionBtnContainer.add([bg, text]);



    const hitArea = new Phaser.Geom.Rectangle(-160, -30, 320, 60);
    this.actionBtnContainer.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);


    this.actionBtnContainer.on('pointerdown', () => {

        if (this.isProcessing) return;

        this.tweens.add({
            targets: this.actionBtnContainer, 
            scale: 0.95, 
            duration: 50, 
            yoyo: true,
            onComplete: () => this.handleActionClick()
        });
    });
}


    createPlayerMarker() {

        this.playerMarker = this.add.container(0, 0).setDepth(20);


        const pin = this.add.graphics();
        pin.fillStyle(0x00ff00, 1);
        pin.fillTriangle(-8, -15, 8, -15, 0, 0);
        pin.fillCircle(0, -20, 8);
        

        const text = this.add.text(0, -20, this._t('map.playerMarker'), {
            fontSize: '10px', fontStyle: 'bold', color: '#000'
        }).setOrigin(0.5);


        const pulse = this.add.circle(0, 0, 10);
        pulse.setStrokeStyle(2, 0x00ff00);
        
        this.playerMarker.add([pulse, pin, text]);


        this.tweens.add({
            targets: [pin, text],
            y: '-=10',
            duration: 800,
            yoyo: true,
            repeat: -1, // 臾댄븳 諛섎났
            ease: 'Sine.easeInOut'
        });


        this.tweens.add({
            targets: pulse,
            scale: 3.0,
            alpha: 0,
            duration: 1500,
            repeat: -1
        });


        const data = this._getGameData();
        const currId = data.campaign.currentNodeId;
        const currNode = data.getNode(currId);
        if (currNode) {
            this.playerMarker.setPosition(currNode.x, currNode.y);
        }
    }
    updateActionButton() {
        const data = this._getGameData();
        const currId = data.campaign.currentNodeId;
        const currNode = data.getNode(currId);
        
        const bg = this.actionBtnContainer.getByName('btn_bg');
        const text = this.actionBtnContainer.getByName('btn_text');

        if (this.selectedNode) {

            const dist = Math.floor(Phaser.Math.Distance.Between(currNode.x, currNode.y, this.selectedNode.x, this.selectedNode.y));
            text.setText(this._t('map.move', { dist }));
            bg.fillColor = 0x2e7d32; 
            bg.setStrokeStyle(2, 0x4caf50);
        } else {


            const isResting = (currNode.type === 'EMPTY' || currNode.type === 'START');
            
            if (isResting) {
                text.setText(this._t('map.selectTarget'));
                bg.fillColor = 0x444444;
                bg.setStrokeStyle(2, 0x888888);
            } else {

                let label = this._t('map.idle');
                let color = 0x333333;
                let stroke = 0x666666;

                if (currNode.type === 'BATTLE') { label = this._t('map.enterBattle'); color = 0x7f0000; stroke = 0xff5555; }
                else if (currNode.type === 'ELITE') { label = this._t('map.enterElite'); color = 0x4a148c; stroke = 0xaa00ff; }
                else if (currNode.type === 'BOSS') { label = this._t('map.enterBoss'); color = 0x3e2723; stroke = 0xff5722; }
                else if (currNode.type === 'SHOP') { label = this._t('map.enterShop'); color = 0xff6f00; stroke = 0xffb300; }
                else if (currNode.type === 'EVENT') { label = this._t('map.enterEvent'); color = 0x01579b; stroke = 0x03a9f4; }

                text.setText(label);
                bg.fillColor = color;
                bg.setStrokeStyle(2, stroke);
            }
        }
    }
handleActionClick() {

    if (this.isProcessing) return;


    if (this.selectedNode) {
        const target = this.selectedNode;

        

        this.isProcessing = true; 


        const data = this._getGameData();
        const success = data.moveToNode(target.id);

        if (success) {
            this._debugLog(`[Map] move start -> node ${target.id}`);
            

            this.tweens.add({
                targets: [this.deadlineLine, this.deadlineOverlay],
                x: data.campaign.deadlineX,
                duration: 800,
                ease: 'Cubic.Out',
                onUpdate: () => { this.deadlineOverlay.x = this.deadlineLine.x; }
            });
            if (this.playerMarker) {
        this.tweens.add({
            targets: this.playerMarker,
            x: target.x,
            y: target.y,
            duration: 800,
            ease: 'Power2'
        });
    }
            

            this.cameras.main.pan(target.x, target.y, 800, 'Power2');
            

            this.time.delayedCall(800, () => {
                this.isProcessing = false;
                

                this.selectedNode = null; 
                

                this.previewGraphics.clear();


                this.updateUI(); 
                this.drawMap();
                
                this._debugLog('[Map] move complete, waiting for enter action');
            });
        } else {

            this.isProcessing = false;
            console.warn(this._t('map.moveFailed'));
            this.infoText.setText(this._t('map.notConnected'));
            this.infoText.setColor('#ff5555');
            this.shakeUI(this.actionBtnContainer);
        }
        return;
    }


    const data = this._getGameData();
    const currNode = data.getNode(data.campaign.currentNodeId);
    
    if (!currNode) {
        this.scene.restart();
        return;
    }

    const nonEnterableTypes = ['START', 'EMPTY']; 
    
    if (!nonEnterableTypes.includes(currNode.type)) {

        this._debugLog('[Map] trying to enter current node');
        this.enterNode(currNode);
    } else {

        this._debugLog('[Map] enter blocked, movement required');
        this.infoText.setText(this._t('map.selectAdjacent'));
        this.infoText.setColor('#ff5555');
        this.shakeUI(this.actionBtnContainer);
    }
}


    enterNode(node) {
        this._debugLog(`[Map] enter node type=${node.type}`);

        if (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS') {
            this.scene.start('BattleScene', { isElite: node.type === 'ELITE', isBoss: node.type === 'BOSS' });
        } 
        else if (node.type === 'SHOP') {
            this.scene.start('ShopScene');
        } 
        else if (node.type === 'EVENT') {
            if (typeof EventManager !== 'undefined') {
                EventManager.playRandomEvent(this);
            } else {
                console.error(this._t('map.eventLoadFail'));
            }
        } 
    }

    handleNodeClick(targetNode) {
        if (this.isProcessing) return;

        const currId = this._getGameData().campaign.currentNodeId;
        

        if (targetNode.id === currId) {
            this.selectedNode = null;
            this.previewGraphics.clear();
            this.updateUI();
            this.drawMap();
            return;
        }

        this.selectedNode = targetNode;
        this.drawPreview(targetNode);
        this.updateActionButton();
        this.drawMap();
    }

    drawMap() {
        const data = this._getGameData();
        const nodes = data.campaign.nodes;
        const edges = data.campaign.edges;
        const currId = data.campaign.currentNodeId;


        this.lineGraphics.clear();
        this.lineGraphics.lineStyle(1, 0x444444, 0.5); 
        edges.forEach(edge => {
            const n1 = nodes.find(n => n.id === edge.from);
            const n2 = nodes.find(n => n.id === edge.to);
            if (n1 && n2) this.lineGraphics.lineBetween(n1.x, n1.y, n2.x, n2.y);
        });


        nodes.forEach(node => {
            let circle = this.nodeMap[node.id];
            

            let color = 0x888888;
            let radius = 10;
            let labelText = ''; 

            if (node.type === 'START') { color = 0x66bb6a; radius = 14; }
            else if (node.type === 'BOSS') { color = 0xe53935; radius = 18; labelText = 'B'; }
            else if (node.type === 'SHOP') { color = 0xffca28; labelText = 'S'; radius = 12; }
            else if (node.type === 'ELITE') { color = 0x8e24aa; labelText = '★'; radius = 12; }
            else if (node.type === 'EVENT') { color = 0x1e88e5; labelText = 'E'; radius = 12; }
            else if (node.type === 'BATTLE') { color = 0xeeeeee; radius = 8; }
            else if (node.type === 'EMPTY') { color = 0x333333; radius = 6; }


            if (!circle) {
                circle = this.add.circle(node.x, node.y, radius, color);
                circle.setInteractive({ cursor: 'pointer' });
                circle.on('pointerdown', () => this.handleNodeClick(node));
                

                if (labelText) {
                    const txt = this.add.text(node.x, node.y, labelText, { fontSize: '14px' }).setOrigin(0.5);
                    this.nodeContainer.add(txt);
                }
                
                this.nodeContainer.add(circle);
                this.nodeMap[node.id] = circle;
            }


            circle.setRadius(radius);
            circle.setFillStyle(color);


            if (node.id === currId) {

                circle.setStrokeStyle(2, 0xffffff);
            } else if (this.selectedNode && this.selectedNode.id === node.id) {

                circle.setRadius(radius + 2);
                circle.setStrokeStyle(2, 0xffd700);
            } else {

                circle.setStrokeStyle(0);
            }
        });
    }

    drawPreview(targetNode) {
        const data = this._getGameData();
        const currNode = data.getNode(data.campaign.currentNodeId);
        const dist = Phaser.Math.Distance.Between(currNode.x, currNode.y, targetNode.x, targetNode.y);
        const difficulty = 1.0 + (data.stage * 0.1);
        const advance = dist * difficulty * 0.8; 
        
        const futureX = data.campaign.deadlineX + advance;
        

        this.previewGraphics.clear();
        

        this.previewGraphics.fillStyle(0xff5555, 0.4);
        this.previewGraphics.fillRect(futureX - 2, 0, 4, data.campaign.mapHeight);


        this.previewGraphics.lineStyle(2, 0xffd700, 0.8);
        this.previewGraphics.lineBetween(currNode.x, currNode.y, targetNode.x, targetNode.y);

        this.infoText.setText(this._t('map.previewInfo', { dist: Math.floor(dist), risk: Math.floor(advance) }));
    }

    checkEvents(node) {
        const data = this._getGameData();
        if (data.checkGameOver()) {

            alert(this._t('map.deadlineGameOver'));
            data.startNewGame();
            this.scene.start('TitleScene');
            return;
        }
        this.updateUI();
    }

    updateUI() {
        const data = this._getGameData();
        const playerX = data.getNode(data.campaign.currentNodeId).x;
        const deadX = data.campaign.deadlineX;
        const gap = Math.floor(playerX - deadX);

        if (!this.selectedNode) {
            this.infoText.setText(this._t('map.statusInfo', { hp: data.currentHp, gold: data.gold, gap }));
            this.infoText.setColor('#eeeeee');
        }
        if (this.artifactManager) {
            this.artifactManager.updateUI();
        }
        

        if (!this.tweens.isTweening(this.deadlineLine)) {
            this.deadlineLine.x = deadX;
            this.deadlineOverlay.x = deadX;
        }
        
        this.updateActionButton();
    }



    shakeUI(target) {
        if (!target) return;
        this.tweens.add({
            targets: target,
            x: target.x + 5,
            duration: 50,
            yoyo: true,
            repeat: 5,
            ease: 'Sine.easeInOut'
        });
    }




    addLog(message, color) {
        this._debugLog(`[GAME LOG] ${message}`);
        

        const toast = this.add.text(this.scale.width / 2, 150, message, {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#000000cc',
            padding: { x: 20, y: 10 },
            fontFamily: 'Rajdhani'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);


        this.tweens.add({
            targets: toast,
            y: 120,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => toast.destroy()
        });
    }


    showFloatingText(x, y, message, color = '#ffffff') {
        const text = this.add.text(x, y, message, {
            fontSize: '18px',
            fontStyle: 'bold',
            color: color,
            stroke: '#000000',
            strokeThickness: 4,
            fontFamily: 'Rajdhani',
            align: 'center'
        }).setOrigin(0.5).setDepth(3000);

        this.tweens.add({
            targets: text,
            y: y - 60,
            alpha: 0,
            duration: 1500,
            ease: 'Back.out',
            onComplete: () => text.destroy()
        });
    }

    update(time, delta) {

        
        this.bgEffectGraphics.clear();
        const data = this._getGameData();
        const deadX = data.campaign.deadlineX;
        const mapH = data.campaign.mapHeight;


        this.bgEffectGraphics.fillStyle(0xff0000, 0.05);
        this.bgEffectGraphics.fillRect(deadX - 1500, 0, 1500, mapH);
        
        this.bgEffectGraphics.fillStyle(0xff0000, 0.15);
        this.bgEffectGraphics.fillRect(deadX - 50, 0, 50, mapH);


        this.bgEffectGraphics.lineStyle(1, 0xffaaaa, 0.3);
        this.bgEffectGraphics.beginPath();
        this.bgEffectGraphics.moveTo(deadX, 0);
        for (let y = 0; y <= mapH; y += 40) {
            const noise = Math.sin(y * 0.05 + time * 0.005) * 10;
            this.bgEffectGraphics.lineTo(deadX + noise, y);
        }
        this.bgEffectGraphics.strokePath();
    }
}

