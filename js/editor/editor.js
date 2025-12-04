import { Game } from "../game.js";

import { doodleDragHandler } from "./modes/doodle.js";
import { textDragHandler } from "./modes/text.js";
import { selectDragHandler } from "./modes/select.js";

import { clearHistory, save } from './utils/history.js';
import { initMedia, refreshMedia, mediaFolder } from "./managers/media.js";
import { initShortcuts, textareaKeydown } from "./utils/shortcuts.js";
import { findSlidePreview, updateSlidePreview, updateSlidePreviewScale, reorderPreviews, clearSlidePreviews, createPreviewsFromElement, slidesContainer } from "./managers/slide.js";
import { openElements, openElementInspector, selectElement, deselectAllElements, openElement, initSelectionHandles } from './managers/element.js';

var game;
var editMode = "select";
var gameContainer = document.querySelector(".fh-game-container");
var editorOverlay = document.querySelector(".fh-editor-overlay");
var editorInspector = document.querySelector(".fh-inspector");

function switchMode(modename) {
    editMode = modename || "select";
    fh_doodle_tooltip.classList.add("hidden");
    if (editMode !== "select") {
        editorOverlay.style.cursor = "crosshair";
        deselectAllElements();
    } else {
        editorOverlay.style.cursor = "default";
    }
    const toolbar = document.querySelector(".fh-toolbar");
    if (toolbar.querySelector(".selected"))
        toolbar.querySelector(".selected").classList.remove("selected");
    document.getElementById(`fh_${editMode}_mode`).classList.add("selected");
}

function cleanGameHTML() {
    for (const element of game.gameElement.querySelectorAll(".fh-element, .fh-slide")) {
        // i don't know why this is necessary
        element.removeAttribute("style");
    }
    for (const source of game.gameElement.querySelectorAll("[data-src]")) {
        source.setAttribute("src", source.dataset.src);
        source.removeAttribute("data-src");
    }
    for (const source of game.gameElement.querySelectorAll("[data-filepath]")) {
        source.removeAttribute("src");
    }
}

async function createGameFile() {
    cleanGameHTML();
    for (const asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        asset.setAttribute("src", asset.dataset.filepath);
    }

    var game_css = await fetch("/css/game.css").then(res => res.text());
    var game_module = await fetch("/js/game.js").then(res => res.text());
    var matrix_module = await fetch("/js/matrix.js").then(res => res.text());
    matrix_module = matrix_module.replace("export { matrix_adjugate, matrix_multm, matrix_multv, basisToPoints, general2DProjection, transform2d };", "");
    game_module = game_module.replace("import { transform2d } from './matrix.js';", matrix_module);
    game_module = game_module.replace("export { Game };", "");

    var html = await fetch("/template.html").then(res => res.text());
    html = html.replace("<title></title>", `<title>${game.gameElement.dataset.title}</title>`);
    html = html.replace("<!-- _FH_GAME_STYLE -->", `<style>${game_css}</style>`);
    html = html.replace("<!-- _FH_GAME_MODULE -->", `<script>${game_module}</script>`);

    html = html.replace(
        "<!-- _FH_DATA_START --><!-- _FH_DATA_END -->", 
        `<!-- _FH_DATA_START -->${game.gameElement.outerHTML}<!-- _FH_DATA_END -->`
    );

    refreshMedia();
    console.clear();
    console.log("console cleared--you would have seen a mess of failed GET requests here due to urls being changed for the save.");
    game.goto(game.currentSlide);

    return new Blob([html], { type: "text/html" });
}
async function playGame() {
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        if (!mediaFolder) {
            console.error("media folder was not initialized.");
            break;
        }
        const referenceElement = mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
        if (!referenceElement) {
            console.error(`media asset "${asset.dataset.filepath}" was not found.`);
            break;
        }
        asset.setAttribute("src", referenceElement.dataset.url);
    }
    localStorage.setItem("savestate", game.gameElement.outerHTML);
    window.open("/play", "_blank").focus();
}
async function saveDocument() {
    var file = await createGameFile();
    var filename = `${game.gameElement.dataset.title}.html`;
    if ('showSaveFilePicker' in self) {
        try {
            var fileHandle = await showSaveFilePicker({ id: 'export-location', startIn: "documents", suggestedName: filename });
            var writeable = await fileHandle.createWritable();
            await writeable.write(file);
            await writeable.close();
        }
        catch (err) {
            console.error(err);
        }
    } else {
        var url = URL.createObjectURL(file);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
    }
}
async function exportDocument() {
    var mediaContained = {};
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        asset.setAttribute("src", asset.dataset.filepath);
        mediaContained[asset.dataset.filepath] = true;
    }

    var zip = new JSZip();
    zip.file("index.html", await createGameFile());
    for (let key in mediaContained) {
        if (!mediaFolder) {
            console.error("media folder was not initialized.");
            break;
        }
        var source = mediaFolder.querySelector(`[data-filepath="${key}"]`);
        if (!source) {
            console.error(`the file "${key}" needed for export was not found.`);
            continue;
        }
        var blob = await fetch(source.dataset.url).then(res => res.blob());
        zip.file(key, blob);
    }
    zip.generateAsync({ type: 'blob' }).then(async content => {
        var filename = `${game.gameElement.dataset.title}.zip`;
        if ('showSaveFilePicker' in self) {
            try {
                var fileHandle = await showSaveFilePicker({ id: 'export-location', startIn: "documents", suggestedName: filename });
                var writeable = await fileHandle.createWritable();
                await writeable.write(content);
                await writeable.close();
            }
            catch (err) {
                console.error(err);
            }
        } else {
            saveAs(content, filename);
        }
    })
}
function loadDocument() {
    const input = document.querySelector("input[name=html_input]");
    input.onchange = () => {
        var htmlFile = input.files[0];
        if (htmlFile) {
            var reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const startString = "<!-- _FH_DATA_START -->";
                const endString = "<!-- _FH_DATA_END -->";
                if (text.indexOf(startString) === -1 || text.indexOf(endString) === -1) {
                    throw new Error("invalid file.");
                }

                var gameElementContainer = document.createElement("div");
                gameElementContainer.innerHTML = text.substring(text.indexOf(startString) + startString.length, text.indexOf(endString));
                game.init(gameElementContainer.firstElementChild);
            }
            reader.readAsText(htmlFile, "UTF-8");
        }
        input.value = "";
    }
    input.click();
}
function openDocumentInspector() {
    for (let inspectors of editorInspector.children)
        inspectors.classList.add("hidden");
    fh_document_inspector.classList.remove("hidden");
    const selectedInspector = document.body.querySelector(".fh-toolbar .inspector_button.selected");
    if (selectedInspector)
        selectedInspector.classList.remove("selected");
    fh_inspect_document.classList.add("selected");
}
function focusGameContainer() {
    if (document.querySelector(".fh-editor .focused"))
        document.querySelector(".fh-editor .focused").classList.remove("focused");
    gameContainer.classList.add("focused");
}

class EditorGame extends Game {
    constructor() {
        gameContainer.onmousedown = (e) => {
            document.querySelector(":focus")?.blur();
            focusGameContainer();
            if (e.target === gameContainer || e.target === editorOverlay) {
                deselectAllElements();
            }
        }
        editorInspector.onmousedown = () => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            editorInspector.classList.add("focused");
        }

        fh_play.onclick = playGame;
        fh_document_inspector.querySelector("[name=load]").onclick = loadDocument;
        fh_document_inspector.querySelector("[name=save]").onclick = saveDocument;
        fh_document_inspector.querySelector("[name=export]").onclick = exportDocument;
        fh_inspect_element.onclick = () => openElementInspector();
        fh_inspect_document.onclick = openDocumentInspector;

        // document inspector
        fh_document_inspector.querySelector("[name=title]").oninput = function () {
            game.gameElement.dataset.title = this.value;
            document.title = this.value;
        }
        fh_document_inspector.querySelector("[name=title]").onchange = save;
        fh_document_inspector.querySelector("[name=aspectratio]").oninput = function () {
            game.gameElement.dataset.aspectratio = this.value;
            game.onresize();
        }
        fh_document_inspector.querySelector("[name=aspectratio]").onchange = save;
        if ('showSaveFilePicker' in self)
            fh_document_fallback_message.remove();

        for (let textarea of editorInspector.querySelectorAll("textarea")) {
            textarea.style.width = "100%";
            textarea.setAttribute("autocomplete", "off");
            textarea.setAttribute("autocorrect", "off");
            textarea.setAttribute("autocapitalize", "off");
            textarea.setAttribute("spellcheck", "off");
            textarea.addEventListener("input", function () {
                const previousScrollPosition = document.querySelector(".fh-inspector").scrollTop;
                this.style.height = "";
                this.style.height = (this.scrollHeight + 2) + "px";
                document.querySelector(".fh-inspector").scrollTop = previousScrollPosition;
            })
            textarea.addEventListener("keydown", textareaKeydown);
        }

        selectDragHandler.attach(gameContainer);
        textDragHandler.attach(gameContainer);
        doodleDragHandler.attach(gameContainer);
        initMedia();
        initSelectionHandles();
        initShortcuts();

        window.onbeforeunload = () => {
            cleanGameHTML();
            localStorage.setItem("savestate", document.querySelector(".fh-game").outerHTML);
        }
        const state = localStorage.getItem("savestate");
        if (state) {
            document.querySelector(".fh-game").outerHTML = state;
        }

        super(document.querySelector(".fh-game"));
    }

    init(gameElement) {
        game = this;
        super.init(gameElement);
        reorderPreviews();
        clearHistory();
        save();
        openElementInspector();
    }

    initGameElement(gameElement) {
        super.initGameElement(gameElement);
        clearSlidePreviews();
        document.querySelector(".fh-editor .fh-game").replaceWith(this.gameElement);

        fh_document_inspector.querySelector("[name=title]").value = gameElement?.dataset.title || "untitled";
        fh_document_inspector.querySelector("[name=aspectratio]").value = gameElement?.dataset.aspectratio || 1;
    }

    initElements() {
        createPreviewsFromElement(this.gameElement);
        refreshMedia();
    }

    onresize() {
        super.onresize();
        editorOverlay.style.width = game.gameElement.style.width;
        editorOverlay.style.height = game.gameElement.style.height;
        if (this.cachedGameRect) {
            var closedSlides = [];
            for (let slide of game.gameElement.querySelectorAll(".fh-slide")) {
                if (!slide.classList.contains("open"))
                    closedSlides.push(slide);
                slide.classList.add("open");
            }
            for (let element of game.gameElement.querySelectorAll(".fh-slide > .fh-element")) {
                game.updateTransform(element);
            }
            for (let slide of game.gameElement.querySelectorAll(".fh-slide")) {
                updateSlidePreview(slide);
            }
            for (let preview of slidesContainer.querySelectorAll(".fh-slide-preview-bg")) {
                updateSlidePreviewScale(preview);
            }
            for (let slide of closedSlides)
                slide.classList.remove("open");
        }
        var tooltipPosition = fh_doodle_mode.getBoundingClientRect();
        fh_doodle_tooltip.style.left = tooltipPosition.left + "px";
        fh_doodle_tooltip.style.top = tooltipPosition.bottom + "px";
    }

    goto(path) {
        const previousSlide = game.currentSlide;
        var selectedElements = [];
        for (let name in openElements) {
            if (openElements[name].clickzone.classList.contains("selected")) {
                selectedElements.push(openElements[name].element)
            }
        }
        editorOverlay.innerHTML = "";
        while (slidesContainer.querySelector(".selected"))
            slidesContainer.querySelector(".selected").classList.remove("selected");

        super.goto(path);

        findSlidePreview(game.currentSlide).classList.add("selected");

        for (let name in openElements)
            delete openElements[name];
        for (let element of game.currentSlide.children) {
            if (element.classList.contains("fh-element")) {
                openElement(element);
                if (previousSlide === game.currentSlide && selectedElements.includes(element))
                    selectElement(element);
            }
        }

        if (fh_inspect_element.classList.contains("selected"))
            openElementInspector();

        if (mediaFolder) {
            for (const asset of game.gameElement.querySelectorAll(".fh-slide.open [data-filepath]")) {
                const referenceElement = mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
                if (!referenceElement) {
                    console.error(`media asset "${asset.dataset.filepath}" was not found.`);
                } else {
                    asset.setAttribute("src", referenceElement.dataset.url);
                }
            }
        }
    }

    async runScript(script) { }
}

export { game, editMode, switchMode, editorInspector, editorOverlay, openDocumentInspector, focusGameContainer, playGame, saveDocument, loadDocument, exportDocument, EditorGame };