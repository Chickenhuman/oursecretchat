// js/scenes/ShopScene.js

class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
        this.popupKeyListener = null;
    }

    _t(key, params) {
        return (typeof window.t === 'function') ? window.t(key, params) : key;
    }

    create() {
        this.ctx = (typeof getGameContext === 'function') ? getGameContext() : null;
        this.stock = this.generateStock();
        this.renderShopUI();
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

    _getArtifactData() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        return (this.ctx && this.ctx.artifactData) ? this.ctx.artifactData : {};
    }

    generateStock() {
        const stock = [];
        const unitStats = this._getUnitStats();

        // Random unit cards
        const allKeys = Object.keys(unitStats).filter((k) => k !== '기지' && k !== '적군');
        for (let i = 0; i < 3; i++) {
            const pick = allKeys[Math.floor(Math.random() * allKeys.length)];
            const price = (unitStats[pick].cost * 15) + Math.floor(Math.random() * 20);
            stock.push({ type: 'card', name: pick, cost: price, sold: false });
        }

        // Random artifact
        const data = this._getGameData();
        const ownedArtifacts = data ? data.artifacts : [];
        const artifactData = this._getArtifactData();
        const artiKeys = Object.keys(artifactData).filter((k) => !ownedArtifacts.includes(k));
        if (artiKeys.length > 0) {
            const pick = artiKeys[Math.floor(Math.random() * artiKeys.length)];
            const rarity = artifactData[pick].rarity;
            const price = (rarity === 'LEGENDARY') ? 150 : (rarity === 'EPIC' ? 100 : 60);
            stock.push({ type: 'artifact', key: pick, cost: price, sold: false });
        }

        // Card remove service
        stock.push({
            type: 'service_remove',
            name: this._t('shop.service.remove'),
            cost: 75,
            desc: this._t('shop.service.removeDesc'),
            sold: false
        });

        return stock;
    }

    renderShopUI() {
        let container = document.getElementById('shop-ui');
        if (!container) {
            container = document.createElement('div');
            container.id = 'shop-ui';
            document.body.appendChild(container);
        }

        container.style.display = 'flex';
        container.innerHTML = '';

        const data = this._getGameData();
        const gold = data ? data.gold : 0;

        const leftPanel = document.createElement('div');
        leftPanel.className = 'shop-panel-left';
        leftPanel.innerHTML = `
            <div class="shop-title">${this._t('shop.title')}</div>
            <div class="shop-gold-display">
                ${this._t('shop.gold')}: <span class="gold-val">${gold} G</span>
            </div>
            <div id="shop-item-list"></div>
        `;
        container.appendChild(leftPanel);

        const itemListContainer = leftPanel.querySelector('#shop-item-list');
        this.stock.forEach((item) => {
            itemListContainer.appendChild(this.createItemElement(item));
        });

        const rightPanel = document.createElement('div');
        rightPanel.innerHTML = `<div class="btn-leave-shop" id="btn-leave">${this._t('shop.leave')}</div>`;
        container.appendChild(rightPanel);

        const leaveBtn = document.getElementById('btn-leave');
        if (leaveBtn) leaveBtn.onclick = () => this.confirmLeaveShop(container);
    }

    confirmLeaveShop(container) {
        this.showCustomPopup(
            this._t('shop.leave'),
            this._t('shop.leaveConfirm'),
            () => {
                container.style.display = 'none';
                const data = this._getGameData();
                if (data) data.completeCurrentNode();
                this.scene.start('MapScene');
            },
            true
        );
    }

    createItemElement(item) {
        const div = document.createElement('div');
        div.className = `shop-item ${item.sold ? 'sold-out' : ''}`;

        let imgContent = '•';
        let nameText = item.name;
        let descText = '';

        if (item.type === 'card') {
            imgContent = '🃏';
            const stats = this._getUnitStats()[item.name];
            descText = this._t('shop.cardStat', { cost: stats.cost, atk: stats.damage });
        } else if (item.type === 'artifact') {
            imgContent = '💎';
            nameText = this._getArtifactData()[item.key].name;
            descText = this._t('shop.artifact');
        } else if (item.type === 'service_remove') {
            imgContent = '🔥';
            descText = item.desc;
            div.style.borderColor = '#ff5555';
        }

        div.innerHTML = `
            <div class="shop-item-img">${imgContent}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${nameText}</div>
                <div class="shop-item-desc">${descText}</div>
            </div>
            <div class="shop-item-price-box">
                ${item.sold ? `<span class="sold-text">${this._t('shop.sold')}</span>` : `<span class="shop-item-price">${item.cost} G</span>`}
            </div>
        `;

        if (!item.sold) {
            div.onclick = () => this.handlePurchase(item);
        }
        return div;
    }

    handlePurchase(item) {
        const data = this._getGameData();
        if (!data || data.gold < item.cost) {
            this.showCustomPopup(this._t('ui.popupTitle'), this._t('shop.goldLack'));
            return;
        }

        if (item.type === 'card') {
            data.addGold(-item.cost);
            data.addCard({ type: 'Unit', name: item.name });
            item.sold = true;
            this.showCustomPopup(this._t('shop.buyDone'), this._t('shop.buyCardDone', { name: item.name }));
            this.renderShopUI();
            return;
        }

        if (item.type === 'artifact') {
            data.addGold(-item.cost);
            data.addArtifact(item.key);
            item.sold = true;
            this.showCustomPopup(this._t('shop.buyDone'), this._t('shop.buyArtifactDone', { name: this._getArtifactData()[item.key].name }));
            this.renderShopUI();
            return;
        }

        if (item.type === 'service_remove') {
            if (data.deck.length <= 5) {
                this.showCustomPopup(this._t('ui.popupTitle'), this._t('shop.keepMinDeck'));
                return;
            }
            this.openDeckForRemoval(item);
        }
    }

    openDeckForRemoval(serviceItem) {
        const modal = document.getElementById('card-viewer-modal');
        const titleEl = document.getElementById('viewer-title');
        const contentEl = document.getElementById('viewer-content');
        const closeBtn = document.getElementById('btn-viewer-close');
        if (!modal || !titleEl || !contentEl) return;

        modal.style.pointerEvents = 'auto';
        titleEl.innerText = this._t('shop.pickRemoveCard');
        titleEl.style.color = '#ff5555';
        contentEl.innerHTML = '';

        const closeModal = () => {
            modal.style.display = 'none';
            window.removeEventListener('keydown', viewerEscHandler);
        };

        const viewerEscHandler = (e) => {
            if (e.key === 'Escape' && document.getElementById('game-popup').style.display === 'none') {
                closeModal();
            }
        };

        window.addEventListener('keydown', viewerEscHandler);
        if (closeBtn) closeBtn.onclick = closeModal;

        const data = this._getGameData();
        if (!data) return;

        data.deck.forEach((cardObj, index) => {
            const cardNode = this.createCardDOM(cardObj);
            cardNode.style.pointerEvents = 'auto';
            cardNode.style.cursor = 'pointer';

            cardNode.onmouseenter = () => {
                cardNode.style.border = '3px solid #ff5555';
                cardNode.style.transform = 'scale(1.05)';
                cardNode.style.zIndex = '100';
            };
            cardNode.onmouseleave = () => {
                cardNode.style.border = 'none';
                cardNode.style.transform = 'scale(0.85)';
                cardNode.style.zIndex = '';
            };

            cardNode.onclick = (e) => {
                e.stopPropagation();
                if (!cardObj || typeof cardObj !== 'object') return;
                const cardName = cardObj.name;
                this.showCustomPopup(
                    this._t('shop.removeConfirmTitle'),
                    this._t('shop.removeConfirmMessage', { name: cardName, cost: serviceItem.cost }),
                    () => {
                        this.executeRemoval(index, serviceItem);
                        closeModal();
                    },
                    true
                );
            };

            contentEl.appendChild(cardNode);
        });

        modal.style.display = 'flex';
    }

    executeRemoval(index, serviceItem) {
        const data = this._getGameData();
        if (!data || data.gold < serviceItem.cost) {
            this.showCustomPopup(this._t('shop.error'), this._t('shop.goldLack'));
            return;
        }

        const removedCard = data.deck[index];
        if (!removedCard || typeof removedCard !== 'object') return;
        const cardName = removedCard.name;

        data.addGold(-serviceItem.cost);
        data.removeCard(index);
        serviceItem.sold = true;

        this.renderShopUI();
        this.showCustomPopup(this._t('shop.removeDoneTitle'), this._t('shop.removeDoneMessage', { name: cardName }));
    }

    createCardDOM(cardObj) {
        if (!cardObj || typeof cardObj !== 'object') return document.createElement('div');
        const type = cardObj.type;
        const name = cardObj.name;
        const stats = (type === 'Unit') ? this._getUnitStats()[name] : this._getSkillStats()[name];
        const fileName = (stats && stats.image) ? String(stats.image).replace('img_', '') : '';
        const availableChars = new Set(Array.isArray(window.CHAR_IMAGE_FILES) ? window.CHAR_IMAGE_FILES : []);
        const imgPath = (fileName && availableChars.has(fileName)) ? `assets/chars/${fileName}.png` : 'assets/noimg.png';

        const div = document.createElement('div');
        div.className = 'card card-in-viewer';
        const frameClass = (type === 'Unit') ? 'frame-unit' : 'frame-skill';

        let statsHtml = '';
        if (type === 'Unit') {
            statsHtml = `
                <div class="stat-badge stat-atk" style="font-size:14px">${stats.damage}</div>
                <div class="stat-badge stat-hp" style="font-size:14px">${stats.hp}</div>
            `;
        }

        let traitsHtml = '';
        if (stats.race) traitsHtml += `<span class="trait-tag tag-race">${stats.race}</span>`;
        if (Array.isArray(stats.traits)) stats.traits.forEach((t) => { traitsHtml += `<span class="trait-tag tag-trait">${t}</span>`; });

        div.innerHTML = `
            <img src="${imgPath}" class="card-bg-img">
            <div class="card-frame ${frameClass}"></div>
            <div class="card-cost">${stats.cost}</div>
            <div class="card-name">${name}</div>
            <div class="card-traits">${traitsHtml}</div>
            <div class="card-type">${type}</div>
            ${statsHtml}
        `;
        return div;
    }

    showCustomPopup(title, msg, onConfirm, isConfirm = false) {
        const popup = document.getElementById('game-popup');
        const titleEl = document.getElementById('popup-title');
        const msgEl = document.getElementById('popup-message');
        const btnConfirm = document.getElementById('btn-popup-confirm');
        const btnCancel = document.getElementById('btn-popup-cancel');
        if (!popup || !titleEl || !msgEl || !btnConfirm || !btnCancel) return;

        titleEl.innerText = title;
        msgEl.innerText = msg;
        btnCancel.style.display = isConfirm ? 'inline-block' : 'none';

        const closePopup = () => {
            popup.style.display = 'none';
            if (this.popupKeyListener) {
                window.removeEventListener('keydown', this.popupKeyListener);
                this.popupKeyListener = null;
            }
        };

        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnConfirm.onclick = () => {
            closePopup();
            if (onConfirm) onConfirm();
        };
        newBtnCancel.onclick = () => closePopup();

        if (this.popupKeyListener) window.removeEventListener('keydown', this.popupKeyListener);
        this.popupKeyListener = (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                closePopup();
                if (onConfirm) onConfirm();
                return;
            }
            if (e.code === 'Escape') {
                e.preventDefault();
                closePopup();
                if (!isConfirm && onConfirm) onConfirm();
            }
        };
        window.addEventListener('keydown', this.popupKeyListener);

        popup.style.display = 'flex';
    }
}

