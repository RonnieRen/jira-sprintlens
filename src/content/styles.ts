/**
 * styles.ts — Injects all panel CSS into the page as a <style> element.
 * Exports `jsrStyle` for use by the HTML export builder in render.ts.
 */

export const jsrStyle = document.createElement('style');
jsrStyle.textContent = `
#jsr-overlay {
  position: fixed; inset: 0; z-index: 100000;
  background: rgba(9,30,66,.54); display: none;
  align-items: flex-start; justify-content: center;
  padding-top: 100px; box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
#jsr-overlay.active { display: flex; }

#jsr-panel {
  background: #fff; border-radius: 12px; width: 920px; max-width: 94vw;
  max-height: 88vh; overflow: hidden; padding: 0;
  box-shadow: 0 8px 40px rgba(9,30,66,.25);
  display: flex; flex-direction: column;
}
#jsr-panel-header {
  padding: 24px 28px 16px; border-bottom: 1px solid #EBECF0;
  display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  cursor: grab; user-select: none;
}
#jsr-panel-header.dragging { cursor: grabbing; }
#jsr-panel-header h2 { margin: 0; font-size: 20px; color: #172B4D; }
#jsr-close {
  background: none; border: none; font-size: 22px; color: #6B778C;
  cursor: pointer; padding: 4px 8px; border-radius: 4px;
}
#jsr-close:hover { background: #EBECF0; }

.jsr-form { padding: 20px 28px; display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end; flex-shrink: 0; }
.jsr-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12px;
  font-weight: 600; color: #6B778C; text-transform: uppercase; letter-spacing: .5px; }
.jsr-form select, .jsr-form input {
  padding: 8px 12px; border: 2px solid #DFE1E6; border-radius: 6px;
  font-size: 14px; color: #172B4D; min-width: 180px; background: #FAFBFC;
  transition: border-color .15s;
}
.jsr-form select:focus, .jsr-form input:focus { border-color: #2684FF; outline: none; background: #fff; }
.jsr-btn {
  padding: 8px 20px; border: none; border-radius: 6px; font-size: 14px;
  font-weight: 600; cursor: pointer; transition: background .15s;
}
.jsr-btn-primary { background: #0052CC; color: #fff; }
.jsr-btn-primary:hover { background: #0065FF; }
.jsr-btn-primary:disabled { background: #B3D4FF; cursor: not-allowed; }
.jsr-btn-secondary { background: #EBECF0; color: #42526E; }
.jsr-btn-secondary:hover { background: #DFE1E6; }

#jsr-report { padding: 0 28px 28px; flex: 1; overflow-y: auto; min-height: 0; }
.jsr-loading { text-align: center; padding: 40px; color: #6B778C; font-size: 14px; }
.jsr-loading .spinner {
  display: inline-block; width: 28px; height: 28px; border: 3px solid #DFE1E6;
  border-top-color: #0052CC; border-radius: 50%;
  animation: jsr-spin .7s linear infinite; margin-bottom: 12px;
}
@keyframes jsr-spin { to { transform: rotate(360deg); } }

.jsr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
.jsr-stat-card {
  background: #F4F5F7; border-radius: 8px; padding: 16px; text-align: center;
  border-left: 4px solid #DFE1E6;
}
.jsr-stat-card .num { font-size: 28px; font-weight: 700; color: #172B4D; }
.jsr-stat-card .lbl { font-size: 12px; color: #6B778C; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
.jsr-stat-card.green  { border-left-color: #36B37E; }
.jsr-stat-card.red    { border-left-color: #FF5630; }
.jsr-stat-card.blue   { border-left-color: #0052CC; }
.jsr-stat-card.orange { border-left-color: #FF991F; }
.jsr-stat-card.purple { border-left-color: #6554C0; }
.jsr-stat-card.teal   { border-left-color: #00B8D9; }

.jsr-table-wrap { overflow-x: auto; margin-top: 16px; }
.jsr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.jsr-table th {
  text-align: left; padding: 10px 12px; background: #F4F5F7;
  color: #6B778C; font-weight: 600; font-size: 11px;
  text-transform: uppercase; letter-spacing: .5px;
  border-bottom: 2px solid #DFE1E6; position: sticky; top: 0;
}
.jsr-table td { padding: 10px 12px; border-bottom: 1px solid #EBECF0; color: #172B4D; }
.jsr-table tr:hover td { background: #F4F5F7; }
.jsr-tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; }
.jsr-tag-done    { background: #E3FCEF; color: #006644; }
.jsr-tag-todo    { background: #DEEBFF; color: #0747A6; }
.jsr-tag-inprog  { background: #EAE6FF; color: #403294; }
.jsr-tag-bug     { background: #FFEBE6; color: #BF2600; }
.jsr-tag-added   { background: #FFF0B3; color: #FF8B00; }
.jsr-tag-devdone { background: #E3FCEF; color: #006644; }
.jsr-row-devdone td { background: #E3FCEF; }

.jsr-section-title {
  font-size: 15px; font-weight: 700; color: #172B4D;
  margin: 24px 0 8px; padding-bottom: 8px; border-bottom: 2px solid #EBECF0;
}
.jsr-export-bar { display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end; }

/* ── Searchable Board Dropdown ── */
.jsr-search-wrap { position: relative; }
.jsr-search-wrap input.jsr-search-input {
  width: 100%; box-sizing: border-box; min-width: 240px;
  padding: 8px 32px 8px 12px;
}
.jsr-search-clear {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  background: none; border: none; font-size: 16px; color: #6B778C;
  cursor: pointer; padding: 0 4px; display: none; line-height: 1;
}
.jsr-search-clear:hover { color: #FF5630; }
.jsr-search-wrap.has-value .jsr-search-clear { display: block; }
.jsr-dropdown {
  position: fixed; z-index: 100001;
  background: #fff; border: 2px solid #2684FF; border-top: none;
  border-radius: 0 0 6px 6px; max-height: 280px; overflow-y: auto;
  box-shadow: 0 4px 12px rgba(9,30,66,.15); display: none;
}
.jsr-dropdown.open { display: block; }
.jsr-dropdown-item {
  padding: 8px 12px; cursor: pointer; font-size: 13px; color: #172B4D;
  border-bottom: 1px solid #F4F5F7; transition: background .1s;
  display: flex; align-items: center; justify-content: space-between;
}
.jsr-dropdown-item:hover, .jsr-dropdown-item.active { background: #DEEBFF; }
.jsr-board-type {
  font-size: 11px; color: #6B778C; margin-left: 6px;
}
.jsr-dropdown-empty {
  padding: 16px 12px; text-align: center; color: #6B778C; font-size: 13px;
}
.jsr-dropdown-count {
  padding: 6px 12px; font-size: 11px; color: #6B778C;
  border-bottom: 1px solid #F4F5F7; font-weight: 600;
}

/* ── Sprint Dropdown ── */
.jsr-sprint-wrap { position: relative; }
.jsr-sprint-input {
  width: 100%; box-sizing: border-box; min-width: 240px;
  padding: 8px 32px 8px 12px;
}
.jsr-sprint-clear {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  background: none; border: none; font-size: 16px; color: #6B778C;
  cursor: pointer; padding: 0 4px; display: none; line-height: 1;
}
.jsr-sprint-clear:hover { color: #FF5630; }
.jsr-sprint-wrap.has-value .jsr-sprint-clear { display: block; }
#jsr-sprint-dropdown {
  position: fixed; z-index: 100001;
  background: #fff; border: 2px solid #2684FF; border-top: none;
  border-radius: 0 0 6px 6px; max-height: 300px; overflow-y: auto;
  box-shadow: 0 4px 12px rgba(9,30,66,.15); display: none; min-width: 300px;
}
#jsr-sprint-dropdown.open { display: block; }
.jsr-sprint-item {
  padding: 8px 12px; cursor: pointer; font-size: 13px; color: #172B4D;
  border-bottom: 1px solid #F4F5F7; transition: background .1s;
  display: flex; align-items: center; justify-content: space-between;
}
.jsr-sprint-item:hover, .jsr-sprint-item.active { background: #DEEBFF; }
.jsr-sprint-meta { font-size: 11px; color: #6B778C; }
.jsr-sprint-active-dot {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #36B37E; margin-right: 6px; vertical-align: middle;
}
.jsr-sprint-year-header {
  padding: 6px 12px; font-size: 11px; font-weight: 700;
  color: #6B778C; text-transform: uppercase; letter-spacing: .5px;
  background: #F4F5F7; position: sticky; top: 0;
}
.jsr-sprint-load-more {
  padding: 8px 12px; text-align: center; color: #0052CC;
  font-size: 12px; cursor: pointer; border-top: 1px solid #F4F5F7;
}
.jsr-sprint-load-more:hover { background: #F4F5F7; }
.jsr-sprint-loading-more {
  padding: 8px 12px; text-align: center; color: #6B778C; font-size: 12px;
}

#jsr-assignee {
  padding: 8px 12px; border: 2px solid #DFE1E6; border-radius: 6px;
  font-size: 14px; color: #172B4D; background: #FAFBFC; outline: none; width: 100%;
  transition: border-color .15s;
}
#jsr-assignee:focus { border-color: #2684FF; background: #fff; }
`;

document.head.appendChild(jsrStyle);
