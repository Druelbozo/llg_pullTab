/**
 * Performance Tracker
 * Tracks timing information for debugging preloader and other performance issues
 */

import { debug, warn } from '../logger/LoggerUtils.js';

// Performance marks and measures
const performanceMarks = [];
const performanceMeasures = [];
const customStats = {};

/**
 * Mark a performance point
 * @param {string} name - Name of the mark
 */
export function mark(name) {
	const timestamp = performance.now();
	const wallTime = Date.now();
	
	performanceMarks.push({
		name,
		timestamp,
		wallTime
	});
	
	// Also use browser Performance API if available
	if (typeof performance !== 'undefined' && performance.mark) {
		try {
			performance.mark(name);
		} catch (e) {
			// Ignore if mark already exists
		}
	}
	
	debug(`[Perf] Mark: ${name} @ ${timestamp.toFixed(2)}ms`, 'assets');
}

/**
 * Measure time between two marks
 * @param {string} name - Name of the measure
 * @param {string} startMark - Name of the start mark
 * @param {string} endMark - Name of the end mark (optional, defaults to now)
 */
export function measure(name, startMark, endMark = null) {
	const start = performanceMarks.find(m => m.name === startMark);
	if (!start) {
		warn(`[Perf] Start mark '${startMark}' not found for measure '${name}'`, 'assets');
		return null;
	}
	
	let end;
	if (endMark) {
		end = performanceMarks.find(m => m.name === endMark);
		if (!end) {
			warn(`[Perf] End mark '${endMark}' not found for measure '${name}'`, 'assets');
			return null;
		}
	} else {
		// Measure to now
		const now = performance.now();
		end = { timestamp: now, wallTime: Date.now() };
	}
	
	const duration = end.timestamp - start.timestamp;
	const wallDuration = end.wallTime - start.wallTime;
	
	performanceMeasures.push({
		name,
		startMark,
		endMark: endMark || 'now',
		duration,
		wallDuration,
		startTime: start.timestamp,
		endTime: end.timestamp
	});
	
	debug(`[Perf] Measure: ${name} = ${duration.toFixed(2)}ms (wall: ${wallDuration}ms)`, 'assets');
	
	return duration;
}

/**
 * Set a custom stat for debug display (e.g. preflight request count)
 * @param {string} key - Stat key
 * @param {*} value - Stat value
 */
export function setCustomStat(key, value) {
	customStats[key] = value;
}

/**
 * Get all custom stats
 * @returns {Object} Copy of custom stats
 */
export function getCustomStats() {
	return { ...customStats };
}

/**
 * Get all performance marks
 * @returns {Array} Array of mark objects
 */
export function getMarks() {
	return [...performanceMarks];
}

/**
 * Get all performance measures
 * @returns {Array} Array of measure objects
 */
export function getMeasures() {
	return [...performanceMeasures];
}

/**
 * Get performance summary as formatted text
 * @returns {string} Formatted performance summary
 */
export function getPerformanceSummary() {
	const lines = [];
	lines.push('=== PERFORMANCE SUMMARY ===');
	lines.push('');
	
	// Show marks in chronological order
	if (performanceMarks.length > 0) {
		lines.push('--- Marks (Chronological) ---');
		const sortedMarks = [...performanceMarks].sort((a, b) => a.timestamp - b.timestamp);
		sortedMarks.forEach((mark, index) => {
			const timeFromStart = mark.timestamp - (sortedMarks[0]?.timestamp || 0);
			lines.push(`${index + 1}. ${mark.name}: ${mark.timestamp.toFixed(2)}ms (+${timeFromStart.toFixed(2)}ms from start)`);
		});
		lines.push('');
	}
	
	// Show measures
	if (performanceMeasures.length > 0) {
		lines.push('--- Measures (Duration) ---');
		const sortedMeasures = [...performanceMeasures].sort((a, b) => b.duration - a.duration);
		sortedMeasures.forEach((measure, index) => {
			lines.push(`${index + 1}. ${measure.name}: ${measure.duration.toFixed(2)}ms`);
			lines.push(`   (${measure.startMark} → ${measure.endMark})`);
		});
		lines.push('');
	}
	
	// Calculate total time if we have marks
	if (performanceMarks.length >= 2) {
		const firstMark = performanceMarks[0];
		const lastMark = performanceMarks[performanceMarks.length - 1];
		const totalTime = lastMark.timestamp - firstMark.timestamp;
		lines.push(`--- Total Time ---`);
		lines.push(`From first mark to last: ${totalTime.toFixed(2)}ms`);
		lines.push('');
	}
	
	return lines.join('\n');
}

/**
 * Clear performance data
 */
export function clear() {
	performanceMarks.length = 0;
	performanceMeasures.length = 0;
	Object.keys(customStats).forEach(k => delete customStats[k]);
}

