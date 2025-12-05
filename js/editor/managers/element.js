import { game, editorOverlay, editorInspector, editMode, focusGameContainer } from '../editor.js';
import { shiftKey } from '../utils/shortcuts.js';
import { DragHandler } from '../utils/dragdrop.js';
import { save } from '../utils/history.js';
import { mediaFolder } from './media.js';
import { updateSlidePreview, findSlidePreview, reorderPreviews, addSlide } from './slide.js';
import { general2DProjection, matrix_multv } from '../../matrix.js';
import { getPointsMinMax, getPointsCenter, getPointsTopLeft } from '../utils/rect.js';

var openElements = {};
var selectionHandles;

function createElement(x, y, w, h, content) {
    content = content || "";

    var basename = "element";
    var i = 1;
    while (game.currentSlide.querySelector(`:scope > [name="${basename + i}"]`)) {
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
function deleteElement(element) {
    if (element.classList.contains("fh-element")) {
        deselectElement(element);
        const slide = element.parentElement;
        if (slide === game.currentSlide) {
            const name = element.getAttribute("name");
            const data = openElements[name];
            data.clickzone.remove();
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
function resetFit(element) {
    if (!(element.getAttribute("name") in openElements)) return;
    const origin = getElementTopLeft(element);
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
function setElementHTML(element, html) {
    element.innerHTML = html;
    if (element.getAttribute("name") in openElements) {
        if (element.dataset.fithtml)
            resetFit(element);
        game.updateTransform(element);
        if (openElements[element.getAttribute("name")].clickzone.classList.contains("selected")) {
            updateSelectionHandles();
        }
    }
    updateSlidePreview(element.parentElement);
}
function deselectElement(element) {
    if (element.parentElement === game.currentSlide) {
        const data = openElements[element.getAttribute("name")];
        data.clickzone.classList.remove("selected");
        updateSelectionHandles();
        if (fh_inspect_element.classList.contains("selected"))
            openElementInspector();
    }
}
function selectElement(element) {
    if (element.parentElement === game.currentSlide) {
        const data = openElements[element.getAttribute("name")];
        data.clickzone.classList.add("selected");
        updateSelectionHandles();
        if (fh_inspect_element.classList.contains("selected"))
            openElementInspector(element);
    }
}
function openElement(element) {
    openElements[element.getAttribute("name")] = {
        element: element,
        clickzone: createEditorClickzone(element)
    }
    updateElementPoints(element, createElementPointsArray(element));
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
        fh_element_inspector.querySelector("[name=onshow]").oninput = function () {
            element.dataset.onshow = this.value;
        }
        fh_element_inspector.querySelector("[name=onshow]").onchange = save;
        fh_element_inspector.querySelector("[name=onclick").value = element.dataset.onclick ? element.dataset.onclick : "";
        fh_element_inspector.querySelector("[name=onclick]").oninput = function () {
            element.dataset.onclick = this.value;
        }
        fh_element_inspector.querySelector("[name=onclick]").onchange = save;

        const htmlInput = fh_element_inspector.querySelector("[name=html]");
        htmlInput.onkeydown = e => {
            if (shiftKey && e.key === 'Enter') {
                const start = htmlInput.selectionStart;
                const end = htmlInput.selectionEnd;
                htmlInput.value = htmlInput.value.substring(0, start) + "<br>" + htmlInput.value.substring(end);
                htmlInput.selectionStart = start + 4;
                htmlInput.selectionEnd = start + 4;
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
                resetFit(element);
            } else {
                element.removeAttribute("data-fithtml");
            }
            updateSelectionHandles();
            save();
        }

        nameInput = fh_element_inspector.querySelector("[name=rename]");
    } else {
        fh_slide_inspector.classList.remove("hidden");

        fh_slide_inspector.querySelector("[name=onenter]").value = element.dataset.onenter ? element.dataset.onenter : "";
        fh_slide_inspector.querySelector("[name=onenter]").oninput = function () {
            element.dataset.onenter = this.value;
        }
        fh_slide_inspector.querySelector("[name=onenter]").onchange = save;
        fh_slide_inspector.querySelector("[name=onexit]").value = element.dataset.onexit ? element.dataset.onexit : "";
        fh_slide_inspector.querySelector("[name=onexit]").oninput = function () {
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
            for (const child of element.querySelectorAll(".fh-element")) {
                game.updateTransform(child);
                if (child.dataset.fithtml)
                    resetFit(child);
            }
            updateSlidePreview(element);
        }
        cssInput.onchange = save;

        nameInput = fh_slide_inspector.querySelector("[name=rename]");
    }

    nameInput.oninput = function () {
        if (!element.parentElement) return;
        var name = this.value.trim();
        if (name === "") return;
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
            save();
        }
    }
    nameInput.onblur = function() {
        this.value = element.getAttribute("name");
    }
    nameInput.value = element.getAttribute("name");

    for (const textarea of editorInspector.querySelectorAll("textarea")) {
        textarea.style.height = "0";
        textarea.style.height = (textarea.scrollHeight + 2) + "px";
    }

    const selectedInspector = document.body.querySelector(".fh-toolbar .inspector_button.selected");
    if (selectedInspector)
        selectedInspector.classList.remove("selected");
    fh_inspect_element.classList.add("selected");
}
function updateElementPoints(element, points) {
    const mm = getPointsMinMax(points);

    if (element.parentElement === game.currentSlide) {
        const data = openElements[element.getAttribute("name")];
        const clickzone = data.clickzone;
        clickzone.style.left = mm.min[0] + "%";
        clickzone.style.top = mm.min[1] + "%";
        clickzone.style.width = (mm.max[0] - mm.min[0]) + "%";
        clickzone.style.height = (mm.max[1] - mm.min[1]) + "%";
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
    return getPointsMinMax(createElementPointsArray(element));
}
function getElementTopLeft(element) {
    return getElementMinMax(element).min;
}
function setElementTopLeft(element, position) {
    const oldOrigin = getElementTopLeft(element);
    var p = createElementPointsArray(element);
    const x = position[0] - oldOrigin[0];
    const y = position[1] - oldOrigin[1];
    updateElementPoints(element, [
        [p[0][0] + x, p[0][1] + y],
        [p[1][0] + x, p[1][1] + y],
        [p[2][0] + x, p[2][1] + y],
        [p[3][0] + x, p[3][1] + y]
    ]);
}
function getElementCenter(element) {
    return getPointsCenter(createElementPointsArray(element));
}
function setElementCenter(element, position) {
    const c = getElementCenter(element);
    var p = createElementPointsArray(element);
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

    for (let i = 0; i < newElementCount; i++) {
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
    var handleOffset;
    var cancelClick = false;
    var shiftOnMousedown;
    var wheelEndTimeout;

    clickzone.onwheel = (e) => {
        var points = selectionHandles.elements.includes(element) ? selectionHandles.points : createElementPointsArray(element);
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
        if (element.dataset.fithtml)
            element.removeAttribute("data-fithtml");
            if (selectionHandles.elements.length === 1)
                openElementInspector(element);
        if (selectionHandles.elements.includes(element)) {
            updateSelectionTransform();
        } else {
            updateElementPoints(element, points);
        }
        clearTimeout(wheelEndTimeout);
        wheelEndTimeout = setTimeout(save, 100);
        e.preventDefault();
    }
    clickzone.onmouseup = (e) => {
        if (!window.fh_selection_box && editMode === "select" && e.button === 0) {
            if (shiftKey && selectionHandles.elements.includes(element)) {
                deselectElement(element);
            } else {
                if (!shiftKey) {
                    deselectAllElements();
                }
                selectElement(element);
            }
        }
    }
    new DragHandler({
        onmousedown: (e) => {
            if (editMode !== "select") return;
            cancelClick = false;

            if (!shiftKey && !clickzone.classList.contains("selected")) {
                for (let name in openElements) {
                    if (selectionHandles.elements.includes(element))
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
            shiftOnMousedown = shiftKey;
            for (let clickzone of grabbedClickzones) {
                const name = clickzone.getAttribute("name");
                const el = openElements[name].element;
                if (!shiftKey)
                    bringElementToFront(el);
                const origin = getElementCenter(el);
                grabOffsets.push([
                    origin[0] - x,
                    origin[1] - y
                ]);
            }
            if (selectionHandles.elements.includes(element)) {
                const origin = getPointsTopLeft(selectionHandles.points);
                handleOffset = [origin[0] - x, origin[1] - y];
            }
            focusGameContainer();
            e.stopPropagation();
        },
        ondrag: (e) => {
            if (editMode !== "select") return;
            cancelClick = Math.abs(e.mousedownPosition[0] - e.pageX) + Math.abs(e.mousedownPosition[1] - e.pageY) > 3;
            const rect = game.cachedGameRect;
            const x = (e.pageX - rect.left) / rect.width * 100;
            const y = (e.pageY - rect.top) / rect.height * 100;
            for (let i = 0; i < grabbedClickzones.length; i++) {
                const clickzone = grabbedClickzones[i];
                const element = openElements[clickzone.getAttribute("name")].element;
                const offset = grabOffsets[i];
                setElementCenter(element, [offset[0] + x, offset[1] + y]);
            }
            if (selectionHandles.elements.includes(element))
                setSelectionHandlesTopLeft([handleOffset[0] + x, handleOffset[1] + y]);
        },
        ondragend: () => {
            if (editMode !== "select") return;
            if (element.parentElement) {
                const points = createElementPointsArray(element);
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
            if (cancelClick || !shiftOnMousedown)
                save();
        },
        threshold: 0
    }).attach(clickzone);
    clickzone.addEventListener("contextmenu", e => {
        sendElementToBack(element);
        save();
        e.preventDefault();
    })

    return clickzone;
}
function updateSelectionHandles() {
    var selectedClickzones = editorOverlay.querySelectorAll(".fh-editor-clickzone.selected");
    if (selectedClickzones.length > 0) {
        for (let i = 0; i < 4; i++) {
            selectionHandles.invisibleVertices[i].onmouseleave();
            selectionHandles.invisibleEdges[i].onmouseleave();
        }
        editorOverlay.appendChild(selectionHandles.svg);
        var min = [Infinity, Infinity];
        var max = [-Infinity, -Infinity];
        selectionHandles.elements = [...selectedClickzones].map(clickzone => {
            const element = openElements[clickzone.getAttribute("name")].element;
            const mm = getElementMinMax(element);
            if (mm.min[0] < min[0]) min[0] = mm.min[0];
            if (mm.min[1] < min[1]) min[1] = mm.min[1];
            if (mm.max[0] > max[0]) max[0] = mm.max[0];
            if (mm.max[1] > max[1]) max[1] = mm.max[1];
            return element;
        })
        if (selectionHandles.elements.length > 1) {
            selectionHandles.points = [
                [min[0], min[1]],
                [max[0], min[1]],
                [max[0], max[1]],
                [min[0], max[1]]
            ]
            selectionHandles.originalPoints = [
                min[0], min[1],
                max[0], min[1],
                max[0], max[1],
                min[0], max[1]
            ]
            selectionHandles.originalElementPoints = [];
            for (const element of selectionHandles.elements) {
                selectionHandles.originalElementPoints.push(
                    createElementPointsArray(element)
                )
            }
        } else {
            selectionHandles.points = createElementPointsArray(selectionHandles.elements[0]);
        }
        updateSelectionTransform();
    } else {
        selectionHandles.svg.remove();
        selectionHandles.elements = [];
    }
}
function updateSelectionTransform() {
    var min = [Infinity, Infinity];
    var max = [-Infinity, -Infinity];
    for (let i = 0; i < 4; i++) {
        const p = selectionHandles.points[i];
        const np = i < 3 ? selectionHandles.points[i + 1] : selectionHandles.points[0];
        selectionHandles.visibleVertices[i].setAttribute("cx", p[0] + "%");
        selectionHandles.visibleVertices[i].setAttribute("cy", p[1] + "%");
        selectionHandles.invisibleVertices[i].setAttribute("cx", p[0] + "%");
        selectionHandles.invisibleVertices[i].setAttribute("cy", p[1] + "%");
        selectionHandles.visibleEdges[i].setAttribute("x1", p[0] + "%");
        selectionHandles.visibleEdges[i].setAttribute("y1", p[1] + "%");
        selectionHandles.invisibleEdges[i].setAttribute("x1", p[0] + "%");
        selectionHandles.invisibleEdges[i].setAttribute("y1", p[1] + "%");
        selectionHandles.visibleEdges[i].setAttribute("x2", np[0] + "%");
        selectionHandles.visibleEdges[i].setAttribute("y2", np[1] + "%");
        selectionHandles.invisibleEdges[i].setAttribute("x2", np[0] + "%");
        selectionHandles.invisibleEdges[i].setAttribute("y2", np[1] + "%");
        if (p[0] < min[0]) min[0] = p[0];
        if (p[1] < min[1]) min[1] = p[1];
        if (p[0] > max[0]) max[0] = p[0];
        if (p[1] > max[1]) max[1] = p[1];
    }
    if (selectionHandles.elements.length === 1) {
        const element = selectionHandles.elements[0];
        updateElementPoints(element, selectionHandles.points);
        const clickzone = openElements[element.getAttribute("name")]?.clickzone;
        if (clickzone) {
            clickzone.style.left = min[0] + "%";
            clickzone.style.top = min[1] + "%";
            clickzone.style.width = (max[0] - min[0]) + "%";
            clickzone.style.height = (max[1] - min[1]) + "%";
        }
    } else {
        const matrix = general2DProjection(
            selectionHandles.originalPoints[0], selectionHandles.originalPoints[1],
            selectionHandles.points[0][0], selectionHandles.points[0][1],
            selectionHandles.originalPoints[2], selectionHandles.originalPoints[3],
            selectionHandles.points[1][0], selectionHandles.points[1][1],
            selectionHandles.originalPoints[4], selectionHandles.originalPoints[5],
            selectionHandles.points[2][0], selectionHandles.points[2][1],
            selectionHandles.originalPoints[6], selectionHandles.originalPoints[7],
            selectionHandles.points[3][0], selectionHandles.points[3][1]
        );
        for (let i = 0; i < selectionHandles.elements.length; i++) {
            var originalPoints = selectionHandles.originalElementPoints[i];
            var transformedPoints = originalPoints.map((point) => {
                const v = matrix_multv(matrix, [point[0], point[1], 1]);
                return [v[0] / v[2], v[1] / v[2]];
            });
            updateElementPoints(selectionHandles.elements[i], transformedPoints);
        }
    }
}
function setSelectionHandlesTopLeft(origin) {
    const oldOrigin = getPointsTopLeft(selectionHandles.points);
    for (let point of selectionHandles.points) {
        point[0] = origin[0] + (point[0] - oldOrigin[0]);
        point[1] = origin[1] + (point[1] - oldOrigin[1]);
    }
    updateSelectionTransform();
}
function initSelectionHandles() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "fh-element-handle");

    var visibleVertices = [];
    var invisibleVertices = [];
    var visibleEdges = [];
    var invisibleEdges = [];

    selectionHandles = {
        svg: svg,
        elements: [],
        points: [],
        visibleVertices: visibleVertices,
        invisibleVertices: invisibleVertices,
        visibleEdges: visibleEdges,
        invisibleEdges: invisibleEdges,
    }

    for (let i = 0; i < 4; i++) {
        // edges

        const vedge = document.createElementNS("http://www.w3.org/2000/svg", "line");
        vedge.setAttribute("stroke-width", "var(--handle-stroke-width)");
        vedge.setAttribute("stroke", "var(--handle-color)");
        svg.appendChild(vedge);
        visibleEdges.push(vedge);

        const iedge = document.createElementNS("http://www.w3.org/2000/svg", "line");
        iedge.setAttribute("stroke-width", "15");
        iedge.setAttribute("stroke", "transparent");
        svg.appendChild(iedge);
        invisibleEdges.push(iedge);

        iedge.onmouseover = () => {
            vedge.setAttribute("stroke", "var(--handle-hover-color)");
        }
        iedge.onmouseleave = () => {
            vedge.setAttribute("stroke", "var(--handle-color)");
        }
        var edgeOffsets;
        new DragHandler({
            onmousedown: (e) => {
                if (editMode !== "select") return;
                document.querySelector(":focus")?.blur();
                const rect = svg.getBoundingClientRect();
                const x = (e.pageX - rect.left) / game.cachedGameRect.width * 100;
                const y = (e.pageY - rect.top) / game.cachedGameRect.height * 100;
                edgeOffsets = [
                    [
                        selectionHandles.points[i][0] - x,
                        selectionHandles.points[i][1] - y
                    ],
                    [
                        selectionHandles.points[i >= 3 ? 0 : i + 1][0] - x,
                        selectionHandles.points[i >= 3 ? 0 : i + 1][1] - y
                    ]
                ];
                focusGameContainer();
                e.stopPropagation();
            },
            ondrag: (e) => {
                if (editMode !== "select") return;
                const rect = svg.getBoundingClientRect();
                const x = (e.pageX - rect.left) / game.cachedGameRect.width * 100;
                const y = (e.pageY - rect.top) / game.cachedGameRect.height * 100;
                const n = i >= 3 ? 0 : i + 1;
                if (shiftKey) {
                    if (
                        Math.abs(selectionHandles.points[i][0] - selectionHandles.points[n][0]) >
                        Math.abs(selectionHandles.points[i][1] - selectionHandles.points[n][1])
                    ) {
                        selectionHandles.points[i][1] = y + edgeOffsets[0][1];
                        selectionHandles.points[n][1] = y + edgeOffsets[1][1];
                    } else {
                        selectionHandles.points[i][0] = x + edgeOffsets[0][0];
                        selectionHandles.points[n][0] = x + edgeOffsets[1][0];
                    }
                } else {
                    selectionHandles.points[i] = [x + edgeOffsets[0][0], y + edgeOffsets[0][1]];
                    selectionHandles.points[n] = [x + edgeOffsets[1][0], y + edgeOffsets[1][1]];
                }
                updateSelectionTransform();
                for (let element of selectionHandles.elements) {
                    if (element.dataset.fithtml) {
                        element.removeAttribute("data-fithtml");
                        if (selectionHandles.elements.length === 1)
                            openElementInspector(element);
                    }
                }
            },
            ondragend: (e) => {
                if (
                    Math.abs(e.mousedownPosition[0] - e.pageX) + Math.abs(e.mousedownPosition[1] - e.pageY) > 0
                ) {
                    save();
                }
            },
            threshold: 0
        }).attach(iedge);
    }

    for (let i = 0; i < 4; i++) {
        // vertices

        const vvert = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        vvert.setAttribute("r", "3");
        vvert.setAttribute("fill", "white");
        vvert.setAttribute("stroke", "var(--handle-color)");
        vvert.setAttribute("stroke-width", "var(--handle-stroke-width)");
        svg.appendChild(vvert);
        visibleVertices.push(vvert);

        const ivert = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ivert.setAttribute("r", "10");
        ivert.setAttribute("fill", "transparent");
        svg.appendChild(ivert);
        invisibleVertices.push(ivert);

        ivert.onmouseover = () => {
            vvert.setAttribute("stroke", "var(--handle-hover-color)");
        }
        ivert.onmouseleave = () => {
            vvert.setAttribute("stroke", "var(--handle-color)");
        }
        new DragHandler({
            onmousedown: (e) => {
                focusGameContainer();
                e.stopPropagation();
            },
            ondrag: (e) => {
                if (editMode !== "select") return;
                document.querySelector(":focus")?.blur();
                const parentRect = svg.getBoundingClientRect();
                const x = (e.pageX - parentRect.left) / game.cachedGameRect.width * 100;
                const y = (e.pageY - parentRect.top) / game.cachedGameRect.height * 100;
                selectionHandles.points[i] = [x, y];
                if (shiftKey) {
                    var prev = i - 1 < 0 ? 3 : i - 1;
                    var next = i + 1 > 3 ? 0 : i + 1;
                    selectionHandles.points[(i % 2 == 0 ? prev : next)][0] = selectionHandles.points[i][0];
                    selectionHandles.points[(i % 2 == 0 ? next : prev)][1] = selectionHandles.points[i][1];
                }
                updateSelectionTransform();
                for (let element of selectionHandles.elements) {
                    if (element.dataset.fithtml) {
                        element.removeAttribute("data-fithtml");
                        if (selectionHandles.elements.length === 1)
                            openElementInspector(element);
                    }
                }
            },
            ondragend: (e) => {
                if (
                    Math.abs(e.mousedownPosition[0] - e.pageX) + Math.abs(e.mousedownPosition[1] - e.pageY) > 0
                ) {
                    save();
                }
            },
            threshold: 0
        }).attach(ivert);
    }
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
function deselectAllElements() {
    for (let name in openElements) {
        deselectElement(openElements[name].element);
    }
}
function deleteSelectedElements() {
    for (let clickzone of editorOverlay.querySelectorAll(".fh-editor-clickzone.selected")) {
        deleteElement(openElements[clickzone.getAttribute("name")].element);
    }
}

export { openElements, createElement, deleteElement, deleteSelectedElements, renameElement, setElementHTML, selectElement, deselectElement, deselectAllElements, openElement, openElementInspector, updateElementPoints, getElementMinMax, getElementTopLeft, getElementCenter, setElementTopLeft, setElementCenter, sendElementToBack, bringElementToFront, isHTML, pasteHTML, createEditorClickzone, initSelectionHandles, updateSelectionHandles, createElementPointsArray };