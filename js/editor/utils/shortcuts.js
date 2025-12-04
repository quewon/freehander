import { game, switchMode, playGame, saveDocument, loadDocument, exportDocument, editorOverlay, editorInspector } from '../editor.js';
import { save, undo, redo } from '../utils/history.js';
import { slidesContainer, addSlide, deleteSelectedSlides, getParentPreview } from '../managers/slide.js';
import { deleteElement, pasteHTML, selectElement, deselectElement, openElementInspector, openElements, deleteSelectedElements } from '../managers/element.js';

var shiftKey = false;

function initShortcuts() {
    document.addEventListener("keydown", e => {
        const metaKey = e.metaKey || e.ctrlKey;

        if (e.key === "Shift")
            shiftKey = true;

        if (metaKey) {
            switch (e.code) {
                case "KeyP":
                    playGame();
                    e.preventDefault();
                    break;
                case "KeyS":
                    saveDocument();
                    e.preventDefault();
                    break;
                case "KeyL":
                    loadDocument();
                    e.preventDefault();
                    break;
                case "KeyE":
                    exportDocument();
                    e.preventDefault();
                    break;
                case "KeyM":
                    if (!fh_media_inspector.classList.contains("hidden")) {
                        fh_media_reload_button.click();
                    } else {
                        fh_media.click();
                    }
                    e.preventDefault();
                    break;
                case "KeyI":
                    if (!e.altKey) {
                        openElementInspector();
                        e.preventDefault();
                    }
                    break;
            }
        }

        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
            return;
        }

        else if (!metaKey && (e.key === "1" || e.code === "KeyS"))
            switchMode("select")
        else if (!metaKey && (e.key === "2" || e.code === "KeyT"))
            switchMode("text")
        else if (!metaKey && (e.key === "3" || e.code === "KeyD"))
            switchMode("doodle")

        else if (!metaKey && (e.key === "Delete" || e.key === "Backspace")) {
            if (slidesContainer.classList.contains("focused")) {
                deleteSelectedSlides();
                save();
            } else if (!editorInspector.classList.contains("focused")) {
                deleteSelectedElements();
                save();
            }
        }

        if (slidesContainer.classList.contains("focused")) {
            const selected = slidesContainer.querySelector(".selected");
            switch (e.key) {
                case "Enter":
                    addSlide();
                    e.preventDefault();
                    break;
                case "ArrowUp":
                case "ArrowLeft":
                    var prev = selected.previousElementSibling;
                    while (prev) {
                        var underCollapsed = false;
                        var parent = getParentPreview(prev);
                        while (parent) {
                            if (parent.classList.contains("collapsed")) {
                                underCollapsed = true;
                                break;
                            }
                            parent = getParentPreview(parent);
                        }
                        if (underCollapsed) {
                            prev = prev.previousElementSibling;
                        } else {
                            break;
                        }
                    }
                    if (prev)
                        game.goto(prev.dataset.path);
                    break;
                case "ArrowDown":
                case "ArrowRight":
                    var next = selected.nextElementSibling;
                    while (next) {
                        var underCollapsed = false;
                        var parent = getParentPreview(next);
                        while (parent) {
                            if (parent.classList.contains("collapsed")) {
                                underCollapsed = true;
                                break;
                            }
                            parent = getParentPreview(parent);
                        }
                        if (underCollapsed) {
                            next = next.nextElementSibling;
                        } else {
                            break;
                        }
                    }
                    if (next)
                        game.goto(next.dataset.path);
                    break;
            }
        }

        var selectedClickzones;
        if (slidesContainer.classList.contains("focused")) {
            selectedClickzones = slidesContainer.querySelectorAll(".selected");
        } else {
            selectedClickzones = editorOverlay.querySelectorAll(".selected");
        }
        var selectedElements = [];
        for (let selected of selectedClickzones) {
            if (slidesContainer.classList.contains("focused")) {
                selectedElements.push(game.currentSlide.parentElement.querySelector(`:scope > [name="${selected.getAttribute("name")}"]`));
            } else {
                selectedElements.push(game.currentSlide.querySelector(`:scope > [name="${selected.getAttribute("name")}"]`));
            }
        }

        if (
            metaKey && e.code === "KeyC" ||
            metaKey && e.code === "KeyX" ||
            metaKey && e.code === "KeyD"
        ) {
            var html = "";
            for (let element of selectedElements) {
                if (slidesContainer.classList.contains("focused")) {
                    var clone = element.cloneNode(true);
                    for (let slide of clone.querySelectorAll(".fh-slide")) {
                        slide.remove();
                    }
                    html += clone.outerHTML;
                } else {
                    html += element.outerHTML;
                }
            }
            if (html !== "") {
                if (metaKey && e.code === "KeyC") {
                    //copy
                    navigator.clipboard.writeText(html);
                } else if (metaKey && e.code === "KeyX") {
                    //cut
                    navigator.clipboard.writeText(html);
                    for (let element of selectedElements) {
                        deleteElement(element);
                    }
                    save();
                } else if (metaKey && e.code === "KeyD") {
                    //duplicate
                    for (let element of selectedElements) {
                        deselectElement(element);
                    }
                    pasteHTML(html, game.currentSlide);
                    save();
                }
                e.preventDefault();
            }
        }
        else if (metaKey && e.code === "KeyV") {
            //paste
            navigator.clipboard.readText()
                .then(text => {
                    for (let element of selectedElements) {
                        deselectElement(element);
                    }
                    pasteHTML(text, game.currentSlide);
                    save();
                })
            e.preventDefault();
        }

        else if (
            metaKey && e.code === "KeyY" ||
            metaKey && shiftKey && e.code === "KeyZ"
        ) {
            redo();
            e.preventDefault();
        }
        else if (metaKey) {
            switch (e.code) {
                case "KeyZ":
                    undo();
                    e.preventDefault();
                    break;
                case "KeyA":
                    for (let name in openElements) {
                        selectElement(openElements[name].element);
                    }
                    e.preventDefault();
                    break;
            }
        }
    })
    document.addEventListener("keyup", e => {
        if (e.key === "Shift")
            shiftKey = false;
    })
}

function textareaKeydown(e) {
    const metaKey = e.metaKey || e.ctrlKey;

    if (e.code === "Tab") {
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + "  " + this.value.substring(end);
        this.selectionStart = start + 2;
        this.selectionEnd = start + 2;
        e.preventDefault();
    } else if (e.code === "Escape") {
        this.blur();
    } else if (metaKey && e.key === "/") {
        const start = this.selectionStart;
        const end = this.selectionEnd;
        var newStart = this.selectionStart;
        var newEnd = this.selectionEnd;
        var lines = this.value.split("\n");
        var j = 0;
        for (let i = 0; i < lines.length; i++) {
            const len = lines[i].length;
            if (
                start >= j && start <= j + len ||
                end >= j && end <= j + len ||
                j >= start && j + len <= end
            ) {
                if (lines[i].trim().indexOf("//") === 0) {
                    const slash = lines[i].indexOf("//");
                    lines[i] = lines[i].slice(slash + 3);
                    if (start >= j) {
                        newStart -= 3;
                        newEnd -= 3;
                    }
                    if (end >= j + len)
                        newEnd -= 3;
                    while (lines[i][slash] === " ")
                        lines[i] = lines[i].substring(0, slash) + lines[i].slice(slash);
                } else {
                    lines[i] = "// " + lines[i];
                    if (start >= j) {
                        newStart += 3;
                        newEnd += 3;
                    } else {
                        newEnd += 3;
                    }
                }
            }
            j += len + 1;
        }
        this.value = lines.join("\n");
        this.selectionStart = newStart;
        this.selectionEnd = newEnd;
        e.preventDefault();
    }
}

export { initShortcuts, shiftKey, textareaKeydown };