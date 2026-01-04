import Level from "./scenes/Level.js";
import Preload from "./scenes/Preload.js";
import ResizeHandler from "./utils/game/ResizeHandler.js";
import ViewportHelper from "./utils/ui/ViewportHelper.js";

window.addEventListener('load', function () {

	let initialWidth = ViewportHelper.getWidth();
	let initialHeight = ViewportHelper.getHeight();

	if (initialWidth < 100 || initialHeight < 100)
	{
		initialWidth = window.innerWidth;
		initialHeight = window.innerHeight;
	}

	var game = new Phaser.Game
	({
		width: initialWidth,
		height: initialHeight,
		type: Phaser.AUTO,
        backgroundColor: "#242424",
		parent: 'game-container',
		scale: {
			mode: Phaser.Scale.RESIZE,
			autoCenter: Phaser.Scale.CENTER_BOTH
		},
		physics: {
			default: 'arcade',
			arcade: {
				debug: false,
				gravity: {
					x: 0, y: 0
				}
			}
		},
		dom:{
    			createContainer: true,
			}
	});

	game.global =
	{
		referenceScreenWidth: 1920,
		referenceScreenHeight: 1080
	};

	const ensureCorrectSize = () =>
	{
		const viewportWidth = ViewportHelper.getWidth();
		const viewportHeight = ViewportHelper.getHeight();
		if (game.scale.width !== viewportWidth || game.scale.height !== viewportHeight) {
			game.scale.resize(viewportWidth, viewportHeight);
			game.scale.refresh();
		}
	};

	ensureCorrectSize();
	setTimeout(ensureCorrectSize, 50);
	setTimeout(ensureCorrectSize, 200);

	const onChangeScreen = () => 
	{
		// ResizeHandler already calls game.scale.resize(), so we just need to handle scene-specific logic
    	if (game.scene.scenes.length > 0)
		{
			let currentScene = game.scene.scenes[0];
			if (currentScene instanceof Level && typeof currentScene.resize === 'function')
			{
				currentScene.resize();
			}
		}
	}

	const resizeHandler = new ResizeHandler(game, {
		enableLogging: false, // Set to true for debugging
		pollingInterval: 250,
		focusDelay: 100
	});

	game.scale.on('resize', onChangeScreen);

	game.scene.add("Preload", Preload);
	game.scene.add("Level", Level);
	game.scene.add("Boot", Boot, true);
});

class Boot extends Phaser.Scene {

	preload() {
		
		this.load.pack("pack", "assets/preload-asset-pack.json");
	}

	create() {

		this.scene.start("Preload");
	}
}