// DOM references
const statusLabel = document.getElementById('status');
const versionLabel = document.getElementById('version');
const tabBar = document.getElementById('tabBar');
const workspace = document.getElementById('workspace');
const dropIndicator = document.getElementById('dropIndicator');

const openButton = document.getElementById('openBtn');
const saveButton = document.getElementById('saveBtn');
const undoButton = document.getElementById('undoBtn');
const redoButton = document.getElementById('redoBtn');
const printButton = document.getElementById('printBtn');
const exportButton = document.getElementById('exportBtn');
const sourceButton = document.getElementById('sourceBtn');
const splitButton = document.getElementById('splitBtn');

const formatBar = document.getElementById('formatBar');
const formatToggle = document.getElementById('formatToggle');
const helpToggle = document.getElementById('helpToggle');
const helpDropdown = document.getElementById('helpDropdown');
const iconButton = document.getElementById('iconBtn');
const emojiPicker = document.getElementById('emojiPicker');
const languageList = document.getElementById('languageList');
const langButton = document.getElementById('langBtn');
const langDropdown = document.getElementById('langDropdown');

// The two document views (left and right), each with its own source + preview.
const views = {};
document.querySelectorAll('.doc-view').forEach((root) => {
  const side = root.dataset.side;
  views[side] = {
    side,
    root,
    editor: root.querySelector('.editor'),
    preview: root.querySelector('.preview')
  };
});

// Translation strings for the active locale, loaded from the main process.
let i18nStrings = {};

// Last detected update info, kept so its menu label can be re-translated.
let pendingUpdateInfo = null;

// Translate a key, replacing {placeholders} with the given params.
function t(key, params) {
  let text = i18nStrings[key] != null ? i18nStrings[key] : key;
  if (params) {
    Object.keys(params).forEach((name) => {
      text = text.split('{' + name + '}').join(params[name]);
    });
  }
  return text;
}

// Apply the loaded strings to every element carrying a data-i18n* attribute.
function applyTranslations() {
  // Set the text direction (right-to-left for languages such as Arabic).
  document.documentElement.dir = i18nStrings['lang.dir'] === 'rtl' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
}

// Converts the edited preview HTML back into Markdown.
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

// Keep video and iframe tags as raw HTML so they survive the HTML/Markdown
// round-trip (Markdown has no native syntax for them).
turndownService.keep(['video', 'iframe']);

// Application state.
// Each tab is an object: { filePath, content, isModified, history, historyIndex }
let openTabs = [];

// Which open tab is shown in each pane (-1 = none). The right pane is only used
// while the workspace is split.
const paneTab = { left: -1, right: -1 };

// Whether the two-document side-by-side view is active.
let splitActive = false;

// The pane the toolbar, save, undo/redo and formatting commands act on.
let focusedSide = 'left';

// Timer handle used to debounce writing the session to disk while typing.
let sessionSaveTimer = null;

// Timer handles used to debounce recording undo history, one per pane.
const historyTimers = { left: null, right: null };

// Timer used to restore the status bar after a transient message.
let statusResetTimer = null;

// Tab index currently being dragged (-1 = none).
let draggedTabIndex = -1;

// --- Small accessors ------------------------------------------------------

function tabAt(index) {
  return index >= 0 && index < openTabs.length ? openTabs[index] : null;
}

// The active tab is the one shown in the focused pane.
function getActiveTab() {
  return tabAt(paneTab[focusedSide]);
}

function getFocusedView() {
  return views[focusedSide];
}

// The preview element of the focused view (target of formatting commands).
function focusedPreview() {
  return getFocusedView().preview;
}

// Find the first open tab whose index differs from the given one.
function firstOtherTab(exceptIndex) {
  for (let i = 0; i < openTabs.length; i++) {
    if (i !== exceptIndex) return i;
  }
  return -1;
}

// Extract the file name from a full path for display in the tab.
function getFileName(filePath) {
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] || filePath;
}

// Find the index of an open tab by its file path, or -1 when not open.
function findTabByPath(filePath) {
  return openTabs.findIndex((tab) => tab.filePath === filePath);
}

// --- Rendering ------------------------------------------------------------

// Render the given pane's editor and preview from the tab it shows.
function renderPane(side) {
  const view = views[side];
  const tab = tabAt(paneTab[side]);

  if (tab) {
    if (view.editor.value !== tab.content) view.editor.value = tab.content;
    view.preview.innerHTML = marked.parse(tab.content);
  } else {
    view.editor.value = '';
    view.preview.innerHTML = '';
  }
}

// Re-render both panes from their tabs.
function renderPanes() {
  renderPane('left');
  renderPane('right');
}

// Reflect the split state and focused pane on the document body/elements.
function updateLayout() {
  if (!splitActive) focusedSide = 'left';

  document.body.classList.toggle('split-view', splitActive);
  splitButton.classList.toggle('active', splitActive);

  Object.keys(views).forEach((side) => {
    const isFocused = side === focusedSide && (splitActive || side === 'left');
    views[side].root.classList.toggle('focused', isFocused);
  });
}

// Update the status bar for the focused tab.
function refreshStatus() {
  const tab = getActiveTab();
  statusLabel.textContent = tab
    ? tab.isModified
      ? t('status.modified', { path: tab.filePath })
      : t('status.open', { path: tab.filePath })
    : t('status.noFile');
}

// Show a transient status message, then restore the normal status.
function flashStatus(message) {
  statusLabel.textContent = message;
  if (statusResetTimer !== null) clearTimeout(statusResetTimer);
  statusResetTimer = setTimeout(() => {
    statusResetTimer = null;
    refreshStatus();
  }, 1800);
}

// Rebuild the tab bar from the current list of open tabs.
function renderTabBar() {
  tabBar.innerHTML = '';

  openTabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');

    let className = 'tab';
    if (!splitActive) {
      if (index === paneTab.left) className += ' active';
    } else if (index === paneTab[focusedSide]) {
      className += ' active';
    } else if (index === paneTab.left || index === paneTab.right) {
      className += ' shown';
    }
    tabElement.className = className;
    tabElement.draggable = true;

    tabElement.addEventListener('dragstart', (event) => {
      draggedTabIndex = index;
      tabElement.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    tabElement.addEventListener('dragend', () => {
      draggedTabIndex = -1;
      tabElement.classList.remove('dragging');
      hideDropIndicator();
    });

    const titleElement = document.createElement('span');
    titleElement.className = 'tab-title';
    titleElement.textContent = (tab.isModified ? '* ' : '') + getFileName(tab.filePath);
    titleElement.title = tab.filePath;
    titleElement.addEventListener('click', () => showTab(focusedSide, index));
    titleElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openTabMenu(event, index);
    });

    const closeElement = document.createElement('span');
    closeElement.className = 'tab-close';
    closeElement.textContent = '×';
    closeElement.title = t('tab.close');
    closeElement.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTab(index);
    });

    tabElement.appendChild(titleElement);
    tabElement.appendChild(closeElement);
    tabBar.appendChild(tabElement);
  });
}

// Apply every derived view after a structural change (tab switch, split, etc.).
function syncEverything() {
  if (!splitActive) focusedSide = 'left';
  updateLayout();
  renderTabBar();
  renderPanes();
  refreshStatus();
  updateUndoRedoButtons();
  scheduleSessionSave();
}

// --- Tab / split assignment -----------------------------------------------

// Show a tab in a pane (used by clicks and by opening files). Clicking the left
// pane just switches the active file; switching the right pane creates a split.
function showTab(side, index) {
  if (index < 0 || index >= openTabs.length) return;

  if (!splitActive) {
    if (side === 'left') {
      paneTab.left = index;
      focusedSide = 'left';
    } else {
      // Create a split with the requested tab on the right.
      let leftIndex = paneTab.left;
      if (leftIndex === index || leftIndex < 0) {
        leftIndex = firstOtherTab(index);
        if (leftIndex === -1) {
          flashStatus(t('split.needTwo'));
          return;
        }
      }
      paneTab.left = leftIndex;
      paneTab.right = index;
      splitActive = true;
      focusedSide = 'right';
    }
  } else {
    const opposite = side === 'left' ? 'right' : 'left';
    // Keep the two panes on distinct tabs: swap when needed.
    if (paneTab[opposite] === index) paneTab[opposite] = paneTab[side];
    paneTab[side] = index;
    focusedSide = side;
  }

  syncEverything();
}

// Assign a dragged tab to a side, creating a split when one is not active yet.
function dropTab(side, index) {
  if (index < 0 || index >= openTabs.length) return;

  if (!splitActive) {
    // The dragged tab goes to `side`; the previously active tab fills the other.
    const previous = paneTab.left;
    const other = previous === index || previous < 0 ? firstOtherTab(index) : previous;
    if (other === -1) {
      flashStatus(t('split.needTwo'));
      return;
    }
    if (side === 'left') {
      paneTab.left = index;
      paneTab.right = other;
    } else {
      paneTab.right = index;
      paneTab.left = other;
    }
    splitActive = true;
    focusedSide = side;
  } else {
    const opposite = side === 'left' ? 'right' : 'left';
    if (paneTab[opposite] === index) paneTab[opposite] = paneTab[side];
    paneTab[side] = index;
    focusedSide = side;
  }

  syncEverything();
}

// Toggle the two-document split view on or off.
function toggleSplit() {
  if (splitActive) {
    splitActive = false;
    paneTab.right = -1;
    focusedSide = 'left';
  } else {
    if (openTabs.length < 2) {
      flashStatus(t('split.needTwo'));
      return;
    }
    paneTab.right = firstOtherTab(paneTab.left);
    splitActive = true;
    focusedSide = 'right';
  }
  syncEverything();
}

// Open a file in a tab. If it is already open, show that tab instead.
function openTab(filePath, content) {
  const existingIndex = findTabByPath(filePath);
  if (existingIndex !== -1) {
    showTab(focusedSide, existingIndex);
    return;
  }

  openTabs.push({
    filePath,
    content,
    isModified: false,
    history: [content],
    historyIndex: 0
  });
  showTab(focusedSide, openTabs.length - 1);
}

// Close the tab at the given index, keeping both panes on valid tabs.
// When the file has unsaved changes, ask the user what to do first.
// Returns true when the tab was closed, false when the user cancelled.
async function closeTab(index) {
  const tab = openTabs[index];
  if (tab && tab.isModified) {
    const choice = await window.api.confirmSave(getFileName(tab.filePath));
    if (choice === 'cancel') return false;
    if (choice === 'save') {
      const result = await window.api.saveFile(tab.filePath, tab.content);
      if (result.error) {
        flashStatus(t('status.saveError', { msg: result.error }));
        return false;
      }
    }
  }

  openTabs.splice(index, 1);
  const remaining = openTabs.length;

  // Shift pane indices; mark a pane as orphaned (-2) when its tab was removed.
  ['left', 'right'].forEach((side) => {
    if (paneTab[side] === index) paneTab[side] = -2;
    else if (paneTab[side] > index) paneTab[side] -= 1;
  });

  if (remaining === 0) {
    paneTab.left = -1;
    paneTab.right = -1;
    splitActive = false;
  } else {
    // Closing the right tab collapses the split.
    if (paneTab.right === -2) {
      splitActive = false;
      paneTab.right = -1;
    }
    // Closing the left tab promotes the right one, or falls back to a neighbour.
    if (paneTab.left === -2) {
      if (splitActive && paneTab.right >= 0) {
        paneTab.left = paneTab.right;
        paneTab.right = -1;
        splitActive = false;
      } else {
        paneTab.left = Math.min(index, remaining - 1);
      }
    }
    // A split needs two distinct, valid tabs.
    if (splitActive && (paneTab.right < 0 || paneTab.right >= remaining || paneTab.right === paneTab.left)) {
      splitActive = false;
      paneTab.right = -1;
    }
    if (remaining < 2) {
      splitActive = false;
      paneTab.right = -1;
    }
  }

  if (!splitActive) focusedSide = 'left';
  syncEverything();
  return true;
}

// Close a set of tabs (given as tab objects). Indices are resolved fresh each
// step, since closing one shifts the others. Stops if the user cancels.
async function closeTabs(targets) {
  for (const target of targets) {
    const index = openTabs.indexOf(target);
    if (index === -1) continue;
    const closed = await closeTab(index);
    if (!closed) break;
  }
}

// --- Tab context menu (right-click on a tab) ------------------------------

let tabMenuElement = null;

// Remove the tab context menu if it is open.
function closeTabMenu() {
  if (tabMenuElement) {
    tabMenuElement.remove();
    tabMenuElement = null;
  }
}

// Show the right-click menu for the tab at the given index.
function openTabMenu(event, index) {
  closeTabMenu();

  const items = [
    { label: t('tab.close'), targets: [openTabs[index]] },
    { label: t('tab.closeOthers'), targets: openTabs.filter((_, i) => i !== index) },
    { label: t('tab.closeRight'), targets: openTabs.filter((_, i) => i > index) },
    { label: t('tab.closeLeft'), targets: openTabs.filter((_, i) => i < index) },
    { label: t('tab.closeAll'), targets: openTabs.slice() }
  ];

  const menu = document.createElement('div');
  menu.className = 'tab-menu';
  menu.addEventListener('click', (clickEvent) => clickEvent.stopPropagation());

  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    button.disabled = item.targets.length === 0;
    button.addEventListener('click', () => {
      closeTabMenu();
      closeTabs(item.targets);
    });
    menu.appendChild(button);
  });

  document.body.appendChild(menu);

  // Keep the menu inside the viewport.
  const menuRect = menu.getBoundingClientRect();
  const margin = 6;
  let left = event.clientX;
  let top = event.clientY;
  if (left + menuRect.width > window.innerWidth - margin) {
    left = window.innerWidth - menuRect.width - margin;
  }
  if (top + menuRect.height > window.innerHeight - margin) {
    top = window.innerHeight - menuRect.height - margin;
  }
  menu.style.left = Math.max(margin, left) + 'px';
  menu.style.top = Math.max(margin, top) + 'px';

  tabMenuElement = menu;
}

// Dismiss the menu on Escape or when the window scrolls/resizes.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeTabMenu();
});
window.addEventListener('resize', closeTabMenu);

// --- Session persistence --------------------------------------------------

// Build a serialisable snapshot of the current session.
function buildSessionSnapshot() {
  return {
    tabs: openTabs.map((tab) => ({ filePath: tab.filePath, content: tab.content })),
    activeTabIndex: paneTab.left,
    split: splitActive
      ? { active: true, left: paneTab.left, right: paneTab.right, focused: focusedSide }
      : { active: false }
  };
}

// Persist the session to disk, debounced to avoid frequent writes while typing.
function scheduleSessionSave() {
  if (sessionSaveTimer !== null) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    sessionSaveTimer = null;
    window.api.saveSession(buildSessionSnapshot());
  }, 400);
}

// --- Undo / redo ----------------------------------------------------------

// Maximum number of undo states kept per tab.
const MAX_HISTORY = 100;

// Enable or disable the undo/redo buttons for the focused tab.
function updateUndoRedoButtons() {
  const tab = getActiveTab();
  undoButton.disabled = !tab || tab.historyIndex <= 0;
  redoButton.disabled = !tab || tab.historyIndex >= tab.history.length - 1;
}

// Record the current content of the given tab as a new undo state.
function recordHistory(index) {
  const tab = tabAt(index);
  if (!tab) return;
  if (tab.history[tab.historyIndex] === tab.content) return;

  // Drop any redo states, then push the new one.
  tab.history = tab.history.slice(0, tab.historyIndex + 1);
  tab.history.push(tab.content);
  tab.historyIndex = tab.history.length - 1;

  if (tab.history.length > MAX_HISTORY) {
    tab.history.shift();
    tab.historyIndex -= 1;
  }

  if (index === paneTab[focusedSide]) updateUndoRedoButtons();
}

// Record history for a pane after a short pause, so a burst of typing is one step.
function scheduleHistory(side) {
  if (historyTimers[side] !== null) clearTimeout(historyTimers[side]);
  historyTimers[side] = setTimeout(() => {
    historyTimers[side] = null;
    recordHistory(paneTab[side]);
  }, 500);
}

// Make sure any pending edit is recorded before an undo/redo step.
function flushHistory(side) {
  if (historyTimers[side] !== null) {
    clearTimeout(historyTimers[side]);
    historyTimers[side] = null;
    recordHistory(paneTab[side]);
  }
}

// Apply the tab content (after an undo/redo) to a pane's editor and preview.
function applyHistoryState(side) {
  const tab = tabAt(paneTab[side]);
  if (!tab) return;
  tab.content = tab.history[tab.historyIndex];
  tab.isModified = true;
  views[side].editor.value = tab.content;
  views[side].preview.innerHTML = marked.parse(tab.content);
  renderTabBar();
  if (side === focusedSide) {
    refreshStatus();
    updateUndoRedoButtons();
  }
  scheduleSessionSave();
}

// Undo: step back to the previous content state in the focused pane.
function undo() {
  const side = focusedSide;
  const tab = tabAt(paneTab[side]);
  if (!tab) return;
  flushHistory(side);
  if (tab.historyIndex <= 0) return;
  tab.historyIndex -= 1;
  applyHistoryState(side);
}

// Redo: step forward to the next content state in the focused pane.
function redo() {
  const side = focusedSide;
  const tab = tabAt(paneTab[side]);
  if (!tab) return;
  flushHistory(side);
  if (tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex += 1;
  applyHistoryState(side);
}

undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);

// --- Session restore ------------------------------------------------------

// Restore the previous session on startup.
// Files that no longer exist are already filtered out by the main process.
async function restoreSession() {
  const session = await window.api.loadSession();

  if (session && Array.isArray(session.tabs) && session.tabs.length > 0) {
    openTabs = session.tabs.map((tab) => ({
      filePath: tab.filePath,
      content: tab.content,
      isModified: false,
      history: [tab.content],
      historyIndex: 0
    }));

    const restoredIndex = session.activeTabIndex;
    paneTab.left =
      typeof restoredIndex === 'number' && restoredIndex >= 0 && restoredIndex < openTabs.length
        ? restoredIndex
        : 0;

    // Restore the split layout only when it is still consistent.
    const split = session.split;
    if (
      split &&
      split.active &&
      Number.isInteger(split.left) &&
      Number.isInteger(split.right) &&
      split.left >= 0 &&
      split.left < openTabs.length &&
      split.right >= 0 &&
      split.right < openTabs.length &&
      split.left !== split.right
    ) {
      paneTab.left = split.left;
      paneTab.right = split.right;
      splitActive = true;
      focusedSide = split.focused === 'right' ? 'right' : 'left';
    }
  }

  syncEverything();
}

// --- Live editing ---------------------------------------------------------

// Source textarea edited: store the text and refresh that pane's preview.
function onEditorInput(side) {
  const tab = tabAt(paneTab[side]);
  if (!tab) return;

  tab.content = views[side].editor.value;
  tab.isModified = true;
  views[side].preview.innerHTML = marked.parse(tab.content);
  renderTabBar();
  if (side === focusedSide) refreshStatus();
  scheduleSessionSave();
  scheduleHistory(side);
}

// Rendered preview edited: convert its HTML back to Markdown and store it.
// The preview is intentionally not re-rendered here, so the caret is preserved.
function onPreviewInput(side) {
  const tab = tabAt(paneTab[side]);
  if (!tab) return;

  const markdown = turndownService.turndown(views[side].preview.innerHTML);
  tab.content = markdown;
  tab.isModified = true;
  views[side].editor.value = markdown;
  renderTabBar();
  if (side === focusedSide) refreshStatus();
  scheduleSessionSave();
  scheduleHistory(side);
}

// Wire up input and focus handlers for both panes.
Object.keys(views).forEach((side) => {
  const view = views[side];
  view.editor.addEventListener('input', () => onEditorInput(side));
  view.preview.addEventListener('input', () => onPreviewInput(side));

  // Clicking/typing into a pane makes it the focused one while split.
  view.root.addEventListener('focusin', () => {
    if (splitActive && focusedSide !== side) {
      focusedSide = side;
      updateLayout();
      renderTabBar();
      refreshStatus();
      updateUndoRedoButtons();
    }
  });
});

// --- Drag and drop of tabs onto the workspace -----------------------------

// Decide which half of the workspace the pointer is over.
function sideFromEvent(event) {
  const rect = workspace.getBoundingClientRect();
  return event.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
}

function showDropIndicator(side) {
  dropIndicator.classList.remove('hidden', 'left', 'right');
  dropIndicator.classList.add(side);
}

function hideDropIndicator() {
  dropIndicator.classList.add('hidden');
}

workspace.addEventListener('dragover', (event) => {
  if (draggedTabIndex < 0) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  showDropIndicator(sideFromEvent(event));
});

workspace.addEventListener('dragleave', (event) => {
  // Hide only when the pointer actually leaves the workspace.
  if (!workspace.contains(event.relatedTarget)) hideDropIndicator();
});

workspace.addEventListener('drop', (event) => {
  if (draggedTabIndex < 0) return;
  event.preventDefault();
  const side = sideFromEvent(event);
  const index = draggedTabIndex;
  draggedTabIndex = -1;
  hideDropIndicator();
  dropTab(side, index);
});

// --- Formatting on the focused preview ------------------------------------

// Wrap the current selection inside the preview in an inline <code> element.
function wrapSelectionInCode() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const codeElement = document.createElement('code');
  codeElement.appendChild(range.extractContents());
  range.insertNode(codeElement);
}

// Apply a formatting command to the focused (editable) preview, then sync.
function applyFormat(command) {
  if (!getActiveTab()) return;
  focusedPreview().focus();

  switch (command) {
    case 'h1': document.execCommand('formatBlock', false, 'H1'); break;
    case 'h2': document.execCommand('formatBlock', false, 'H2'); break;
    case 'h3': document.execCommand('formatBlock', false, 'H3'); break;
    case 'paragraph': document.execCommand('formatBlock', false, 'P'); break;
    case 'bold': document.execCommand('bold'); break;
    case 'italic': document.execCommand('italic'); break;
    case 'unorderedList': document.execCommand('insertUnorderedList'); break;
    case 'orderedList': document.execCommand('insertOrderedList'); break;
    case 'quote': document.execCommand('formatBlock', false, 'BLOCKQUOTE'); break;
    case 'code': wrapSelectionInCode(); break;
    case 'link': document.execCommand('createLink', false, 'https://'); break;
    default: return;
  }

  onPreviewInput(focusedSide);
  updateActiveFormats();
}

// Convert a local file path into a file:// URL usable as a media source.
function pathToFileUrl(filePath) {
  let normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
  return 'file://' + encodeURI(normalizedPath);
}

// Let the user pick a media file and insert it into the focused preview.
async function insertMedia(mediaType) {
  if (!getActiveTab()) return;

  const filePath = await window.api.pickMedia(mediaType);
  if (!filePath) return;

  const fileUrl = pathToFileUrl(filePath);
  const fileName = getFileName(filePath);

  focusedPreview().focus();
  if (mediaType === 'video') {
    document.execCommand('insertHTML', false, '<video controls src="' + fileUrl + '"></video>');
  } else {
    // Images and icons are both inserted as standard inline images.
    document.execCommand('insertHTML', false, '<img src="' + fileUrl + '" alt="' + fileName + '">');
  }

  onPreviewInput(focusedSide);
}

// Handle clicks on the formatting and media control buttons.
formatBar.querySelector('.format-actions').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.media) {
    insertMedia(button.dataset.media);
  } else if (button.dataset.command) {
    applyFormat(button.dataset.command);
  }
});

// Collapse or expand the formatting controls.
formatToggle.addEventListener('click', () => {
  formatBar.classList.toggle('collapsed');
});

// --- Active-format highlighting -------------------------------------------

// Return true when the current selection is inside the given container.
function isSelectionInside(container) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  let node = selection.anchorNode;
  while (node) {
    if (node === container) return true;
    node = node.parentNode;
  }
  return false;
}

// Return which pane's preview holds the current selection, or null.
function previewSideForSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  let node = selection.anchorNode;
  while (node) {
    if (node === views.left.preview) return 'left';
    if (node === views.right.preview) return 'right';
    node = node.parentNode;
  }
  return null;
}

// Return true when the selection has an ancestor element with the given tag,
// stopping at the given preview root.
function selectionHasAncestorTag(tagName, root) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  let node = selection.anchorNode;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === tagName) return true;
    node = node.parentNode;
  }
  return false;
}

// Toggle the active state of the control button bound to the given command.
function setControlActive(command, isActive) {
  const button = formatBar.querySelector('button[data-command="' + command + '"]');
  if (button) button.classList.toggle('active', isActive);
}

// Highlight the controls matching the formatting of the current selection.
function updateActiveFormats() {
  const side = previewSideForSelection();
  if (!side) return;
  const root = views[side].preview;

  const isHeading1 = selectionHasAncestorTag('H1', root);
  const isHeading2 = selectionHasAncestorTag('H2', root);
  const isHeading3 = selectionHasAncestorTag('H3', root);
  const isQuote = selectionHasAncestorTag('BLOCKQUOTE', root);

  setControlActive('h1', isHeading1);
  setControlActive('h2', isHeading2);
  setControlActive('h3', isHeading3);
  setControlActive('quote', isQuote);
  setControlActive('code', selectionHasAncestorTag('CODE', root));
  setControlActive('link', selectionHasAncestorTag('A', root));

  // Plain paragraph is active only when no block-level tag applies.
  setControlActive('paragraph', !(isHeading1 || isHeading2 || isHeading3 || isQuote));

  setControlActive('bold', document.queryCommandState('bold'));
  setControlActive('italic', document.queryCommandState('italic'));
  setControlActive('unorderedList', document.queryCommandState('insertUnorderedList'));
  setControlActive('orderedList', document.queryCommandState('insertOrderedList'));
}

// Refresh the highlighted controls whenever the selection changes.
document.addEventListener('selectionchange', updateActiveFormats);

// --- Help and language menus ----------------------------------------------

// Open or close the help dropdown.
helpToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  langDropdown.classList.add('hidden');
  helpDropdown.classList.toggle('hidden');
});

// Run the matching help action.
helpDropdown.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-help]');
  if (!button) return;

  if (button.dataset.help === 'about') {
    window.api.showAbout();
  } else if (button.dataset.help === 'update') {
    window.api.openDownload();
  }

  helpDropdown.classList.add('hidden');
});

// Reveal the "Update" menu item only when a newer version is available.
window.api.onUpdateAvailable((info) => {
  pendingUpdateInfo = info;
  const updateItem = helpDropdown.querySelector('button[data-help="update"]');
  if (updateItem) {
    updateItem.hidden = false;
    updateItem.textContent = t('menu.updateWithVersion', { version: info.version });
  }
});

// Close the dropdowns and the tab menu when clicking anywhere else.
document.addEventListener('click', () => {
  helpDropdown.classList.add('hidden');
  emojiPicker.classList.add('hidden');
  langDropdown.classList.add('hidden');
  closeTabMenu();
});

// Open or close the language dropdown (showing the current language code).
langButton.addEventListener('click', (event) => {
  event.stopPropagation();
  helpDropdown.classList.add('hidden');
  langDropdown.classList.toggle('hidden');
});

// Keep clicks inside the language dropdown from closing it prematurely.
langDropdown.addEventListener('click', (event) => {
  event.stopPropagation();
});

// Toggle the split view from the toolbar button.
splitButton.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleSplit();
});

// --- Emoji picker ---------------------------------------------------------

// Emoji available in the "Icon" picker.
const EMOJIS = [
  '😀', '😄', '😁', '😆', '😅', '😂', '🙂', '😉',
  '😍', '😘', '😎', '🤔', '😴', '😇', '🥳', '😢',
  '😡', '👍', '👎', '👌', '🙏', '👏', '💪', '🤝',
  '❤️', '🔥', '⭐', '✨', '✅', '❌', '⚠️', '💡',
  '📌', '📎', '📁', '📄', '🔗', '🔍', '⏰', '📅',
  '🚀', '🎯', '🎉', '🐛', '💻', '⚙️', '🔧', '📝'
];

// Insert an emoji at the current caret position in the focused preview.
function insertEmoji(emoji) {
  if (!getActiveTab()) return;
  focusedPreview().focus();
  document.execCommand('insertText', false, emoji);
  onPreviewInput(focusedSide);
}

// Build the emoji grid once at startup.
EMOJIS.forEach((emoji) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = emoji;
  button.addEventListener('click', () => {
    insertEmoji(emoji);
    emojiPicker.classList.add('hidden');
  });
  emojiPicker.appendChild(button);
});

// Place the emoji picker next to its button while keeping it fully on screen.
function positionEmojiPicker() {
  const buttonRect = iconButton.getBoundingClientRect();
  const pickerWidth = emojiPicker.offsetWidth;
  const pickerHeight = emojiPicker.offsetHeight;
  const margin = 6;

  // Prefer opening below the button; flip above when there is no room.
  let top = buttonRect.bottom + 4;
  if (top + pickerHeight > window.innerHeight - margin) {
    top = buttonRect.top - pickerHeight - 4;
  }
  if (top < margin) top = margin;

  // Align with the button, then clamp to the window width.
  let left = buttonRect.left;
  if (left + pickerWidth > window.innerWidth - margin) {
    left = window.innerWidth - pickerWidth - margin;
  }
  if (left < margin) left = margin;

  emojiPicker.style.top = top + 'px';
  emojiPicker.style.left = left + 'px';
}

// Open or close the emoji picker, positioning it when it opens.
iconButton.addEventListener('click', (event) => {
  event.stopPropagation();

  const shouldOpen = emojiPicker.classList.contains('hidden');
  if (shouldOpen) {
    emojiPicker.classList.remove('hidden');
    positionEmojiPicker();
  } else {
    emojiPicker.classList.add('hidden');
  }
});

// Keep the open picker correctly placed when the window is resized.
window.addEventListener('resize', () => {
  if (!emojiPicker.classList.contains('hidden')) positionEmojiPicker();
});

// Keep clicks inside the picker from closing it through the document handler.
emojiPicker.addEventListener('click', (event) => {
  event.stopPropagation();
});

// --- File actions ---------------------------------------------------------

// Open: show the system file dialog and open every selected file in a tab.
openButton.addEventListener('click', async () => {
  const files = await window.api.openFile();
  files.forEach((file) => openTab(file.filePath, file.content));
});

// Save: overwrite the original file of the focused tab.
saveButton.addEventListener('click', async () => {
  const tab = getActiveTab();
  if (!tab) {
    statusLabel.textContent = t('status.noFileToSave');
    return;
  }

  const result = await window.api.saveFile(tab.filePath, tab.content);
  if (result.error) {
    statusLabel.textContent = t('status.saveError', { msg: result.error });
    return;
  }

  tab.isModified = false;
  renderTabBar();
  statusLabel.textContent = t('status.saved', { path: tab.filePath });
  scheduleSessionSave();
});

// Print: trigger the native print dialog through the main process.
printButton.addEventListener('click', () => {
  window.api.print();
});

// Export the focused preview to a PDF file.
exportButton.addEventListener('click', async () => {
  const tab = getActiveTab();
  if (!tab) {
    statusLabel.textContent = t('status.noFileToExport');
    return;
  }

  // Suggest a PDF name based on the focused file name.
  const suggestedName = getFileName(tab.filePath).replace(/\.(md|markdown|txt)$/i, '') + '.pdf';

  const result = await window.api.exportPdf(suggestedName);
  if (result.canceled) return;

  if (result.error) {
    statusLabel.textContent = t('status.exportError', { msg: result.error });
  } else {
    statusLabel.textContent = t('status.exported', { path: result.filePath });
  }
});

// Source: toggle between preview-only and the split (source + preview) view.
sourceButton.addEventListener('click', () => {
  const isSourceVisible = document.body.classList.toggle('show-source');
  sourceButton.classList.toggle('active', isSourceVisible);
});

// When the window is closing, handle every modified tab before allowing it.
window.api.onAppCloseRequest(async () => {
  for (let i = 0; i < openTabs.length; i++) {
    const tab = openTabs[i];
    if (!tab.isModified) continue;

    showTab(focusedSide, i);
    const choice = await window.api.confirmSave(getFileName(tab.filePath));
    if (choice === 'cancel') return; // abort closing
    if (choice === 'save') {
      const result = await window.api.saveFile(tab.filePath, tab.content);
      if (result.error) {
        statusLabel.textContent = t('status.saveError', { msg: result.error });
        return; // keep the window open on save failure
      }
    }
    tab.isModified = false;
  }

  window.api.confirmClose();
});

// Open a file pushed by the OS while the app is already running.
window.api.onOpenExternalFile((file) => {
  openTab(file.filePath, file.content);
});

// --- Language menu --------------------------------------------------------

// Supported locales, kept to rebuild the language menu after a change.
let availableLocales = [];

// Build the language list in the help menu, marking the active language.
function buildLanguageMenu(locales, activeLocale) {
  availableLocales = locales;
  langButton.textContent = activeLocale.toUpperCase();
  languageList.innerHTML = '';

  locales.forEach((locale) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = locale.name;
    button.className = locale.code === activeLocale ? 'active' : '';
    button.addEventListener('click', () => changeLanguage(locale.code));
    languageList.appendChild(button);
  });
}

// Switch the application language and re-apply every translated string.
async function changeLanguage(locale) {
  const data = await window.api.i18nSet(locale);
  i18nStrings = data.strings;

  applyTranslations();
  buildLanguageMenu(availableLocales, data.locale);
  renderTabBar();
  refreshStatus();

  // Re-translate the update menu item if it is currently shown.
  if (pendingUpdateInfo) {
    const updateItem = helpDropdown.querySelector('button[data-help="update"]');
    if (updateItem && !updateItem.hidden) {
      updateItem.textContent = t('menu.updateWithVersion', { version: pendingUpdateInfo.version });
    }
  }

  langDropdown.classList.add('hidden');
}

// Show the application version in the status bar and the window title.
window.api.getVersion().then((version) => {
  versionLabel.textContent = 'v' + version;
  document.title = 'Markdown Editor ' + version;
});

// Load translations first, then restore the session and any OS-launched file.
async function start() {
  const data = await window.api.i18nGet();
  i18nStrings = data.strings;
  applyTranslations();
  buildLanguageMenu(data.locales, data.locale);

  await restoreSession();

  const launchFile = await window.api.getLaunchFile();
  if (launchFile) openTab(launchFile.filePath, launchFile.content);
}

start();
