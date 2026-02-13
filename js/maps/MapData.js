// js/maps/MapData.js

(function initMapData() {
    const TILE = {
        EMPTY: 0,
        BLOCKED: 1,
        DEPLOY: 2,
        WATCH: 3,
        OUTFIELD: 4
    };

    const CHAR_TO_TILE = {
        '0': TILE.EMPTY,
        '.': TILE.EMPTY,
        '1': TILE.BLOCKED,
        '#': TILE.BLOCKED,
        '2': TILE.DEPLOY,
        '@': TILE.DEPLOY,
        '3': TILE.WATCH,
        '!': TILE.WATCH,
        '4': TILE.OUTFIELD,
        'x': TILE.OUTFIELD,
        'X': TILE.OUTFIELD
    };

    const parseMapLayout = (layoutString) => {
        if (typeof layoutString !== 'string') return [];
        const rows = layoutString
            .split('\n')
            .map((line) => line.split('//')[0].trim())
            .filter(Boolean);

        return rows.map((row) => row.split('').map((ch) => (
            Object.prototype.hasOwnProperty.call(CHAR_TO_TILE, ch)
                ? CHAR_TO_TILE[ch]
                : TILE.EMPTY
        )));
    };

    const normalizeGrid = (rawGrid, width, height, fillValue = TILE.OUTFIELD) => {
        const srcH = Array.isArray(rawGrid) ? rawGrid.length : 0;
        const srcW = srcH > 0 && Array.isArray(rawGrid[0]) ? rawGrid[0].length : 0;
        const outH = Number.isFinite(height) && height > 0 ? Math.floor(height) : srcH;
        const outW = Number.isFinite(width) && width > 0 ? Math.floor(width) : srcW;

        const grid = Array(outH).fill(null).map(() => Array(outW).fill(fillValue));
        for (let y = 0; y < Math.min(outH, srcH); y++) {
            for (let x = 0; x < Math.min(outW, srcW); x++) {
                const v = rawGrid[y][x];
                grid[y][x] = Number.isFinite(v) ? v : fillValue;
            }
        }
        return grid;
    };

    const createMap = (config) => {
        const raw = parseMapLayout(config.layout || '');
        const inferredH = raw.length || 1;
        const inferredW = (raw[0] && raw[0].length) ? raw[0].length : 1;
        const mapWidth = Number.isFinite(config.mapWidth) ? config.mapWidth : inferredW;
        const mapHeight = Number.isFinite(config.mapHeight) ? config.mapHeight : inferredH;

        return {
            id: config.id,
            image: config.image || 'bg_battle',
            tileSize: Number.isFinite(config.tileSize) ? config.tileSize : 40,
            mapWidth,
            mapHeight,
            deployLimit: Number.isFinite(config.deployLimit) ? config.deployLimit : 266,
            getGrid: () => normalizeGrid(raw, mapWidth, mapHeight, TILE.OUTFIELD)
        };
    };

    const DEFAULT_MAP_LAYOUT = `
44444444444444444444444444
44444444444444444444444444
44444444444444444444444444
22222200000001100000333333
22222200000000000000333333
22222200000000000000333333
22222200000001100000333333
22222200000000000000333333
22222200000001100000333333
22222200000001100000333333
44444444444444444444444444
44444444444444444444444444
44444444444444444444444444
44444444444444444444444444
44444444444444444444444444
`;

    const MAPS = window.MAPS || {};
    MAPS.DefaultMap = createMap({
        id: 'DefaultMap',
        image: 'bg_battle',
        tileSize: 50,
        mapWidth: 32,
        mapHeight: 18,
        deployLimit: 266,
        layout: DEFAULT_MAP_LAYOUT
    });

    // Stage 1 requests `Map1` in BattleScene.
    MAPS.Map1 = createMap({
        id: 'Map1',
        image: 'bg_battle',
        tileSize: 50,
        mapWidth: 32,
        mapHeight: 18,
        deployLimit: 266,
        layout: DEFAULT_MAP_LAYOUT
    });

    window.MAPS = MAPS;
    window.getMapData = function getMapData(mapId) {
        if (mapId && window.MAPS[mapId]) {
            console.log(`[MapLoader] map loaded: ${mapId}`);
            return window.MAPS[mapId];
        }
        console.warn(`[MapLoader] map id '${mapId}' not found. fallback -> DefaultMap`);
        return window.MAPS.DefaultMap;
    };
})();

