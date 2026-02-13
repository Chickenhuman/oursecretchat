// js/managers/SVGManager.js

class SVGManager {
    constructor(scene) {
        this.scene = scene;
        this.ctx = (scene && scene.ctx) || (typeof getGameContext === 'function' ? getGameContext() : null);

        this.pendingKeys = new Set();
    }


    _getUnitStats() {
        if (!this.ctx && typeof getGameContext === 'function') this.ctx = getGameContext();
        if (this.scene && typeof this.scene._getUnitStats === 'function') return this.scene._getUnitStats();
        return (this.ctx && this.ctx.unitStats) ? this.ctx.unitStats : {};
    }
    /**
     * 紐⑤뱺 ?띿뒪泥섎? 誘몃━ ?앹꽦?섍퀬, ?꾨즺?섎㈃ onComplete 肄쒕갚???ㅽ뻾?⑸땲??
     */
    prebakeAllTextures(onComplete) {
        console.log("[SVGManager V3.0] 텍스처 프리베이크 시작...");

        let tasks = [];

        try {

            const unitStats = this._getUnitStats();
            if (unitStats && Object.keys(unitStats).length > 0) {
                for (const [name, stats] of Object.entries(unitStats)) {
                    if (!stats) continue;
                    const defaultParts = { body: 'body_knight', weapon: 'weapon_sword', acc: 'acc_shield' };
                    let partConfig = { ...defaultParts, ...(stats.parts || {}) };

                    // Dedicated wall body: do not attach weapon/shield.
                    if (stats.image === 'img_wall') {
                        partConfig = { body: 'body_wall' };
                    }
                    
                    tasks.push({ type: 'unit', name, team: 'ALLY', config: partConfig });
                    tasks.push({ type: 'unit', name, team: 'ENEMY', config: partConfig });
                }
            } else {
                console.warn('[SVGManager] unitStats unavailable in context.');
            }


            if (typeof SVG_DATA !== 'undefined') {
                for (const key in SVG_DATA) {
                    if (key.startsWith('base_')) {


                        tasks.push({ type: 'raw', key: key, param: null });
                        tasks.push({ type: 'raw', key: `${key}_ALLY`, param: 'ALLY' });
                        tasks.push({ type: 'raw', key: `${key}_ENEMY`, param: 'ENEMY' });
                    }
                }
            } else {
                console.error("[SVGManager] SVG_DATA를 찾을 수 없습니다. (js/data/SVGdata.js 로드 확인 필요)");
            }

        } catch (err) {
            console.error("[SVGManager] 텍스처 목록 수집 중 오류:", err);
            if (onComplete) onComplete();
            return;
        }


        let totalTasks = tasks.length;
        let loadedCount = 0;

        console.log(`[SVGManager] bake target: ${totalTasks} textures`);


        if (totalTasks === 0) {
            console.warn("[SVGManager] no textures to bake; finishing immediately.");
            if (onComplete) onComplete();
            return;
        }


        const globalWatchdog = setTimeout(() => {
            console.warn(`[SVGManager] global watchdog timeout (${loadedCount}/${totalTasks}).`);
            if (onComplete) onComplete();
        }, 3000);


        const checkDone = () => {
            loadedCount++;
            if (loadedCount >= totalTasks) {
                console.log("[SVGManager] all textures baked.");
                clearTimeout(globalWatchdog);
                if (onComplete) onComplete();
            }
        };


        tasks.forEach(task => {
            if (task.type === 'unit') {
                this.generateUnitTextures(task.name, task.team, task.config, checkDone);
            } else {

                const svgStr = this.getSVGString(task.key.replace('_ALLY', '').replace('_ENEMY', ''), task.param);
                this.createTexture(task.key, svgStr, checkDone);
            }
        });
    }

    generateUnitTextures(name, team, partConfig, onUnitFinished) {

        const partKeys = Object.keys(partConfig);

        if (partKeys.length === 0) {
            if (onUnitFinished) onUnitFinished();
            return;
        }

        let partsLoaded = 0;
        const onPartDone = () => {
            partsLoaded++;
            if (partsLoaded >= partKeys.length) {
                if (onUnitFinished) onUnitFinished();
            }
        };


        partKeys.forEach(partName => {
            const textureKey = partConfig[partName];
            


            const isNeutral = (partName === 'weapon'); 
            
            const finalKey = isNeutral ? textureKey : `${textureKey}_${team}`;
            const colorParam = isNeutral ? null : team;

            this.createTexture(finalKey, this.getSVGString(textureKey, colorParam), onPartDone);
        });
    }

    createTexture(key, svgString, callback) {

        if (this.scene.textures.exists(key) || this.pendingKeys.has(key)) {
            if (callback) callback();
            return;
        }

        if (!svgString) {


            if (callback) callback();
            return;
        }

        this.pendingKeys.add(key);

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();


        const imgWatchdog = setTimeout(() => {
            console.error(`[SVGManager] 이미지 로드 타임아웃: ${key}`);
            this.pendingKeys.delete(key);
            URL.revokeObjectURL(url);
            if (callback) callback();
        }, 500);

        img.onload = () => {
            clearTimeout(imgWatchdog);
            this.scene.textures.addImage(key, img);
            this.pendingKeys.delete(key);
            URL.revokeObjectURL(url);
            if (callback) callback();
        };

        img.onerror = () => {
            clearTimeout(imgWatchdog);
            console.error(`[SVGManager] 이미지 변환 실패: ${key}`);
            this.pendingKeys.delete(key);
            if (callback) callback();
        };

        img.src = url;
    }

    /**
     * SVG 臾몄옄??媛?몄삤湲?+ ?됱긽 蹂??(Legacy 吏???ы븿)
     */
    getSVGString(key, overrideColorOrTeam = null) {
        if (typeof SVG_DATA === 'undefined' || !SVG_DATA[key]) {
            return null;
        }


        let finalColor = '#ffffff'; 
        
        if (overrideColorOrTeam === 'ALLY') finalColor = '#3498db';      
        else if (overrideColorOrTeam === 'ENEMY') finalColor = '#e74c3c'; 
        else if (overrideColorOrTeam) finalColor = overrideColorOrTeam;   

        const data = SVG_DATA[key];


        if (typeof data === 'function') {
            return data(finalColor);
        }


        if (data.render && typeof data.render === 'function') {
            return data.render(finalColor);
        }


        if (data.paths) {
            let pathsStr = '';
            data.paths.forEach((p, index) => {
                const fillColor = (index === 0 && finalColor) ? finalColor : p.color;
                
                if (p.path === 'circle') {
                    pathsStr += `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fillColor}" />`;
                } else {
                    let attrs = `d="${p.path}"`;
                    if (p.stroke) {
                        attrs += ` stroke="${fillColor}" stroke-width="${p.width || 1}" fill="none"`;
                    } else {
                        attrs += ` fill="${fillColor}" stroke="none"`;
                    }
                    pathsStr += `<path ${attrs} />`;
                }
            });
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" width="100" height="100">${pathsStr}</svg>`;
        }

        return null;
    }
}
