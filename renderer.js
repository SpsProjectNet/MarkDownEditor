// DOM references
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const statusLabel = document.getElementById('status');
const versionLabel = document.getElementById('version');
const tabBar = document.getElementById('tabBar');

const openButton = document.getElementById('openBtn');
const saveButton = document.getElementById('saveBtn');
const revertButton = document.getElementById('revertBtn');
const printButton = document.getElementById('printBtn');
const exportButton = document.getElementById('exportBtn');
const sourceButton = document.getElementById('sourceBtn');

const formatBar = document.getElementById('formatBar');
const formatToggle = document.getElementById('formatToggle');
const helpToggle = document.getElementById('helpToggle');
const helpDropdown = document.getElementById('helpDropdown');
const iconButton = document.getElementById('iconBtn');
const emojiPicker = document.getElementById('emojiPicker');
const languageList = document.getElementById('languageList');

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
// Each tab is an object: { filePath: string, content: string, isModified: boolean }
let openTabs = [];
let activeTabIndex = -1;

// Timer handle used to debounce writing the session to disk while typing.
let sessionSaveTimer = null;

// Return the currently active tab object, or null when no tab is open.
function getActiveTab() {
  if (activeTabIndex < 0 || activeTabIndex >= openTabs.length) return null;
  return openTabs[activeTabIndex];
}

// Extract the file name from a full path for display in the tab.
function getFileName(filePath) {
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] || filePath;
}

// Render the Markdown of the active tab into the preview pane.
function renderPreview() {
  const tab = getActiveTab();
  preview.innerHTML = tab ? marked.parse(tab.content) : '';
}

// Rebuild the tab bar from the current list of open tabs.
function renderTabBar() {
  tabBar.innerHTML = '';

  openTabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab' + (index === activeTabIndex ? ' active' : '');

    const titleElement = document.createElement('span');
    titleElement.className = 'tab-title';
    titleElement.textContent = (tab.isModified ? '* ' : '') + getFileName(tab.filePath);
    titleElement.title = tab.filePath;
    titleElement.addEventListener('click', () => setActiveTab(index));

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

// Refresh the editor, preview, path field and status bar for the active tab.
function refreshActiveView() {
  const tab = getActiveTab();

  if (tab) {
    editor.value = tab.content;
    statusLabel.textContent = tab.isModified
      ? t('status.modified', { path: tab.filePath })
      : t('status.open', { path: tab.filePath });
  } else {
    editor.value = '';
    statusLabel.textContent = t('status.noFile');
  }

  renderPreview();
}

// Make the tab at the given index active and refresh every view.
function setActiveTab(index) {
  activeTabIndex = index;
  renderTabBar();
  refreshActiveView();
  scheduleSessionSave();
}

// Find the index of an open tab by its file path, or -1 when not open.
function findTabByPath(filePath) {
  return openTabs.findIndex((tab) => tab.filePath === filePath);
}

// Open a file in a tab. If it is already open, activate that tab instead.
function openTab(filePath, content) {
  const existingIndex = findTabByPath(filePath);
  if (existingIndex !== -1) {
    setActiveTab(existingIndex);
    return;
  }

  openTabs.push({ filePath, content, isModified: false });
  setActiveTab(openTabs.length - 1);
}

// Close the tab at the given index and activate a neighbouring tab.
// When the file has unsaved changes, ask the user what to do first.
async function closeTab(index) {
  const tab = openTabs[index];
  if (tab && tab.isModified) {
    setActiveTab(index);
    const choice = await window.api.confirmSave(getFileName(tab.filePath));
    if (choice === 'cancel') return;
    if (choice === 'save') {
      const result = await window.api.saveFile(tab.filePath, tab.content);
      if (result.error) {
        statusLabel.textContent = t('status.saveError', { msg: result.error });
        return;
      }
    }
  }

  openTabs.splice(index, 1);

  if (openTabs.length === 0) {
    activeTabIndex = -1;
  } else if (activeTabIndex >= openTabs.length) {
    activeTabIndex = openTabs.length - 1;
  } else if (index < activeTabIndex) {
    activeTabIndex -= 1;
  }

  renderTabBar();
  refreshActiveView();
  scheduleSessionSave();
}

// Build a serialisable snapshot of the current session.
function buildSessionSnapshot() {
  return {
    tabs: openTabs.map((tab) => ({ filePath: tab.filePath, content: tab.content })),
    activeTabIndex: activeTabIndex
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

// Restore the previous session on startup.
// Files that no longer exist are already filtered out by the main process.
async function restoreSession() {
  const session = await window.api.loadSession();

  if (session && Array.isArray(session.tabs) && session.tabs.length > 0) {
    openTabs = session.tabs.map((tab) => ({
      filePath: tab.filePath,
      content: tab.content,
      isModified: false
    }));

    const restoredIndex = session.activeTabIndex;
    activeTabIndex =
      typeof restoredIndex === 'number' && restoredIndex >= 0 && restoredIndex < openTabs.length
        ? restoredIndex
        : 0;
  }

  renderTabBar();
  refreshActiveView();
}

// Live editing of the source textarea: store the text and refresh the preview.
editor.addEventListener('input', () => {
  const tab = getActiveTab();
  if (!tab) return;

  tab.content = editor.value;
  tab.isModified = true;
  renderTabBar();
  renderPreview();
  scheduleSessionSave();
});

// Live editing of the rendered preview: convert its HTML back to Markdown and
// store it in the active tab. The preview is intentionally not re-rendered here,
// so the caret position is preserved while typing.
function syncMarkdownFromPreview() {
  const tab = getActiveTab();
  if (!tab) return;

  const markdown = turndownService.turndown(preview.innerHTML);
  tab.content = markdown;
  tab.isModified = true;
  editor.value = markdown;
  renderTabBar();
  scheduleSessionSave();
}

preview.addEventListener('input', syncMarkdownFromPreview);

// Wrap the current selection inside the preview in an inline <code> element.
function wrapSelectionInCode() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const codeElement = document.createElement('code');
  codeElement.appendChild(range.extractContents());
  range.insertNode(codeElement);
}

// Apply a formatting command to the rendered (editable) preview, then sync.
function applyFormat(command) {
  if (!getActiveTab()) return;
  preview.focus();

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

  syncMarkdownFromPreview();
  updateActiveFormats();
}

// Convert a local file path into a file:// URL usable as a media source.
function pathToFileUrl(filePath) {
  let normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
  return 'file://' + encodeURI(normalizedPath);
}

// Let the user pick a media file and insert it into the rendered preview.
async function insertMedia(mediaType) {
  if (!getActiveTab()) return;

  const filePath = await window.api.pickMedia(mediaType);
  if (!filePath) return;

  const fileUrl = pathToFileUrl(filePath);
  const fileName = getFileName(filePath);

  preview.focus();
  if (mediaType === 'video') {
    document.execCommand('insertHTML', false, '<video controls src="' + fileUrl + '"></video>');
  } else {
    // Images and icons are both inserted as standard inline images.
    document.execCommand('insertHTML', false, '<img src="' + fileUrl + '" alt="' + fileName + '">');
  }

  syncMarkdownFromPreview();
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

// Return true when the selection has an ancestor element with the given tag,
// stopping at the preview root.
function selectionHasAncestorTag(tagName) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  let node = selection.anchorNode;
  while (node && node !== preview) {
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
  if (!isSelectionInside(preview)) return;

  const isHeading1 = selectionHasAncestorTag('H1');
  const isHeading2 = selectionHasAncestorTag('H2');
  const isHeading3 = selectionHasAncestorTag('H3');
  const isQuote = selectionHasAncestorTag('BLOCKQUOTE');

  setControlActive('h1', isHeading1);
  setControlActive('h2', isHeading2);
  setControlActive('h3', isHeading3);
  setControlActive('quote', isQuote);
  setControlActive('code', selectionHasAncestorTag('CODE'));
  setControlActive('link', selectionHasAncestorTag('A'));

  // Plain paragraph is active only when no block-level tag applies.
  setControlActive('paragraph', !(isHeading1 || isHeading2 || isHeading3 || isQuote));

  setControlActive('bold', document.queryCommandState('bold'));
  setControlActive('italic', document.queryCommandState('italic'));
  setControlActive('unorderedList', document.queryCommandState('insertUnorderedList'));
  setControlActive('orderedList', document.queryCommandState('insertOrderedList'));
}

// Refresh the highlighted controls whenever the selection changes.
document.addEventListener('selectionchange', updateActiveFormats);

// Open or close the help dropdown.
helpToggle.addEventListener('click', (event) => {
  event.stopPropagation();
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

// Close the help dropdown when clicking anywhere else.
document.addEventListener('click', () => {
  helpDropdown.classList.add('hidden');
  emojiPicker.classList.add('hidden');
});

// Emoji available in the "Icon" picker.
const EMOJIS = [
  '😀', '😄', '😁', '😆', '😅', '😂', '🙂', '😉',
  '😍', '😘', '😎', '🤔', '😴', '😇', '🥳', '😢',
  '😡', '👍', '👎', '👌', '🙏', '👏', '💪', '🤝',
  '❤️', '🔥', '⭐', '✨', '✅', '❌', '⚠️', '💡',
  '📌', '📎', '📁', '📄', '🔗', '🔍', '⏰', '📅',
  '🚀', '🎯', '🎉', '🐛', '💻', '⚙️', '🔧', '📝'
];

// Insert an emoji at the current caret position in the preview.
function insertEmoji(emoji) {
  if (!getActiveTab()) return;
  preview.focus();
  document.execCommand('insertText', false, emoji);
  syncMarkdownFromPreview();
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

// Open: show the system file dialog and open every selected file in a tab.
openButton.addEventListener('click', async () => {
  const files = await window.api.openFile();
  files.forEach((file) => openTab(file.filePath, file.content));
});

// Save: overwrite the original file of the active tab.
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

// Revert: reload the active file from disk, discarding unsaved changes.
revertButton.addEventListener('click', async () => {
  const tab = getActiveTab();
  if (!tab) {
    statusLabel.textContent = t('status.noFileToRevert');
    return;
  }
  if (!tab.isModified) {
    statusLabel.textContent = t('status.noChangesToRevert');
    return;
  }

  const result = await window.api.readFile(tab.filePath);
  if (result.error) {
    statusLabel.textContent = t('status.revertError', { msg: result.error });
    return;
  }

  tab.content = result.content;
  tab.isModified = false;
  refreshActiveView();
  renderTabBar();
  statusLabel.textContent = t('status.reverted', { path: tab.filePath });
  scheduleSessionSave();
});

// Print: trigger the native print dialog through the main process.
printButton.addEventListener('click', () => {
  window.api.print();
});

// Export the current preview to a PDF file.
exportButton.addEventListener('click', async () => {
  const tab = getActiveTab();
  if (!tab) {
    statusLabel.textContent = t('status.noFileToExport');
    return;
  }

  // Suggest a PDF name based on the active file name.
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

    setActiveTab(i);
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

// Supported locales, kept to rebuild the language menu after a change.
let availableLocales = [];

// Build the language list in the help menu, marking the active language.
function buildLanguageMenu(locales, activeLocale) {
  availableLocales = locales;
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
  refreshActiveView();

  // Re-translate the update menu item if it is currently shown.
  if (pendingUpdateInfo) {
    const updateItem = helpDropdown.querySelector('button[data-help="update"]');
    if (updateItem && !updateItem.hidden) {
      updateItem.textContent = t('menu.updateWithVersion', { version: pendingUpdateInfo.version });
    }
  }

  helpDropdown.classList.add('hidden');
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
