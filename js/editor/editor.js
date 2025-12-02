import { Game } from "../game.js";
import { loadAssetFolder } from "./folder.js";
import { get, set, del } from './lib/idb-keyval.js';

var game;

var editMode = "select";
var shiftKey = false;
var metaKey = false;
var openElements = {};
var history;
var undos;
var doodleSettings = {};

var mediaFolder;
var editorOverlay = document.querySelector(".fh-editor-overlay");
var editorInspector = document.querySelector(".fh-inspector");
var slidesContainer = document.querySelector(".fh-slides-container"); 

// modes
function switchMode(modename) {
    editMode = modename || "select";
    fh_doodle_tooltip.classList.add("hidden");
    if (editMode === "text" || editMode === "doodle")
        editorOverlay.style.cursor = "crosshair";
    else
        editorOverlay.style.cursor = "default";
    if (editMode === "doodle") {
        for (let name in openElements) {
            deselectElement(openElements[name].element);
        }
    }
    const toolbar = document.querySelector(".fh-toolbar");
    if (toolbar.querySelector(".selected"))
        toolbar.querySelector(".selected").classList.remove("selected");
    document.getElementById(`fh_${editMode}_mode`).classList.add("selected");
}
function selectionMousedown(e) {
    const mousedownPosition = [e.pageX, e.pageY];
    const box = document.createElement("div");
    box.style.position = "absolute";
    box.style.border = "1px solid greenyellow";
    box.style.backgroundColor = "rgba(0, 255, 100, .1)";
    box.style.boxSizing = "border-box";
    const mousemoveEvent = (e) => {
        if (Math.abs(mousedownPosition[0] - e.pageX) + Math.abs(mousedownPosition[1] - e.pageY) > 3) {
            editorOverlay.appendChild(box);
        }
        const rect = game.cachedGameRect;
        var min = [
            (Math.min(mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100, 
            (Math.min(mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100
        ];
        var max = [
            (Math.max(mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100, 
            (Math.max(mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100,
        ];
        box.style.left = min[0] + "%";
        box.style.top = min[1] + "%";
        box.style.width = (max[0] - min[0]) + "%";
        box.style.height = (max[1] - min[1]) + "%";

        for (let name in openElements) {
            const data = openElements[name];
            const points = data.handle.points;
            if (
                min[0] < points[2][0] &&
                max[0] > points[0][0] &&
                min[1] < points[2][1] &&
                max[1] > points[0][1]
            ) {
                if (!data.clickzone.classList.contains("selected"))
                    selectElement(openElements[name].element);
            } else {
                if (data.clickzone.classList.contains("selected"))
                    deselectElement(openElements[name].element);
            }
        }
    }
    const mouseupEvent = (e) => {
        box.remove();
        document.removeEventListener("mousemove", mousemoveEvent);
        document.removeEventListener("mouseup", mouseupEvent);
    }
    document.addEventListener("mousemove", mousemoveEvent);
    document.addEventListener("mouseup", mouseupEvent);
}
function doodlemodeMousedown(e) {
    fh_doodle_tooltip.classList.add("hidden");

    const padding = 5;
    const gameRect = game.cachedGameRect;
    var canvasRect = [e.pageX - gameRect.left, e.pageY - gameRect.top, 0, 0];
    const element = createElement(
        canvasRect[0] / gameRect.width * 100,
        canvasRect[1] / gameRect.height * 100,
        1, 1,
        `<svg width="0" height="0" viewBox="0 0 0 0"><path fill="${doodleSettings.fill}" stroke="${doodleSettings.stroke}" stroke-width="${doodleSettings.strokeWidth}" d="" /></svg>`
    )
    const svg = element.querySelector("svg");
    const path = svg.firstElementChild;
    var pathPoints = [[0, 0]];

    const mousemoveEvent = (e) => {
        const min = [
            Math.min(canvasRect[0], (e.pageX - gameRect.left)),
            Math.min(canvasRect[1], (e.pageY - gameRect.top))
        ]
        const max = [
            Math.max(canvasRect[0] + canvasRect[2], (e.pageX - gameRect.left)),
            Math.max(canvasRect[1] + canvasRect[3], (e.pageY - gameRect.top))
        ]
        const offset = [
            min[0] - canvasRect[0],
            min[1] - canvasRect[1]
        ]
        updateElementPoints(element, [
            [(min[0] - padding) / game.cachedGameRect.width * 100, (min[1] - padding) / game.cachedGameRect.height * 100],
            [(max[0] + padding) / game.cachedGameRect.width * 100, (min[1] - padding) / game.cachedGameRect.height * 100],
            [(max[0] + padding) / game.cachedGameRect.width * 100, (max[1] + padding) / game.cachedGameRect.height * 100],
            [(min[0] - padding) / game.cachedGameRect.width * 100, (max[1] + padding) / game.cachedGameRect.height * 100]
        ]);
        canvasRect = [min[0], min[1], (max[0] - min[0]), (max[1] - min[1])];

        svg.setAttribute("width", canvasRect[2] + padding * 2);
        svg.setAttribute("height", canvasRect[3] + padding * 2);
        svg.setAttribute("viewBox", `0 0 ${canvasRect[2] + padding * 2} ${canvasRect[3] + padding * 2}`)

        for (let point of pathPoints) {
            point[0] -= offset[0];
            point[1] -= offset[1];
        }
        pathPoints.push([e.pageX - canvasRect[0] - gameRect.left, e.pageY - canvasRect[1] - gameRect.top]);
        var d = "";
        for (let i=0; i<pathPoints.length; i++) {
            d += i > 0 ? "L" : "M";
            d += `${pathPoints[i][0] + padding} ${pathPoints[i][1] + padding} `;
        }
        path.setAttribute("d", d);
    }
    const mouseupEvent = () => {
        if (canvasRect[2] === 0 && canvasRect[3] === 0) {
            deleteElement(element);
            return;
        }
        updateElementPoints(element, [
            [(canvasRect[0] - padding) / game.cachedGameRect.width * 100, (canvasRect[1] - padding) / game.cachedGameRect.height * 100],
            [(canvasRect[2] + canvasRect[0] + padding) / game.cachedGameRect.width * 100, (canvasRect[1] - padding) / game.cachedGameRect.height * 100],
            [(canvasRect[2] + canvasRect[0] + padding) / game.cachedGameRect.width * 100, (canvasRect[3] + canvasRect[1] + padding) / game.cachedGameRect.height * 100],
            [(canvasRect[0] - padding) / game.cachedGameRect.width * 100, (canvasRect[3] + canvasRect[1] + padding) / game.cachedGameRect.height * 100]
        ]);
        document.removeEventListener("mousemove", mousemoveEvent);
        document.removeEventListener("mouseup", mouseupEvent);
        save();
    }
    document.addEventListener("mousemove", mousemoveEvent);
    document.addEventListener("mouseup", mouseupEvent);
}
function textmodeMousedown(e) {
    const mousedownPosition = [e.pageX, e.pageY];
    for (let name in openElements) {
        if (openElements[name].clickzone.classList.contains("selected"))
            deselectElement(openElements[name].element);
    }
    const box = document.createElement("div");
    box.style.position = "absolute";
    box.style.border = "1px solid greenyellow";
    box.style.boxSizing = "border-box";
    editorOverlay.appendChild(box);
    const mousemoveEvent = (e) => {
        const rect = game.cachedGameRect;
        var min = [
            (Math.min(mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100, 
            (Math.min(mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100
        ];
        var max = [
            (Math.max(mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100, 
            (Math.max(mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100,
        ];
        box.style.left = min[0] + "%";
        box.style.top = min[1] + "%";
        box.style.width = (max[0] - min[0]) + "%";
        box.style.height = (max[1] - min[1]) + "%";
    }
    const mouseupEvent = (e) => {
        const rect = game.cachedGameRect;
        var x, y, w, h;
        var sizeSet = false;
        if (Math.abs(mousedownPosition[0] - e.pageX) + Math.abs(mousedownPosition[1] - e.pageY) > 3) {
            x = parseFloat(box.style.left);
            y = parseFloat(box.style.top);
            w = parseFloat(box.style.width);
            h = parseFloat(box.style.height);
            sizeSet = true;
        } else {
            x = (mousedownPosition[0] - rect.left) / rect.width * 100;
            y = (mousedownPosition[1] - rect.top) / rect.height * 100;
        }
        const element = createElement(x, y, w, h);
        if (!sizeSet) element.dataset.fithtml = "true";
        box.remove();
        selectElement(element);

        openElementInspector(element);
        var htmlInput = fh_element_inspector.querySelector("[name=html]");
        htmlInput.style.borderColor = "red";
        htmlInput.oninput = () => {
            setElementHTML(element, htmlInput.value);
            if (!sizeSet) {
                const x1 = x;
                const y1 = y;
                const x2 = x + (element.clientWidth / game.cachedGameRect.width * 100);
                const y2 = y + (element.clientHeight / game.cachedGameRect.height * 100);
                updateElementPoints(element, [
                    [x1, y1],
                    [x2, y1],
                    [x2, y2],
                    [x1, y2]
                ]);
            }
            if (element.innerHTML.trim() === "") {
                htmlInput.style.borderColor = "red";
            } else {
                htmlInput.style.borderColor = "";
            }
        }
        htmlInput.onblur = () => {
            if (element.innerHTML.trim() === "") {
                console.log("empty element deleted.");
                deleteElement(element);
            } else {
                htmlInput.onblur = null;
                openElementInspector(element);
            }
        }
        htmlInput.focus();

        switchMode();
        document.removeEventListener("mousemove", mousemoveEvent);
        document.removeEventListener("mouseup", mouseupEvent);
    }
    document.addEventListener("mousemove", mousemoveEvent);
    document.addEventListener("mouseup", mouseupEvent);
}

// save, undo, redo
function save() {
    console.log("saved.");
    history.push(document.querySelector(".fh-game").innerHTML);
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
    document.querySelector(".fh-game").innerHTML = state;

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

// slide functions
function addSlide() {
    // apply focus on slides container
    slidesContainer.onmousedown();

    const slide = document.createElement("div");
    slide.className = "fh-slide";

    var basename = "slide";
    var i = 1;
    if (game.currentSlide) {
        var nameExists = true;
        while (nameExists) {
            nameExists = false;
            for (let sibling of game.currentSlide.parentElement.children) {
                if (sibling.getAttribute("name") === basename + i) {
                    i++;
                    nameExists = true;
                }
            }
        }
    }
    var name = basename + i;
    slide.setAttribute("name", name);
    if (game.currentSlide) {
        game.currentSlide.after(slide);
    } else {
        game.gameElement.appendChild(slide);
    }
    
    const preview = createSlidePreview(slide);
    if (game.currentSlide) {
        const siblingPreview = findSlidePreview(game.currentSlide);
        var child = siblingPreview;
        while (parseInt(child.nextElementSibling.dataset.inset) > parseInt(siblingPreview.dataset.inset)) {
            child = child.nextElementSibling;
        }
        child.after(preview);
    }

    game.goto(game.getPath(slide));
    
    save();
}
function findSlidePreview(slide) {
    return slidesContainer.querySelector(`[data-path="${game.getPath(slide)}"]`);
}
function createSlidePreview(slide) {
    const originalPath = game.getPath(slide);
    const originalNextSibling = slide.nextElementSibling;
    const originalPreviousSibling = slide.previousElementSibling;
    const name = slide.getAttribute("name");
    const container = document.createElement("div");
    container.setAttribute("name", name);
    container.dataset.path = originalPath;

    var inset = 0;
    var parentSlide = slide.parentElement;
    while (parentSlide !== game.gameElement) {
        inset++;
        parentSlide = parentSlide.parentElement;
    }
    container.dataset.inset = inset;
    
    container.className = "fh-slide-preview-container";
    if (slide.classList.contains("open")) {
        container.classList.add("selected");
    }
    container.onmousedown = (e) => {
        game.goto(container.dataset.path);
        var mousedownPosition = [e.pageX, e.pageY];
        const mousemoveEvent = (e) => {
            if (Math.abs(mousedownPosition[0] - e.pageX) + Math.abs(mousedownPosition[1] - e.pageY) <= 5) {
                return;
            }
            mouseupEvent();
            const rect = container.getBoundingClientRect();
            var offset = [
                rect.left - mousedownPosition[0],
                rect.top - mousedownPosition[1]
            ]
            var clone = container.cloneNode(true);
            clone.style.position = "absolute";
            clone.style.width = rect.width + "px";
            clone.style.height = rect.height + "px";
            clone.style.background = "none";
            clone.querySelector("label").remove();
            document.querySelector(".fh-editor").appendChild(clone);
            container.classList.add("dragging");

            var originalInset = parseInt(container.dataset.inset);
            var collapsedSlides = [];
            if (container.classList.contains("collapsed")) {
                var collapsed = container.nextElementSibling;
                while (collapsed && parseInt(collapsed.dataset.inset) > originalInset) {
                    collapsedSlides.push(collapsed);
                    collapsed = collapsed.nextElementSibling;
                }
            }

            var mmEvent = (e) => {
                clone.style.left = (offset[0] + e.pageX) + "px";
                clone.style.top = (offset[1] + e.pageY) + "px";
                for (let slide of slidesContainer.children) {
                    if (slide === container) continue;
                    const rect = slide.getBoundingClientRect();
                    if (e.pageY > rect.top && e.pageY < rect.bottom) {
                        var ratio = 1/2;
                        if (slide === slidesContainer.firstElementChild)
                            ratio = 4/5;
                        if (e.pageY < rect.top + rect.height * ratio) {
                            slidesContainer.insertBefore(container, slide);
                        } else {
                            if (slide.classList.contains("collapsed")) {
                                var lastChild = slide.nextElementSibling;
                                while (lastChild.nextElementSibling && parseInt(lastChild.nextElementSibling.dataset.inset) > parseInt(slide.dataset.inset)) {
                                    lastChild = lastChild.nextElementSibling;
                                }
                                lastChild.after(container);
                            } else {
                                slide.after(container);
                            }
                        }
                        break;
                    }
                }

                var previous = container.previousElementSibling;
                while (previous && previous.style.display == "none") {
                    previous = previous.previousElementSibling;
                }
                if (previous) {
                    const style = getComputedStyle(slidesContainer);
                    const insetMargin = parseFloat(style.getPropertyValue("--inset-margin"));
                    const padding = parseFloat(style.getPropertyValue("--preview-padding"));
                    const pixelsInset = clone.querySelector(".fh-slide-preview").getBoundingClientRect().left - slidesContainer.getBoundingClientRect().left - padding;
                    var maxInset = parseInt(previous.dataset.inset) + 1;
                    var targetInset = 0;
                    if (pixelsInset > insetMargin) {
                        targetInset = Math.floor(pixelsInset / insetMargin);
                        targetInset = Math.min(maxInset, targetInset);
                    }
                    container.dataset.inset = targetInset;
                    updateSlidePreviewScale(container.querySelector(".fh-slide-preview-bg"));
                }
            }
            var muEvent = () => {
                for (let collapsed of collapsedSlides) {
                    collapsed.dataset.inset = parseInt(collapsed.dataset.inset) - originalInset + parseInt(container.dataset.inset);
                }
                container.after(...collapsedSlides);
                reorderPreviews();
                clone.remove();
                container.classList.remove("dragging");
                document.removeEventListener("mousemove", mmEvent);
                document.removeEventListener("mouseup", muEvent);
                if (
                    game.getPath(slide) !== originalPath || 
                    slide.nextElementSibling !== originalNextSibling ||
                    slide.previousElementSibling !== originalPreviousSibling
                )
                    save();
            }
            document.addEventListener("mousemove", mmEvent);
            document.addEventListener("mouseup", muEvent);
        }
        const mouseupEvent = () => {
            document.removeEventListener("mousemove", mousemoveEvent);
            document.removeEventListener("mouseup", mouseupEvent);
        }
        document.addEventListener("mousemove", mousemoveEvent);
        document.addEventListener("mouseup", mouseupEvent);
    }

    const previewBg = document.createElement("div");
    previewBg.className = "fh-slide-preview-bg";
    container.appendChild(previewBg);

    const preview = document.createElement("div");
    preview.className = "fh-slide-preview";
    previewBg.appendChild(preview);

    const label = document.createElement("label");
    label.textContent = name;
    container.appendChild(label);

    const button = document.createElement("button");
    button.textContent = "v";
    button.style.display = "none";
    container.appendChild(button);
    button.onclick = () => {
        togglePreviewCollapse(container);
    }

    slidesContainer.appendChild(container);
    updateSlidePreview(slide);
    if (game.cachedGameRect)
        updateSlidePreviewScale(previewBg);

    return container;
}
function togglePreviewCollapse(preview) {
    var button = preview.querySelector("button");
    preview.classList.toggle("collapsed");
    if (preview.classList.contains("collapsed")) {
        button.textContent = ">";
    } else {
        button.textContent = "v";
    }
    var inset = parseInt(preview.dataset.inset);
    var nextPreview = preview.nextElementSibling;
    while (nextPreview && parseInt(nextPreview.dataset.inset) > inset) {
        var hidden = preview.classList.contains("collapsed");
        var parentPreview = getParentPreview(nextPreview);
        while (!hidden && parentPreview !== preview) {
            if (parentPreview.classList.contains("collapsed"))
                hidden = true;
            parentPreview = getParentPreview(parentPreview);
        }
        nextPreview.style.display = hidden ? "none" : "block";
        nextPreview = nextPreview.nextElementSibling;
    }
}
function getParentPreview(preview) {
    var parentPreview = preview.previousElementSibling;
    while (parentPreview && parseInt(parentPreview.dataset.inset) >= parseInt(preview.dataset.inset)) {
        parentPreview = parentPreview.previousElementSibling;
    }
    return parentPreview;
}
function updateSlidePreview(slide) {
    slide = slide || game.currentSlide;
    var preview = findSlidePreview(slide)?.querySelector(".fh-slide-preview");
    if (preview) {
        preview.innerHTML = slide.innerHTML;
    }
}
function updateSlidePreviewScale(preview) {
    const inset = parseInt(preview.parentElement.dataset.inset);
    const style = getComputedStyle(slidesContainer);
    const padding = parseFloat(style.getPropertyValue("--preview-padding"));
    const insetMargin = parseFloat(style.getPropertyValue("--inset-margin"));
    const size = parseFloat(style.getPropertyValue("--preview-size"));
    var aspectRatio = parseFloat(game.gameElement.dataset.aspectratio);
    if (!aspectRatio || isNaN(aspectRatio)) aspectRatio = 1;

    var scale;
    if (aspectRatio < 1) {
        scale = size / game.cachedGameRect.height;
    } else {
        scale = size / game.cachedGameRect.width;
    }

    preview.style.width = game.gameElement.style.width;
    preview.style.height = game.gameElement.style.height;
    preview.style.fontSize = game.gameElement.style.fontSize;
    preview.style.transform = `scale(${scale})`;

    var left = insetMargin * inset + parseFloat(style.getPropertyValue("--preview-left-margin"));
    preview.style.left = left + "px";
    preview.nextElementSibling.style.left = left + "px";
    preview.style.top = padding + "px";

    preview.parentElement.style.width = Math.max(
        250, 
        game.cachedGameRect.width * scale + insetMargin * inset + parseFloat(style.getPropertyValue("--preview-right-margin")) + parseFloat(style.getPropertyValue("--preview-left-margin"))
    ) + "px";
    preview.parentElement.style.height = ((game.cachedGameRect.height * scale) + padding * 2) + "px";

    var button = preview.parentElement.querySelector("button");
    button.style.left = insetMargin * inset + "px";
}
function reorderPreviews() {
    var slidePreviewPairs = [];
    for (let preview of slidesContainer.children) {
        slidePreviewPairs.push({
            preview: preview,
            slide: game.getElementAtPath(preview.dataset.path)
        })
    }
    const getSlide = (preview) => {
        for (let check of slidePreviewPairs) {
            if (check.preview === preview)
                return check.slide;
        }
        return null;
    }
    for (let selected of slidesContainer.querySelectorAll(".selected")) {
        const slide = getSlide(selected);
        var name = slide.getAttribute("name");
        var nameExists = true;
        while (nameExists) {
            nameExists = false;
            for (let child of slide.parentElement.querySelectorAll(`:scope > [name="${name}"]`)) {
                if (child !== slide) {
                    name = name + "*";
                    nameExists = true;
                }
            }
        }
        if (name !== slide.getAttribute("name")) {
            renameElement(slide, name, selected);
        }
    }
    for (let preview of slidesContainer.children) {
        const slide = getSlide(preview);
        const inset = parseInt(preview.dataset.inset);
        var parentPreview = getParentPreview(preview);
        if (parentPreview) {
            preview.dataset.inset = parseInt(parentPreview.dataset.inset) + 1;
            const parentSlide = getSlide(parentPreview);
            var name = slide.getAttribute("name");
            var nameExists = true;
            while (nameExists) {
                nameExists = false;
                for (let child of parentSlide.children) {
                    if (child !== slide && child.getAttribute("name") === name) {
                        name = name + "*";
                        nameExists = true;
                    }
                }
            }
            if (name !== slide.getAttribute("name")) {
                renameElement(slide, name, preview);
            }
            parentSlide.appendChild(slide);
            preview.dataset.path = game.getPath(slide);
        } else {
            preview.dataset.inset = "0";
            var nextPreview = preview.nextElementSibling;
            while (nextPreview && parseInt(nextPreview.dataset.inset) >= inset) {
                nextPreview.dataset.inset = parseInt(nextPreview.dataset.inset) - inset;
                nextPreview = nextPreview.nextElementSibling;
            }
            game.gameElement.appendChild(slide);
            preview.dataset.path = game.getPath(slide);
        }

        updateSlidePreviewScale(preview.querySelector(".fh-slide-preview-bg"));
    }
    for (let preview of slidesContainer.children) {
        preview.querySelector("button").style.display = "none";
        if (getSlide(preview).querySelectorAll(":scope > .fh-slide").length > 0) {
            preview.querySelector("button").style.display = "block";
        }
    }
    const selectedPreview = slidesContainer.querySelector(".selected");
    if (selectedPreview) {
        const parent = getParentPreview(selectedPreview);
        if (parent && parent.classList.contains("collapsed")) {
            togglePreviewCollapse(parent);
        }
        selectElement(getSlide(selectedPreview));
        game.goto(game.currentSlide);
    }
}

// element functions
function createElement(x, y, w, h, content) {
    content = content || "";
    
    var basename = "element";
    var i = 1;
    while (game.currentSlide.querySelector(`:scope > [name="${basename+i}"]`)) {
        i++;
    }
    const name = basename + i;

    const element = document.createElement("div");
    element.className = "fh-element";
    element.innerHTML = content;
    element.setAttribute("name", name);
    game.currentSlide.appendChild(element);

    x = x || 0;
    y = y || 0;
    w = w || element.clientWidth;
    h = h || element.clientHeight;

    element.dataset.x1 = x;
    element.dataset.y1 = y;
    element.dataset.x2 = x + w;
    element.dataset.y2 = y;
    element.dataset.x3 = x + w;
    element.dataset.y3 = y + h;
    element.dataset.x4 = x;
    element.dataset.y4 = y + h;

    openElement(element);

    for (let asset of element.querySelectorAll("[data-filepath]")) {
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
        if (asset.tagName === "source") {
            asset.parentElement.load();
            asset.parentElement.onloadeddata = () => {
                game.updateTransform(element);
            }
        } else {
            asset.onload = () => {
                game.updateTransform(element);
            }
        }
    }

    return element;
}
function openElement(element) {
    openElements[element.getAttribute("name")] = {
        element: element,
        clickzone: createEditorClickzone(element),
        handle: createElementHandle(element),
    }
    updateElementPoints(element, createElementPointsArray(element));
}
function setElementHTML(element, html) {
    element.innerHTML = html;
    if (element.dataset.fithtml) {
        var origin = getElementTopLeft(element);
        element.removeAttribute("data-x1");
        element.removeAttribute("data-y1");
        element.removeAttribute("data-x2");
        element.removeAttribute("data-y2");
        element.removeAttribute("data-x3");
        element.removeAttribute("data-y3");
        element.removeAttribute("data-x4");
        element.removeAttribute("data-y4");
        updateElementPoints(element, createElementPointsArray(element));
        setElementTopLeft(element, origin);
    }
    if (element.getAttribute("name") in openElements) {
        game.updateTransform(element);
    }
    updateSlidePreview(element.parentElement);
}
function deleteElement(element) {
    if (element.classList.contains("fh-element")) {
        deselectElement(element);
        const slide = element.parentElement;
        if (slide === game.currentSlide) {
            const name = element.getAttribute("name");
            const data = openElements[name];
            data.clickzone.remove();
            data.handle.svg.remove();
            delete openElements[name];
        }
        element.remove();
        updateSlidePreview(slide);
    } else if (element.classList.contains("fh-slide")) {
        const preview = findSlidePreview(element);
        const nextPreview = preview.nextElementSibling || preview.previousElementSibling;

        if (game.currentSlide === element)
            game.currentSlide = null;

        preview.remove();
        reorderPreviews();
        element.remove();
        reorderPreviews();

        if (!nextPreview) {
            addSlide();
        } else {
            game.goto(nextPreview.dataset.path);
        }
    }
}
function deselectElement(element) {
    if (element.parentElement === game.currentSlide) {
        const data = openElements[element.getAttribute("name")];
        data.clickzone.classList.remove("selected");
        data.handle.svg.style.display = "none";
        if (fh_inspect_element.classList.contains("selected"))
            openElementInspector();
    }
}
function selectElement(element) {
    if (element.parentElement === game.currentSlide) {
        const data = openElements[element.getAttribute("name")];
        data.clickzone.classList.add("selected");
        data.handle.svg.style.display = "block";
        if (fh_inspect_element.classList.contains("selected"))
            openElementInspector(element);
    }
}
function renameElement(element, name, preview) {
    if (element.classList.contains("fh-slide")) {
        preview = preview || findSlidePreview(element);
        preview.querySelector("label").textContent = name;
        preview.setAttribute("name", name);
        
        var repath = [];
        repath.push({
            preview: preview,
            element: element
        })
        for (let childSlide of element.querySelectorAll(".fh-slide")) {
            const preview = findSlidePreview(childSlide);
            repath.push({
                preview: preview,
                element: childSlide
            })
        }

        element.setAttribute("name", name);

        for (let data of repath) {
            data.preview.dataset.path = game.getPath(data.element);
        }

        if (fh_inspect_element.classList.contains("selected")) {
            editorInspector.querySelector("[name=rename]").value = name;
        }
    } else if (element.classList.contains("fh-element")) {
        if (element.parentElement === game.currentSlide) {
            const data = openElements[element.getAttribute("name")];
            data.clickzone.setAttribute("name", name);
            data.handle.svg.setAttribute("name", name);
            delete openElements[element.getAttribute("name")];
            openElements[name] = data;
        }

        element.setAttribute("name", name);

        if (element.parentElement === game.currentSlide) {
            const data = openElements[element.getAttribute("name")];
            if (data.clickzone.classList.contains("selected") && fh_inspect_element.classList.contains("selected"))
                editorInspector.querySelector("[name=rename]").value = name;
        }
    }
}
function openElementInspector(element) {
    if (!element) {
        const selectedElement = editorOverlay.querySelector(".selected");
        if (selectedElement) {
            element = openElements[selectedElement.getAttribute("name")].element;
        } else {
            element = game.currentSlide;
        }
    }

    for (let inspectors of editorInspector.children)
        inspectors.classList.add("hidden");

    var nameInput;
    if (element.classList.contains("fh-element")) {
        fh_element_inspector.classList.remove("hidden");

        fh_element_inspector.querySelector("[name=onshow]").value = element.dataset.onshow ? element.dataset.onshow : "";
        fh_element_inspector.querySelector("[name=onshow]").oninput = function() {
            element.dataset.onshow = this.value;
        }
        fh_element_inspector.querySelector("[name=onshow]").onchange = save;
        fh_element_inspector.querySelector("[name=onclick").value = element.dataset.onclick ? element.dataset.onclick : "";
        fh_element_inspector.querySelector("[name=onclick]").oninput = function() {
            element.dataset.onclick = this.value;
        }
        fh_element_inspector.querySelector("[name=onclick]").onchange = save;

        const htmlInput = fh_element_inspector.querySelector("[name=html]");
        htmlInput.onkeydown = e => {
            if (shiftKey && e.key === 'Enter') {
                element.innerHTML += "<br>";
                htmlInput.value += "<br>";
            }
        }
        htmlInput.style.borderColor = "";
        htmlInput.oninput = () => {
            setElementHTML(element, htmlInput.value);
            if (element.innerHTML.trim() === "") {
                htmlInput.style.borderColor = "red";
            } else {
                htmlInput.style.borderColor = "";
            }
        }
        htmlInput.onchange = () => {
            htmlInput.value = element.innerHTML;
            if (htmlInput.value.trim() === "") {
                console.log("empty element deleted.");
                deleteElement(element);
            }
            save();
        }
        htmlInput.value = element.innerHTML;
        
        const fitCheckbox = fh_element_inspector.querySelector("[name=fit-html]");
        fitCheckbox.checked = !!element.dataset.fithtml;
        fitCheckbox.onchange = () => {
            if (fitCheckbox.checked) {
                element.dataset.fithtml = "true";
                var center = getElementCenter(element);
                element.removeAttribute("data-x1");
                element.removeAttribute("data-y1");
                element.removeAttribute("data-x2");
                element.removeAttribute("data-y2");
                element.removeAttribute("data-x3");
                element.removeAttribute("data-y3");
                element.removeAttribute("data-x4");
                element.removeAttribute("data-y4");
                updateElementPoints(element, createElementPointsArray(element));
                setElementCenter(element, center);
            } else {
                element.removeAttribute("data-fithtml");
            }
        }

        nameInput = fh_element_inspector.querySelector("[name=rename]");
    } else {
        fh_slide_inspector.classList.remove("hidden");

        fh_slide_inspector.querySelector("[name=onenter]").value = element.dataset.onenter ? element.dataset.onenter : "";
        fh_slide_inspector.querySelector("[name=onenter]").oninput = function() {
            element.dataset.onenter = this.value;
        }
        fh_slide_inspector.querySelector("[name=onenter]").onchange = save;
        fh_slide_inspector.querySelector("[name=onexit]").value = element.dataset.onexit ? element.dataset.onexit : "";
        fh_slide_inspector.querySelector("[name=onexit]").oninput = function() {
            element.dataset.onexit = this.value;
        }
        fh_slide_inspector.querySelector("[name=onexit]").onchange = save;

        const cssInput = fh_slide_inspector.querySelector("[name=css]");
        var styleElement = element.querySelector(":scope > style");
        if (!styleElement) {
            styleElement = document.createElement("style");
            // for whatever reason, writing ":scope { background: transparent }" here causes scope issues.
            styleElement.textContent = "@scope {\n}";
            element.prepend(styleElement);
        }
        cssInput.value = styleElement.textContent;
        cssInput.oninput = () => {
            styleElement.textContent = cssInput.value;
            for (let name in openElements) {
                game.updateTransform(openElements[name].element);
            }
            updateSlidePreview(element);
        }
        cssInput.onchange = save;

        nameInput = fh_slide_inspector.querySelector("[name=rename]");
    }

    nameInput.onchange = nameInput.onblur = function() {
        if (!element.parentElement) return;
        var name = this.value.trim();
        var nameExists = true;
        while (nameExists) {
            nameExists = false;
            for (let sibling of element.parentElement.querySelectorAll(`:scope > [name="${name}"]`)) {
                if (sibling !== element) {
                    name = name + "*";
                    nameExists = true;
                }
            }
        }
        if (name !== element.getAttribute("name")) {
            renameElement(element, name);
        }
    }
    nameInput.value = element.getAttribute("name");
    nameInput.onchange = save;

    for (let textarea of editorInspector.querySelectorAll("textarea")) {
        textarea.setAttribute("autocomplete", "off");
        textarea.setAttribute("autocorrect", "off");
        textarea.setAttribute("autocapitalize", "off");
        textarea.setAttribute("spellcheck", "off");
        textarea.style.width = "100%";
        textarea.style.height = (textarea.scrollHeight + 2) + "px";
    }
    
    const selectedInspector = document.body.querySelector(".fh-toolbar .inspector_button.selected");
    if (selectedInspector)
        selectedInspector.classList.remove("selected");
    fh_inspect_element.classList.add("selected");
}
function updateElementPoints(element, points) {
    var min = [Infinity, Infinity];
    var max = [-Infinity, -Infinity];
    for (let i=0; i<4; i++) {
        let point = points[i];
        min = [
            Math.min(point[0], min[0]),
            Math.min(point[1], min[1])
        ]
        max = [
            Math.max(point[0], max[0]),
            Math.max(point[1], max[1])
        ]
    }

    if (openElements[element.getAttribute("name")]) {
        const data = openElements[element.getAttribute("name")];

        data.handle.points = points;

        const clickzone = data.clickzone;
        clickzone.style.left = min[0] + "%";
        clickzone.style.top = min[1] + "%";
        clickzone.style.width = (max[0] - min[0]) + "%";
        clickzone.style.height = (max[1] - min[1]) + "%";

        for (let i=0; i<4; i++) {
            const point = points[i];
            const vvert = data.handle.visibleVertices[i];
            const ivert = data.handle.invisibleVertices[i];
            vvert.setAttribute("cx", point[0] + "%");
            vvert.setAttribute("cy", point[1] + "%");
            ivert.setAttribute("cx", point[0] + "%");
            ivert.setAttribute("cy", point[1] + "%");

            const npoint = points[i >= 3 ? 0 : i + 1];
            const vedge = data.handle.visibleEdges[i];
            const iedge = data.handle.invisibleEdges[i];
            vedge.setAttribute("x1", point[0] + "%");
            vedge.setAttribute("y1", point[1] + "%");
            vedge.setAttribute("x2", npoint[0] + "%");
            vedge.setAttribute("y2", npoint[1] + "%");
            iedge.setAttribute("x1", point[0] + "%");
            iedge.setAttribute("y1", point[1] + "%");
            iedge.setAttribute("x2", npoint[0] + "%");
            iedge.setAttribute("y2", npoint[1] + "%");
        }
    }

    element.dataset.x1 = points[0][0];
    element.dataset.y1 = points[0][1];
    element.dataset.x2 = points[1][0];
    element.dataset.y2 = points[1][1];
    element.dataset.x3 = points[2][0];
    element.dataset.y3 = points[2][1];
    element.dataset.x4 = points[3][0];
    element.dataset.y4 = points[3][1];

    game.updateTransform(element);
    updateSlidePreview(element.parentElement);
}
function getElementMinMax(element) {
    var points;
    if (element.parentElement === game.currentSlide) {
        points = openElements[element.getAttribute("name")].handle.points;
    } else {
        points = createElementPointsArray(element);
    }
    var min = [Infinity, Infinity];
    var max = [-Infinity, -Infinity];
    for (let i=0; i<4; i++) {
        let point = points[i];
        min = [
            Math.min(point[0], min[0]),
            Math.min(point[1], min[1])
        ]
        max = [
            Math.max(point[0], max[0]),
            Math.max(point[1], max[1])
        ]
    }
    return { min, max };
}
function getElementTopLeft(element) {
    var mm = getElementMinMax(element);
    return mm.min;
}
function setElementTopLeft(element, position) {
    var mm = getElementMinMax(element);
    var w = mm.max[0] - mm.min[0];
    var h = mm.max[1] - mm.min[1];
    updateElementPoints(element, [
        [position[0], position[1]],
        [position[0] + w, position[1]],
        [position[0] + w, position[1] + h],
        [position[0], position[1] + h]
    ]);
}
function getElementCenter(element) {
    var points;
    if (element.parentElement === game.currentSlide) {
        points = openElements[element.getAttribute("name")].handle.points;
    } else {
        points = createElementPointsArray(element);
    }
    var c = [0, 0];
    for (let i=0; i<4; i++) {
        c[0] += points[i][0];
        c[1] += points[i][1];
    }
    return [
        c[0] / 4,
        c[1] / 4
    ]
}
function setElementCenter(element, position) {
    const c = getElementCenter(element);
    var p;
    if (element.parentElement === game.currentSlide) {
        p = openElements[element.getAttribute("name")].handle.points;
    } else {
        p = createElementPointsArray(element);
    }
    const x = position[0] - c[0];
    const y = position[1] - c[1];
    updateElementPoints(element, [
        [p[0][0] + x, p[0][1] + y],
        [p[1][0] + x, p[1][1] + y],
        [p[2][0] + x, p[2][1] + y],
        [p[3][0] + x, p[3][1] + y]
    ]);
}
function sendElementToBack(element) {
    element.parentElement.prepend(element);
    if (element.parentElement === game.currentSlide) {
        const data = openElements[element.getAttribute("name")];
        const svg = data.handle.svg;
        svg.parentElement.prepend(svg);
        const clickzone = data.clickzone;
        clickzone.parentElement.prepend(clickzone);
    }
}
function bringElementToFront(element) {
    element.parentElement.appendChild(element);
    if (element.parentElement === game.currentSlide) {
        const data = openElements[element.getAttribute("name")];
        const clickzone = data.clickzone;
        clickzone.parentElement.appendChild(clickzone);
        const svg = data.handle.svg;
        svg.parentElement.appendChild(svg);
    }
}
function isHTML(string) {
    const fragment = document.createRange().createContextualFragment(string);
    fragment.querySelectorAll('*').forEach(el => el.parentNode.removeChild(el));
    return !(fragment.textContent || '').trim();
}
function pasteHTML(html, parent) {
    if (!isHTML(html)) {
        html = `<div class="fh-element" name="element1">${html}</div>`;
    }

    var beforeCount = parent.children.length;
    parent.insertAdjacentHTML("beforeend", html);
    var newElementCount = parent.children.length - beforeCount;

    for (let i=0; i<newElementCount; i++) {
        var element = parent.children[beforeCount + i];
        var actualParent = parent;
        if (element.classList.contains("fh-slide"))
            actualParent = parent.parentElement;
        if (!element.classList.contains("fh-slide") && !element.classList.contains("fh-element")) {
            var newEl = document.createElement("div");
            newEl.className = "fh-element";
            newEl.setAttribute("name", "element1");
            newEl.innerHTML = element.outerHTML;
            element.replaceWith(newEl);
            element = newEl;
        }

        var duplicateName = () => {
            const name = element.getAttribute("name");
            for (let child of actualParent.children) {
                if (child !== element && child.getAttribute("name") === name) {
                    return true;
                }
            }
            return false;
        };
        while (duplicateName()) {
            element.setAttribute("name", element.getAttribute("name") + "*");
        }

        if (element.classList.contains("fh-slide")) {
            actualParent.appendChild(element);
            var preview = createSlidePreview(element);
            if (parent.classList.contains("fh-slide")) {
                var previousPreview = findSlidePreview(parent);
                while (
                    previousPreview.nextElementSibling &&
                    parseInt(previousPreview.nextElementSibling.dataset.inset) > parseInt(preview.dataset.inset)
                ) {
                    previousPreview = previousPreview.nextElementSibling;
                }
                previousPreview.after(preview);
            }
            preview.classList.remove("selected");
        } else {
            if (parent === game.currentSlide) {
                openElement(element);
            }
            selectElement(element);
        }
    }
}
function createEditorClickzone(element) {
    const clickzone = document.createElement("div");
    clickzone.className = "fh-editor-clickzone";
    clickzone.setAttribute("name", element.getAttribute("name"));
    editorOverlay.appendChild(clickzone);

    var grabbedClickzones = [];
    var grabOffsets;
    var mousedownPosition;
    var cancelClick = false;
    var initialClick = false;
    var doubleClick = false;
    var doubleClickTimeout;

    clickzone.onwheel = (e) => {
        var points = openElements[element.getAttribute("name")].handle.points;
        const rect = game.cachedGameRect;
        const anchor = [
            (e.pageX - rect.left) / rect.width * 100,
            (e.pageY - rect.top) / rect.height * 100
        ]
        const scale = 1 + (e.deltaY / 1000);
        for (let point of points) {
            point[0] = anchor[0] + (point[0] - anchor[0]) * scale;
            point[1] = anchor[1] + (point[1] - anchor[1]) * scale;
        }
        updateElementPoints(element, points);
        e.preventDefault();
    }
    const mousemoveEvent = (e) => {
        if (Math.abs(mousedownPosition[0] - e.pageX) + Math.abs(mousedownPosition[1] - e.pageY) > 3) {
            cancelClick = true;
            doubleClick = false;
        }
        const rect = game.cachedGameRect;
        const x = (e.pageX - rect.left) / rect.width * 100;
        const y = (e.pageY - rect.top) / rect.height * 100;
        for (let i=0; i<grabbedClickzones.length; i++) {
            const clickzone = grabbedClickzones[i];
            const element = openElements[clickzone.getAttribute("name")].element;
            const offset = grabOffsets[i];
            setElementCenter(element, [offset[0] + x, offset[1] + y]);
        }
    }
    const mouseupEvent = () => {
        if (element.parentElement) {
            const points = openElements[element.getAttribute("name")].handle.points;
            if (!(
                points[0][0] < 100 &&
                points[2][0] > 0 &&
                points[0][1] < 100 &&
                points[2][0] > 0
            )) {
                console.log("out of bounds element deleted.");
                deleteElement(element);
            }
        }
        document.removeEventListener("mousemove", mousemoveEvent);
        document.removeEventListener("mouseup", mouseupEvent);

        if (cancelClick)
            save();
    }
    clickzone.onmouseup = (e) => {
        if (editMode === "select" && e.button === 0) {
            if (!cancelClick) {
                if (shiftKey && clickzone.classList.contains("selected")) {
                    deselectElement(element);
                } else {
                    selectElement(element);

                    if (doubleClick) {
                        openElementInspector(element);
                        setTimeout(() => {
                            const textarea = editorInspector.querySelector("textarea");
                            if (textarea) {
                                textarea.focus();
                                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                            }
                        }, 1);
                        doubleClick = false;
                    }
                }
            }
        }
    }
    clickzone.onmousedown = (e) => {
        mousedownPosition = [e.pageX, e.pageY];

        if (editMode === "select" && e.button === 0) {
            if (!initialClick) {
                initialClick = true;
                doubleClick = false;
                doubleClickTimeout = setTimeout(() => {
                    initialClick = false;
                }, 500);
            } else {
                clearTimeout(doubleClickTimeout);
                initialClick = false;
                doubleClick = !cancelClick;
            }
            cancelClick = false;

            if (!shiftKey && !clickzone.classList.contains("selected")) {
                for (let name in openElements) {
                    if (openElements[name].clickzone.classList.contains("selected"))
                        deselectElement(openElements[name].element);
                }
            }

            const rect = game.cachedGameRect;
            const x = (e.pageX - rect.left) / rect.width * 100;
            const y = (e.pageY - rect.top) / rect.height * 100;

            const selected = editorOverlay.querySelectorAll(".fh-editor-clickzone.selected");
            if (clickzone.classList.contains("selected")) {
                grabbedClickzones = [...selected];
            } else if (shiftKey) {
                grabbedClickzones = [...selected, clickzone];
            } else {
                grabbedClickzones = [clickzone];
            }
            
            grabOffsets = [];
            for (let clickzone of grabbedClickzones) {
                const name = clickzone.getAttribute("name");
                const el = openElements[name].element;
                if (!shiftKey) {
                    bringElementToFront(el);
                    save();
                }
                const center = getElementCenter(el);
                grabOffsets.push([
                    center[0] - x,
                    center[1] - y
                ]);
            }

            document.addEventListener("mousemove", mousemoveEvent);
            document.addEventListener("mouseup", mouseupEvent);
        }
    }
    clickzone.addEventListener("contextmenu", e => {
        sendElementToBack(element);
        save();
        e.preventDefault();
    })

    return clickzone;
}
function createElementHandle(element) {
    const name = element.getAttribute("name");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "fh-element-handle");
    svg.setAttribute("name", name);
    editorOverlay.appendChild(svg);

    const handle = {
        svg: svg,
        points: createElementPointsArray(element),
        visibleVertices: [],
        invisibleVertices: [],
        visibleEdges: [],
        invisibleEdges: []
    };

    for (let i=0; i<4; i++) {
        // edges

        const vedge = document.createElementNS("http://www.w3.org/2000/svg", "line");
        vedge.setAttribute("stroke-width", "var(--handle-stroke-width)");
        vedge.setAttribute("stroke", "var(--handle-color)");
        svg.appendChild(vedge);
        handle.visibleEdges.push(vedge);

        const iedge = document.createElementNS("http://www.w3.org/2000/svg", "line");
        iedge.setAttribute("stroke-width", "15");
        iedge.setAttribute("stroke", "transparent");
        svg.appendChild(iedge);
        handle.invisibleEdges.push(iedge);

        var edgeOffsets;
        iedge.onmouseover = () => {
            vedge.setAttribute("stroke", "var(--handle-hover-color)");
        }
        iedge.onmouseleave = () => {
            vedge.setAttribute("stroke", "var(--handle-color)");
        }
        iedge.onmousedown = (e) => {
            const rect = svg.getBoundingClientRect();
            const x = (e.pageX - rect.left) / game.cachedGameRect.width * 100;
            const y = (e.pageY - rect.top) / game.cachedGameRect.height * 100;
            edgeOffsets = [
                [
                    handle.points[i][0] - x,
                    handle.points[i][1] - y
                ],
                [
                    handle.points[i >= 3 ? 0 : i + 1][0] - x,
                    handle.points[i >= 3 ? 0 : i + 1][1] - y
                ]
            ];
            const mousemoveEvent = (e) => {
                const rect = svg.getBoundingClientRect();
                const x = (e.pageX - rect.left) / game.cachedGameRect.width * 100;
                const y = (e.pageY - rect.top) / game.cachedGameRect.height * 100;
                const n = i >= 3 ? 0 : i + 1;
                if (shiftKey) {
                    if (Math.abs(handle.points[i][0] - handle.points[n][0]) > Math.abs(handle.points[i][1] - handle.points[n][1])) {
                        handle.points[i][1] = y + edgeOffsets[0][1];
                        handle.points[n][1] = y + edgeOffsets[1][1];
                    } else {
                        handle.points[i][0] = x + edgeOffsets[0][0];
                        handle.points[n][0] = x + edgeOffsets[1][0];
                    }
                } else {
                    handle.points[i] = [x + edgeOffsets[0][0], y + edgeOffsets[0][1]];
                    handle.points[n] = [x + edgeOffsets[1][0], y + edgeOffsets[1][1]];
                }
                updateElementPoints(element, handle.points);
                if (element.dataset.fithtml) {
                    element.removeAttribute("data-fithtml");
                    openElementInspector(element);
                }
            }
            const mouseupEvent = () => {
                document.removeEventListener("mouseup", mouseupEvent);
                document.removeEventListener("mousemove", mousemoveEvent);
            }
            document.addEventListener("mouseup", mouseupEvent);
            document.addEventListener("mousemove", mousemoveEvent);
        }
    }

    for (let i=0; i<4; i++) {
        // vertices
        
        const vvert = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        vvert.setAttribute("r", "3");
        vvert.setAttribute("fill", "white");
        vvert.setAttribute("stroke", "var(--handle-color)");
        vvert.setAttribute("stroke-width", "var(--handle-stroke-width)");
        svg.appendChild(vvert);
        handle.visibleVertices.push(vvert);

        const ivert = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ivert.setAttribute("r", "10");
        ivert.setAttribute("fill", "transparent");
        svg.appendChild(ivert);
        handle.invisibleVertices.push(ivert);

        ivert.onmouseover = () => {
            vvert.setAttribute("stroke", "var(--handle-hover-color)");
        }
        ivert.onmouseleave = () => {
            vvert.setAttribute("stroke", "var(--handle-color)");
        }
        ivert.onmousedown = () => {
            const mousemoveEvent = (e) => {
                const parentRect = svg.getBoundingClientRect();
                const x = (e.pageX - parentRect.left) / game.cachedGameRect.width * 100;
                const y = (e.pageY - parentRect.top) / game.cachedGameRect.height * 100;
                handle.points[i] = [x, y];
                if (shiftKey) {
                    var prev = i-1 < 0 ? 3 : i-1;
                    var next = i+1 > 3 ? 0 : i+1;
                    handle.points[(i%2==0 ? prev : next)][0] = handle.points[i][0];
                    handle.points[(i%2==0 ? next : prev)][1] = handle.points[i][1];
                }
                updateElementPoints(element, handle.points);
                if (element.dataset.fithtml) {
                    element.removeAttribute("data-fithtml");
                    openElementInspector(element);
                }
            }
            const mouseupEvent = () => {
                document.removeEventListener("mouseup", mouseupEvent);
                document.removeEventListener("mousemove", mousemoveEvent);
            }
            document.addEventListener("mouseup", mouseupEvent);
            document.addEventListener("mousemove", mousemoveEvent);
        }
    }
    
    return handle;
}
function createElementPointsArray(element) {
    if (!element.dataset.x1) {
        const x1 = element.offsetLeft / game.cachedGameRect.width * 100;
        const y1 = element.offsetTop / game.cachedGameRect.height * 100;
        const x2 = (element.offsetLeft + element.clientWidth) / game.cachedGameRect.width * 100;
        const y2 = (element.offsetTop + element.clientHeight) / game.cachedGameRect.height * 100;
        updateElementPoints(element, [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2]
        ]);
    }
    return [
        [parseFloat(element.dataset.x1), parseFloat(element.dataset.y1)],
        [parseFloat(element.dataset.x2), parseFloat(element.dataset.y2)],
        [parseFloat(element.dataset.x3), parseFloat(element.dataset.y3)],
        [parseFloat(element.dataset.x4), parseFloat(element.dataset.y4)]
    ]
}

// document functions
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
    var blob = await createGameFile();
    var url = URL.createObjectURL(blob);
    window.open(url, "_blank").focus();
}
async function saveDocument() {
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        asset.setAttribute("src", asset.dataset.filepath);
    }
    var file = await createGameFile();
    var filename = `${game.gameElement.dataset.title}.html`;
    if ('showSaveFilePicker' in self) {
        var fileHandle = await showSaveFilePicker({ id: 'export-location', startIn: "documents", suggestedName: filename });
        var writeable = await fileHandle.createWritable();
        await writeable.write(file);
        await writeable.close();
    } else {
        var url = URL.createObjectURL(file);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
    }
    refreshMedia();
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
            var fileHandle = await showSaveFilePicker({ id: 'export-location', startIn: "documents", suggestedName: filename });
            var writeable = await fileHandle.createWritable();
            await writeable.write(content);
            await writeable.close();
        } else {
            saveAs(content, filename);
        }
    })

    refreshMedia();
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
async function createGameFile() {
    var game_css = await fetch("/css/game.css").then(res => res.text());
    var game_module = await fetch("/js/game.js").then(res => res.text());
    game_module = game_module.replace("export { Game };", "");

    var html = await fetch("/template.html").then(res => res.text());
    html = html.replace("<title></title>", `<title>${game.gameElement.dataset.title}</title>`);
    html = html.replace("<!-- _FH_GAME_STYLE -->", `<style>${game_css}</style>`);
    html = html.replace("<!-- _FH_GAME_MODULE -->", `<script>${game_module}</script>`);
    
    const startString = "<!-- _FH_DATA_START -->";
    const endString = "<!-- _FH_DATA_END -->";
    html = 
        html.substring(0, html.indexOf(startString) + startString.length) + 
        game.gameElement.outerHTML + 
        html.substring(html.indexOf(endString), html.length);

    return new Blob([html], { type: "text/html" });
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

// media folder functions
function createMediaFolder(files) {
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        asset.removeAttribute("src");
    }

    mediaFolder = document.createElement("ul");
    loadAssetFolder(files, mediaFolder);

    for (let file of mediaFolder.querySelectorAll(".file")) {
        file.onmousedown = async (e) => {
            const type = file.dataset.type;
            const format = file.dataset.format;
            const filepath = file.dataset.filepath;

            if (editMode !== "select")
                switchMode();

            const rect = game.cachedGameRect;
            var width = 0;
            var height = 0;
            var html = "";
            if (type === "image") {
                await new Promise(resolve => {
                    const image = new Image();
                    image.src = file.dataset.url;
                    image.onload = () => {
                        width = image.naturalWidth / rect.width * 100;
                        height = image.naturalHeight / rect.height * 100;
                        resolve();
                    }
                })
                html = `<img alt="" data-filepath="${file.dataset.filepath}" />`;
            } else if (type === "video") {
                html = `<video data-autoplay="true"><source data-filepath="${filepath}" type="${format}"></video>`;
            } else if (type === "audio") {
                html = `<audio data-autoplay="true" controls><source data-filepath="${filepath}" type="${format}"></audio>`;
            } else if (type === "text") {
                html = file.querySelector("[name=text]").textContent;
            }

            const element = createElement(
                (e.pageX - rect.left) / rect.width * 100 - width/2,
                (e.pageY - rect.top) / rect.height * 100 - height/2,
                width, height, html
            );

            if (type === "image") {
                element.querySelector("img").onload = () => {
                    game.updateTransform(element);
                }
            } else if (type === "video") {
                const video = element.querySelector("video");
                await new Promise(resolve => {
                    video.onloadedmetadata = () => {
                        const width = video.videoWidth / rect.width * 100;
                        const height = video.videoHeight / rect.height * 100;
                        const x1 = (e.pageX - rect.left) / rect.width * 100 - width/2;
                        const y1 = (e.pageY - rect.top) / rect.height * 100 - height/2;
                        const x2 = x1 + width;
                        const y2 = y1 + height;
                        updateElementPoints(element, [
                            [x1, y1],
                            [x2, y1],
                            [x2, y2],
                            [x1, y2]
                        ]);
                        resolve();
                    }
                })
            } else if (type === "audio" || type === "text") {
                const width = element.offsetWidth / rect.width * 100;
                const height = element.offsetHeight / rect.height * 100;
                const x1 = (e.pageX - rect.left) / rect.width * 100 - width/2;
                const y1 = (e.pageY - rect.top) / rect.height * 100 - height/2;
                const x2 = x1 + width;
                const y2 = y1 + height;
                updateElementPoints(element, [
                    [x1, y1],
                    [x2, y1],
                    [x2, y2],
                    [x1, y2]
                ]);
            }

            const clickzone = openElements[element.getAttribute("name")].clickzone;
            clickzone.onmousedown(e);
        }
    }
    
    refreshMedia();
}
async function refreshMedia() {
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        asset.removeAttribute("src");
    }

    if (!mediaFolder) return;
    
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        const referenceElement = mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
        if (!referenceElement) {
            console.error(`media asset "${asset.dataset.filepath}" was not found.`);
            break;
        }
        asset.setAttribute("src", referenceElement.dataset.url);
    }

    setTimeout(() => {
        game.onresize();
    }, 500);
}
function openMediaInspector() {
    for (let inspectors of editorInspector.children)
        inspectors.classList.add("hidden");
    fh_media_inspector.classList.remove("hidden");
    const selectedInspector = document.body.querySelector(".fh-toolbar .inspector_button.selected");
    if (selectedInspector)
        selectedInspector.classList.remove("selected");
    fh_media.classList.add("selected");
    fh_folder_container.innerHTML = "";
    fh_folder_container.appendChild(mediaFolder);
}

class EditorGame extends Game {
    constructor(gameElement) {
        const gameContainer = document.querySelector(".fh-game-container");
        gameContainer.onmousedown = (e) => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            gameContainer.classList.add("focused");
            if (e.target.classList.contains("fh-game-container") || e.target === editorOverlay) {
                for (let name in openElements) {
                    if (openElements[name].clickzone.classList.contains("selected"))
                        deselectElement(openElements[name].element);
                }
                if (editMode === "select") {
                    selectionMousedown(e);
                }
            }
        }
        editorInspector.onmousedown = (e) => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            editorInspector.classList.add("focused");
        }
        slidesContainer.onmousedown = () => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            slidesContainer.classList.add("focused");
        }

        fh_add_slide.onclick = () => addSlide();
        fh_select_mode.onclick = () => switchMode("select");
        fh_text_mode.onclick = () => switchMode("text");
        fh_doodle_mode.onclick = () => {
            var hidden = fh_doodle_tooltip.classList.contains("hidden");
            switchMode("doodle");
            if (hidden)
                fh_doodle_tooltip.classList.remove("hidden");
        }

        fh_play.onclick = playGame;

        // inspectors
        fh_document_inspector.querySelector("[name=load]").onclick = loadDocument;
        fh_document_inspector.querySelector("[name=save]").onclick = saveDocument;
        fh_document_inspector.querySelector("[name=export]").onclick = exportDocument;
        fh_document_inspector.querySelector("[name=title]").oninput = function() {
            game.gameElement.dataset.title = this.value;
            document.title = this.value;
        }
        fh_document_inspector.querySelector("[name=title]").onchange = save;
        fh_document_inspector.querySelector("[name=aspectratio]").oninput = function() {
            game.gameElement.dataset.aspectratio = this.value;
            game.onresize();
        }
        fh_document_inspector.querySelector("[name=aspectratio]").onchange = save;
        for (let textarea of editorInspector.querySelectorAll("textarea")) {
            textarea.addEventListener("input", function() {
                this.style.height = "";
                this.style.height = (this.scrollHeight + 2) + "px";
            })
        }
        fh_inspect_element.onclick = () => openElementInspector();
        fh_inspect_document.onclick = () => openDocumentInspector();

        if ('showSaveFilePicker' in self)
            fh_document_fallback_message.remove();

        // init media
        fh_media_reload_button.onclick = () => {
            mediaFolder = null;
            fh_media.click();
        }
        if ('showDirectoryPicker' in self) {
            fh_media_reload_button.onclick = fh_media.click;
            fh_media_load_button.onclick = () => {
                mediaFolder = null;
                del('media');
                fh_media.click();
            }
            fh_media_fallback_message.remove();
        } else {
            fh_media_reload_button.innerHTML = "<b>⟳</b><br>(re)load";
            fh_media_load_button.remove();
        }
        fh_media_input.onchange = () => {
            createMediaFolder(fh_media_input.files);
            openMediaInspector();
            fh_media_input.value = "";
        }
        fh_media.onclick = async () => {
            if (!mediaFolder) {
                if ('showDirectoryPicker' in self) {
                    var dirHandle = await get('media');
                    if (!dirHandle || await dirHandle.requestPermission() !== 'granted') {
                        dirHandle = await window.showDirectoryPicker();
                        await set('media', dirHandle);
                    }
                    var files = [];
                    async function* getFilesRecursively(entry, dirpath) {
                        dirpath = dirpath || "";
                        if (entry.kind === "file") {
                            const file = await entry.getFile();
                            if (file !== null) {
                                file.relativePath = dirpath + entry.name;
                                yield file;
                            }
                        } else if (entry.kind === "directory") {
                            for await (const handle of entry.values()) {
                                yield* getFilesRecursively(handle, dirpath + entry.name + "/");
                            }
                        }
                    }
                    for await (let file of getFilesRecursively(dirHandle)) {
                        files.push(file);
                    }
                    createMediaFolder(files);
                    openMediaInspector();
                } else {
                    fh_media_input.click();
                }
            } else {
                openMediaInspector();
            }
        };

        document.addEventListener("keydown", e => {
            if (e.key === "Shift")
                shiftKey = true;
            else if (e.key === "Meta" || e.key === "Ctrl")
                metaKey = true;

            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
                return;
            }

            else if (e.key === "1")
                switchMode("select")
            else if (e.key === "2")
                switchMode("text")
            else if (e.key === "3")
                switchMode("doodle")

            else if (e.key === "Delete" || e.key === "Backspace") {
                if (slidesContainer.classList.contains("focused")) {
                    for (let preview of slidesContainer.querySelectorAll(".fh-slide-preview-container.selected")) {
                        deleteElement(game.getElementAtPath(preview.dataset.path));
                    }
                    save();
                } else if (!editorInspector.classList.contains("focused")) {
                    for (let clickzone of editorOverlay.querySelectorAll(".fh-editor-clickzone.selected")) {
                        deleteElement(openElements[clickzone.getAttribute("name")].element);
                    }
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
                        const prev = selected.previousElementSibling;
                        if (prev) {
                            game.goto(prev.dataset.path);
                        }
                        break;
                    case "ArrowDown":
                    case "ArrowRight":
                        const next = selected.nextElementSibling;
                        if (next) {
                            game.goto(next.dataset.path);
                        }
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
            else if (metaKey && e.code === "KeyZ") {
                undo();
                e.preventDefault();
            }
            else if (metaKey && e.code === "KeyA") {
                for (let name in openElements) {
                    selectElement(openElements[name].element);
                }
            }
        })
        document.addEventListener("keyup", e => {
            if (e.key === "Shift")
                shiftKey = false;
            if (e.key === "Meta" || e.key === "Ctrl")
                metaKey = false;
        })

        editorOverlay.addEventListener("mousedown", e => {
            if (editMode === "text") {
                textmodeMousedown(e);
            } else if (editMode === "doodle") {
                doodlemodeMousedown(e);
            }
        })

        super(gameElement);
    }

    init(gameElement) {
        game = this;
        super.init(gameElement);
        this.initDoodleSettings();
        window.addEventListener("load", () => {
            openElementInspector();
        }, { once: true });
        reorderPreviews();
        history = [];
        save();
    }

    initGameElement(gameElement) {
        super.initGameElement(gameElement);
        while (slidesContainer.lastElementChild)
            slidesContainer.lastElementChild.remove();
        document.querySelector(".fh-editor .fh-game").replaceWith(this.gameElement);

        fh_document_inspector.querySelector("[name=title]").value = gameElement?.dataset.title || "untitled";
        fh_document_inspector.querySelector("[name=aspectratio]").value = gameElement?.dataset.aspectratio || 1;
    }
    
    initElements() {
        const createChildSlidePreviews = (parentSlide) => {
            for (let child of parentSlide.children) {
                if (child.classList.contains("fh-slide")) {
                    createSlidePreview(child);
                    createChildSlidePreviews(child);
                }
            }
        }
        createChildSlidePreviews(this.gameElement);
        refreshMedia();
    }

    async initDoodleSettings() {
        doodleSettings = {
            fill: await get('fill') || "none",
            stroke: await get('stroke') || "black",
            strokeWidth: await get('stroke-width') || 1
        }

        //https://stackoverflow.com/a/47355187/30103476
        function standardize_color(str) {
            var ctx = document.createElement("canvas").getContext("2d");
            ctx.fillStyle = str;
            return ctx.fillStyle;
        }

        for (const setting of ["fill", "stroke"]) {
            const text = fh_doodle_tooltip.querySelector(`[name=${setting}]`);
            const picker = fh_doodle_tooltip.querySelector(`[name=${setting}_picker]`);
            text.value = picker.value = doodleSettings[setting];
            text.oninput = function() {
                var value = this.value.trim() === "" ? "none" : this.value;
                set(setting, value); doodleSettings[setting] = value;
                picker.value = standardize_color(value);
            }
            text.onchange = function() {
                this.value = this.value.trim() === "" ? "none" : this.value;
            }
            picker.oninput = function() {
                set(setting, this.value); doodleSettings[setting] = this.value;
                text.value = this.value;
            };
        }
        fh_doodle_tooltip.querySelector("[name=stroke-width]").value = doodleSettings.strokeWidth;
        fh_doodle_tooltip.querySelector("[name=stroke-width]").oninput = function() {
            set('stroke-width', Math.max(this.value, 1));
            doodleSettings.strokeWidth = Math.max(this.value, 1);
        };
        fh_doodle_tooltip.querySelector("[name=stroke-width]").onchange = function() {
            if (this.value < 1) this.value = 1;
        };
    }

    onresize() {
        super.onresize();
        editorOverlay.style.width = game.gameElement.style.width;
        editorOverlay.style.height = game.gameElement.style.height;
        if (this.cachedGameRect) {
            for (let slide of game.gameElement.querySelectorAll(".fh-slide")) {
                slide.classList.add("open");
            }
            for (let element of document.querySelectorAll(".fh-element")) {
                game.updateTransform(element);
            }
            for (let slide of game.gameElement.querySelectorAll(".fh-slide")) {
                updateSlidePreview(slide);
            }
            for (let preview of slidesContainer.querySelectorAll(".fh-slide-preview-bg")) {
                updateSlidePreviewScale(preview);
            }
            game.goto(game.currentSlide);
        }
        var tooltipPosition = fh_doodle_mode.getBoundingClientRect();
        fh_doodle_tooltip.style.left = tooltipPosition.left + "px";
        fh_doodle_tooltip.style.top = tooltipPosition.bottom + "px";
    }

    goto(path) {
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

        for (let element of game.currentSlide.children) {
            if (element.classList.contains("fh-element")) {
                openElement(element);
                if (selectedElements.includes(element))
                    selectElement(element);
            }
        }

        if (fh_inspect_element.classList.contains("selected"))
            openElementInspector();
    }

    async runScript(script) { }
}

export { EditorGame };