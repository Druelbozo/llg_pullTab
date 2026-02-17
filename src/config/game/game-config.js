/**
 * Dynamic Game Configuration Selector
 *
 * Selects a configuration module from /src/config at runtime based on:
 * 1) URL query parameter: ?config=piggy
 * 2) Fallback: default
 *
 * All config files must share the same schema.
 */

//import defaultConfig from './archive/default.js';
import crazybananaConfig from './crazybanana.js';
import lumberjackaConfig from './lumberjack.js';
import yummyConfig from './yummy.js';
import monsterConfig from './monster.js';


const AVAILABLE_CONFIGS = {
    //'default': defaultConfig,
    'crazybanana': crazybananaConfig,
    'lumberjack': lumberjackaConfig,
    'yummy': yummyConfig,
    'monster': monsterConfig,
};

function getSelectedConfigName() {
    try {
        // Read from current window, then parent/top (Phaser Editor external runner may iframe the game)
        const readParam = (win) => {
            try {
                return new URLSearchParams(win.location.search).get('config');
            } catch (_) { return null; }
        };

        const fromQuery = readParam(window) || readParam(window.parent) || readParam(window.top);
        if (fromQuery && AVAILABLE_CONFIGS[fromQuery]) {
            return fromQuery;
        }
    } catch (_) {
        // In non-browser contexts, fall through to default
    }
    return 'monster';
}

const selectedName = getSelectedConfigName();
const gameConfig = AVAILABLE_CONFIGS[selectedName] || AVAILABLE_CONFIGS['monster'];

export default gameConfig;

