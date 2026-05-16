/**
 * Animation utilities for reusable tween logic
 */

/**
 * Animates a number from startValue to targetValue, updating a text object
 * Works for both counting up and counting down (if targetValue < startValue)
 * Generic and reusable for any number animation
 * @param {Phaser.Scene} scene - The Phaser scene to use for tweens
 * @param {Phaser.GameObjects.Text} textObject - The text object to update
 * @param {number} targetValue - The target number to animate to
 * @param {number} duration - Duration of the animation in milliseconds (default: 1000)
 * @param {Object} options - Optional settings
 * @param {number} options.startValue - Starting value for the animation (default: 0)
 * @param {Function} options.formatter - Optional formatter function to format the number before setting text (default: toLocaleString)
 * @param {Function} options.onUpdate - Optional callback function called on each update with the current value
 * @param {Function} options.onComplete - Optional callback function when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween object
 */
export function animateNumber(scene, textObject, targetValue, duration = 1000, options = {}) {
    const { 
        startValue = 0, 
        formatter = (val) => Math.floor(val).toLocaleString(),
        onUpdate = null,
        onComplete = null 
    } = options;

    const score = { value: startValue };

    const tween = scene.tweens.add({
        targets: score,
        value: targetValue,
        duration: duration,
        onUpdate: () => {
            const formatted = formatter(score.value);
            textObject.setText(formatted);
            
            if (onUpdate) {
                onUpdate(score.value);
            }
        },
        onComplete: () => {
            if (onComplete) {
                onComplete();
            }
        }
    });

    return tween;
}

/**
 * Animates a game object's scale from 0 to 1 with an easeOutBack easing
 * Useful for pop-in animations when objects appear
 * @param {Phaser.Scene} scene - The Phaser scene to use for tweens
 * @param {Phaser.GameObjects.GameObject} gameObject - The game object to animate
 * @param {number} duration - Duration of the animation in milliseconds (default: 600)
 * @param {Object} options - Optional settings
 * @param {number} options.startScale - Starting scale value (default: 0)
 * @param {number} options.targetScale - Target scale value (default: 1)
 * @param {number} options.delay - Delay before animation starts in milliseconds (default: 0)
 * @param {Function} options.onComplete - Optional callback function when animation completes
 * @returns {Phaser.Tweens.Tween} The created tween object
 */
export function animateScaleIn(scene, gameObject, duration = 600, options = {}) {
    const {
        startScale = 0,
        targetScale = 1,
        delay = 0,
        onComplete = null
    } = options;

    // Set initial scale
    gameObject.setScale(startScale);

    const tween = scene.tweens.add({
        targets: gameObject,
        scaleX: targetScale,
        scaleY: targetScale,
        duration: duration,
        delay: delay,
        ease: 'Back.easeOut',
        onComplete: () => {
            if (onComplete) {
                onComplete();
            }
        }
    });

    return tween;
}

