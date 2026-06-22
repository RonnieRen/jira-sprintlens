/**
 * content.ts — Content script entry point for Jira SprintLens.
 *
 * Import order matters: styles → panel (builds DOM) → events (wires handlers)
 * panel.ts sets window.__JSR_LOADED__ to prevent duplicate DOM init on re-inject.
 * events.ts registers board/sprint change handlers via setOnBoardChange/setOnSprintChange.
 */

import './styles';
import './panel';
import { initEvents } from './events';

// Wire up event handlers now that panel DOM is guaranteed to exist
initEvents();
