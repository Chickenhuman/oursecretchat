// js/managers/EventManager.js

class EventManager {
    static _getCtx(scene) {
        if (scene && scene.ctx) return scene.ctx;
        if (typeof getGameContext === 'function') return getGameContext();
        return null;
    }

    static _getGameData(scene) {
        const ctx = this._getCtx(scene);
        return (ctx && ctx.data) ? ctx.data : null;
    }

    static _completeCurrentNode(scene) {
        const data = this._getGameData(scene);
        if (data && typeof data.completeCurrentNode === 'function') {
            data.completeCurrentNode();
        }
    }

    static playRandomEvent(scene) {
        const data = this._getGameData(scene);
        if (!data) {
            console.error('EventManager: game data is not available.');
            return;
        }

        if (!window.GAME_EVENTS) {
            console.error('EventManager: GAME_EVENTS is not loaded.');
            this._completeCurrentNode(scene);
            return;
        }

        const validEvents = window.GAME_EVENTS.filter(evt => {
            if (!evt.req) return true;
            return evt.req(data);
        });

        if (validEvents.length === 0) {
            alert('No available events for current conditions.');
            this._completeCurrentNode(scene);
            return;
        }

        const event = validEvents[Math.floor(Math.random() * validEvents.length)];
        this.showEventPopup(scene, event);
    }

    static showEventPopup(scene, event) {
        const data = this._getGameData(scene);
        if (!data) {
            console.error('EventManager: cannot show event popup without game data.');
            return;
        }

        let popup = document.getElementById('event-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'event-popup';
            popup.className = 'ui-overlay';
            popup.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.9); z-index: 5000;
                display: flex; justify-content: center; align-items: center;
            `;
            document.body.appendChild(popup);
        }

        let choicesHtml = '';
        event.choices.forEach((choice, index) => {
            const isAvailable = choice.req ? choice.req(data) : true;
            const btnStyle = isAvailable
                ? 'background:#333; color:#fff; border:1px solid #aaa; cursor:pointer;'
                : 'background:#222; color:#555; border:1px solid #333; cursor:not-allowed;';
            const clickAction = isAvailable ? `EventManager.selectChoice(${index})` : '';

            choicesHtml += `
                <div onclick="${clickAction}" style="
                    padding: 15px; margin: 10px 0; text-align: left; font-size: 16px;
                    transition: 0.2s; ${btnStyle}
                " onmouseover="if('${isAvailable}'=='true') this.style.background='#444'"
                  onmouseout="if('${isAvailable}'=='true') this.style.background='#333'">
                    ${choice.text}
                </div>
            `;
        });

        popup.innerHTML = `
            <div class="popup-box" style="width: 500px; max-width: 90%; background: #111; padding: 30px; border: 2px solid #555;">
                <h2 style="color: #ffcc00; margin-top: 0; border-bottom: 1px solid #555; padding-bottom: 10px;">${event.title}</h2>
                <div style="min-height: 100px; color: #ddd; margin: 20px 0; font-size: 18px; line-height: 1.6;">
                    ${event.desc.replace(/\n/g, '<br>')}
                </div>
                <div id="event-choices">
                    ${choicesHtml}
                </div>
            </div>
        `;

        this.currentEvent = event;
        this.currentScene = scene;
        this.currentData = data;
        popup.style.display = 'flex';
    }

    static selectChoice(index) {
        if (!this.currentEvent || !this.currentData) return;
        const choice = this.currentEvent.choices[index];
        if (!choice) return;

        const resultMsg = choice.effect(this.currentScene, this.currentData);
        const popup = document.getElementById('event-popup');
        if (!popup) return;

        popup.innerHTML = `
            <div class="popup-box" style="width: 400px; text-align: center; background: #111; border: 2px solid #555; padding: 30px;">
                <h3 style="color: #00ff00; margin-bottom: 20px;">Result</h3>
                <p style="color: #fff; font-size: 18px; margin-bottom: 30px; line-height: 1.5;">${String(resultMsg || '').replace(/\n/g, '<br>')}</p>
                <button onclick="EventManager.closeEvent()" style="padding: 10px 30px; font-size: 16px; background: #2980b9; color: white; border: none; cursor: pointer;">OK</button>
            </div>
        `;

        if (typeof this.currentData.completeCurrentNode === 'function') {
            this.currentData.completeCurrentNode();
        }

        if (this.currentScene && typeof this.currentScene.updateUI === 'function') {
            this.currentScene.updateUI();
        }
    }

    static closeEvent() {
        const popup = document.getElementById('event-popup');
        if (popup) {
            popup.style.display = 'none';
            popup.innerHTML = '';
        }

        if (this.currentScene && typeof this.currentScene.updateUI === 'function') {
            this.currentScene.updateUI();
        } else if (
            this.currentScene &&
            this.currentScene.artifactManager &&
            typeof this.currentScene.artifactManager.updateUI === 'function'
        ) {
            this.currentScene.artifactManager.updateUI();
        }
    }
}

window.EventManager = EventManager;
