/**
 * Pull-tab game / session debug (panel 1). Scratch uses paytable + grid; pull-tabs use session config + peel state.
 */

/**
 * @param {Phaser.Scene} scene
 * @returns {string[]}
 */
export function formatGameDebugInfo(scene) {
	if (!scene) {
		return ['=== Pull-tab game debug ===', 'Scene not available'];
	}
	const lines = ['=== Pull-tab game debug ===', ''];

	lines.push('--- Session / selected config ---');
	if (typeof window !== 'undefined' && window.__sessionId) {
		lines.push(`sessionId: ${String(window.__sessionId)}`);
	}
	if (typeof window !== 'undefined' && window.__selectedGameConfig) {
		const c = window.__selectedGameConfig;
		try {
			lines.push(JSON.stringify(c, null, 2));
		} catch (_) {
			lines.push(String(c));
		}
	} else {
		lines.push('window.__selectedGameConfig: (none)');
	}
	lines.push('');

	lines.push('--- Balance / HUD ---');
	lines.push(`balancePennies: ${scene.balancePennies ?? 'N/A'}`);
	lines.push('');

	lines.push('--- PeelManager ---');
	const pm = scene.peelManager;
	if (pm) {
		lines.push(`speed: ${pm.speed ?? 'N/A'}`);
		lines.push(`autoMode: ${pm.autoMode ?? 'N/A'}`);
		lines.push(`autoRoundsLeft: ${pm.autoRoundsLeft ?? 'N/A'}`);
	} else {
		lines.push('(no peelManager)');
	}
	lines.push('');

	lines.push('--- StateManager ---');
	const sm = scene.stateManager;
	if (sm && sm.state != null) {
		lines.push(`state: ${String(sm.state)}`);
	} else {
		lines.push('(no state)');
	}
	lines.push('');

	lines.push('--- ServerManager.gameConfig ---');
	const gc = scene.serverManager?.gameConfig;
	if (gc) {
		try {
			lines.push(JSON.stringify(gc, null, 2));
		} catch (_) {
			lines.push(String(gc));
		}
	} else {
		lines.push('(not loaded)');
	}

	return lines;
}
