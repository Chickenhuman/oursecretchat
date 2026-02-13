class CommanderSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CommanderSelectScene' });
    }

    _t(key, params) {
        return (typeof window.t === 'function') ? window.t(key, params) : key;
    }

    preload() {
        this.load.image('bg_select', 'assets/title_bg.png');
        this.load.image('cmd_knight', 'assets/commanders/cmd_knight.png');
        this.load.image('cmd_mage', 'assets/commanders/cmd_mage.png');
        this.load.image('noimg', 'assets/noimg.png');
    }

    create() {
        this.ctx = (typeof getGameContext === 'function') ? getGameContext() : null;

        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'bg_select');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.7);

        this.add.text(this.scale.width / 2, 80, this._t('commander.title'), {
            fontSize: '48px',
            fontFamily: 'serif',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const commanders = (this.ctx && this.ctx.commanders) ? this.ctx.commanders : {};
        const keys = Object.keys(commanders);
        const startX = this.scale.width / 2 - ((keys.length - 1) * 240) / 2;
        const centerY = this.scale.height / 2;

        keys.forEach((key, index) => {
            const data = commanders[key];
            const x = startX + (index * 240);
            this.createCommanderCard(x, centerY, key, data);
        });
    }

    createCommanderCard(x, y, key, data) {
        const container = this.add.container(x, y);

        const cardBg = this.add.rectangle(0, 0, 200, 320, 0x333333);
        cardBg.setStrokeStyle(4, data.color);

        const nameText = this.add.text(0, -130, data.name, {
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        const portrait = (data.image && this.textures.exists(data.image))
            ? this.add.image(0, -40, data.image)
            : this.add.image(0, -40, 'noimg');
        portrait.setDisplaySize(120, 120);

        const portraitBorder = this.add.rectangle(0, -40, 124, 124);
        portraitBorder.setStrokeStyle(2, data.color);

        const hpText = this.add.text(0, 35, this._t('commander.hp', { hp: data.hp }), {
            fontSize: '16px',
            color: '#ff8888',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const descText = this.add.text(0, 80, data.desc, {
            fontSize: '14px',
            color: '#cccccc',
            align: 'center',
            wordWrap: { width: 180 }
        }).setOrigin(0.5);

        const btn = this.add.rectangle(0, 130, 160, 40, 0x555555);
        const btnText = this.add.text(0, 130, this._t('commander.select'), {
            fontSize: '18px',
            color: '#fff'
        }).setOrigin(0.5);

        container.add([cardBg, nameText, portrait, portraitBorder, hpText, descText, btn, btnText]);

        btn.setInteractive({ cursor: 'pointer' })
            .on('pointerover', () => btn.setFillStyle(0x777777))
            .on('pointerout', () => btn.setFillStyle(0x555555))
            .on('pointerdown', () => {
                if (typeof setSelectedCommander === 'function') {
                    setSelectedCommander(key);
                }
                this.scene.start('BattleScene');
            });
    }
}

