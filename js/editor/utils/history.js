import { Game } from '../../game.js';
import { game, openDocumentInspector } from '../editor.js';
import { reorderPreviews, slidesContainer } from '../managers/slide.js';
import { openMediaInspector, refreshMedia } from '../managers/media.js';
import { openElementInspector } from '../managers/element.js';

var history = [];
var undos = [];

function clearHistory() {
    history = [];
}
function save() {
    const state = document.querySelector(".fh-game").outerHTML;
    history.push(state);
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
    const slideContainerScrollTop = slidesContainer.parentElement.scrollTop;
    document.querySelector(":focus")?.blur();
    document.querySelector(".fh-game").outerHTML = state;
    const currentSlidePath = game.getPath(game.currentSlide);
    Game.prototype.init.call(game, document.querySelector(".fh-game"));
    game.goto(currentSlidePath || game.gameElement.querySelector(".fh-slide.open"));
    slidesContainer.parentElement.scrollTop = slideContainerScrollTop;
}

export { clearHistory, restoreState, save, undo, redo };