// js/scenes/TitleScene.js

class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        this.load.image('bg_title', 'assets/title_bg.png');
        this.load.image('ui_btn_start', 'assets/ui/btn_parchment.png');
    }

    create() {
        const topBar = document.getElementById('ui-top-bar');
        const bottomBar = document.getElementById('ui-bottom-bar');
        const line = document.getElementById('outfield-line');
        const artifactContainer = document.getElementById('artifact-container');
        if (topBar) topBar.style.display = 'none';
        if (bottomBar) bottomBar.style.display = 'none';
        if (line) line.style.display = 'none';
        if (artifactContainer) artifactContainer.style.display = 'none';

        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'bg_title');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000, 0.3);

        const btnX = (this.scale.width / 2) + 350;
        const startY = this.scale.height * 0.55;
        const gap = 100;

        this.menuButtons = [];
        this.createButton(btnX, startY, 'title.start', () => {
            const ctx = (typeof getGameContext === 'function') ? getGameContext() : null;
            if (ctx && ctx.data && typeof ctx.data.startNewGame === 'function') ctx.data.startNewGame();
            this.scene.start('CommanderSelectScene');
        });

        this.createButton(btnX, startY + gap, 'title.setting', () => {
            this.openSettingsPanel();
        });

        this.createButton(btnX, startY + gap * 2, 'title.cardList', () => {
            this.openCardList();
        });

        this.createButton(btnX, startY + gap * 3, 'title.exit', () => {
            if (confirm(this._t('title.exitConfirm'))) {
                window.close();
                alert(this._t('title.exitFallback'));
            }
        });

        document.addEventListener('ct:langchange', this._onLangChange = () => this.refreshTexts());
        this.events.once('shutdown', () => this.shutdown());
    }

    _t(key, params) {
        return (typeof window.t === 'function') ? window.t(key, params) : key;
    }

    createButton(x, y, textKey, callback) {
        const btnContainer = this.add.container(x, y);
        const btnBg = this.add.image(0, 0, 'ui_btn_start');
        btnBg.setDisplaySize(300, 90);

        const btnText = this.add.text(0, 0, this._t(textKey), {
            fontSize: '24px', fontFamily: 'serif', color: '#3e2723', fontStyle: 'bold'
        }).setOrigin(0.5);

        btnContainer.add([btnBg, btnText]);
        btnContainer.setSize(300, 90);
        btnContainer.setInteractive({ cursor: 'pointer' });

        btnContainer.on('pointerover', () => {
            this.tweens.add({ targets: btnContainer, scale: 1.05, duration: 100 });
            btnText.setColor('#8d6e63');
        });
        btnContainer.on('pointerout', () => {
            this.tweens.add({ targets: btnContainer, scale: 1.0, duration: 100 });
            btnText.setColor('#3e2723');
        });
        btnContainer.on('pointerdown', () => {
            this.tweens.add({
                targets: btnContainer, scale: 0.95, duration: 50, yoyo: true,
                onComplete: callback
            });
        });

        this.menuButtons.push({ key: textKey, text: btnText });
    }

    openCardList() {
        const ctx = (typeof getGameContext === 'function') ? getGameContext() : null;
        const unitStats = (ctx && ctx.unitStats) ? ctx.unitStats : {};
        const skillStats = (ctx && ctx.skillStats) ? ctx.skillStats : {};

        const unitCards = Object.keys(unitStats)
            .filter((name) => name !== '적군' && name !== '기지')
            .map((name) => ({ type: 'Unit', name }));
        const skillCards = Object.keys(skillStats)
            .map((name) => ({ type: 'Skill', name }));

        const cards = [...unitCards, ...skillCards]
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        if (!this._viewerDeckManager) {
            this._viewerDeckManager = new CardDeckManager(this, ctx);
        }
        this._viewerDeckManager.openCardViewer(this._t('title.cardListTitle'), cards);
    }

    refreshTexts() {
        if (Array.isArray(this.menuButtons)) {
            this.menuButtons.forEach((b) => {
                if (b && b.text && b.key) b.text.setText(this._t(b.key));
            });
        }
        if (typeof window.applyStaticI18n === 'function') {
            window.applyStaticI18n();
        }
    }

    openSettingsPanel() {
        if (this.settingsPanel) this.settingsPanel.destroy(true);

        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        const panel = this.add.container(cx, cy);
        panel.setDepth(3000);

        const bg = this.add.rectangle(0, 0, 420, 280, 0x0f0f12, 0.95);
        bg.setStrokeStyle(2, 0xffcc00, 0.9);
        const title = this.add.text(0, -105, this._t('settings.title'), {
            fontSize: '28px', color: '#ffcc00', fontStyle: 'bold'
        }).setOrigin(0.5);
        const label = this.add.text(-120, -35, `${this._t('settings.language')}:`, {
            fontSize: '20px', color: '#ffffff'
        }).setOrigin(0, 0.5);

        const makeLangBtn = (x, y, lang, key) => {
            const active = (typeof window.getLanguage === 'function') ? (window.getLanguage() === lang) : false;
            const r = this.add.rectangle(x, y, 150, 52, active ? 0x2f5e2f : 0x2a2a2a, 1);
            r.setStrokeStyle(1, 0xffcc00, 0.8);
            const t = this.add.text(x, y, this._t(key), { fontSize: '18px', color: '#f0f0f0' }).setOrigin(0.5);
            r.setInteractive({ cursor: 'pointer' });
            r.on('pointerdown', () => {
                if (typeof window.setLanguage === 'function') window.setLanguage(lang);
                title.setText(this._t('settings.title'));
                label.setText(`${this._t('settings.language')}:`);
                koTxt.setText(this._t('settings.ko'));
                enTxt.setText(this._t('settings.en'));
                closeTxt.setText(this._t('settings.close'));
                this.refreshTexts();
                r.setFillStyle(0x2f5e2f, 1);
                (lang === 'ko' ? enBtn : koBtn).setFillStyle(0x2a2a2a, 1);
            });
            return { r, t };
        };

        const koPair = makeLangBtn(-75, 25, 'ko', 'settings.ko');
        const enPair = makeLangBtn(95, 25, 'en', 'settings.en');
        const koBtn = koPair.r;
        const koTxt = koPair.t;
        const enBtn = enPair.r;
        const enTxt = enPair.t;

        const closeBtn = this.add.rectangle(0, 100, 140, 48, 0x333333, 1);
        closeBtn.setStrokeStyle(1, 0xffcc00, 0.8);
        const closeTxt = this.add.text(0, 100, this._t('settings.close'), {
            fontSize: '18px', color: '#ffffff'
        }).setOrigin(0.5);
        closeBtn.setInteractive({ cursor: 'pointer' });
        closeBtn.on('pointerdown', () => {
            if (this.settingsPanel) {
                this.settingsPanel.destroy(true);
                this.settingsPanel = null;
            }
        });

        panel.add([bg, title, label, koBtn, koTxt, enBtn, enTxt, closeBtn, closeTxt]);
        this.settingsPanel = panel;
    }

    shutdown() {
        if (this._onLangChange) {
            document.removeEventListener('ct:langchange', this._onLangChange);
            this._onLangChange = null;
        }
    }
}
