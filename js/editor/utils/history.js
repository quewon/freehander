import { Game } from '../../game.js';
import { game, openDocumentInspector } from '../editor.js';
import { reorderPreviews } from '../managers/slide.js';
import { openMediaInspector } from '../managers/media.js';
import { openElementInspector } from '../managers/element.js';

var history = [];
var undos = [];

function clearHistory() {
    history = [];
}

// save, undo, redo
function save() {
    console.log("saved.");
    history.push(document.querySelector(".fh-game").outerHTML);
    if (history.length > 1000)
        history.shift();
    undos = [];
}
function undo() {
    if (history.length > 1) {
        undos.push(history.pop());
        restoreState(history[history.length - 1]);
    } else {
        console.log("nothing to undo.");
    }
}
function redo() {
    var state = undos.pop();
    if (state) {
        history.push(state);
        restoreState(state);
    } else {
        console.log("nothing to redo.");
    }
}
function restoreState(state) {
    document.querySelector(":focus")?.blur();
    document.querySelector(".fh-game").outerHTML = state;

    Game.prototype.init.call(game, document.querySelector(".fh-game"));
    reorderPreviews();
    if (!fh_media_inspector.classList.contains("hidden"))
        openMediaInspector();
    else if (!fh_document_inspector.classList.contains("hidden"))
        openDocumentInspector();
    else
        openElementInspector();
    document.querySelector(":focus")?.blur();
}

export { clearHistory, save, undo, redo };