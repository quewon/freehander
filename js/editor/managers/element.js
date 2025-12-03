import { game, editorOverlay, editorInspector, editMode, focusGameContainer } from '../editor.js';
import { shiftKey } from '../utils/shortcuts.js';
import { DragHandler } from '../utils/dragdrop.js';
import { save } from '../utils/history.js';
import { updateSlidePreview, findSlidePreview, reorderPreviews } from './slide.js';

var openElements = {};

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
function openElement(element) {
    openElements[element.getAttribute("name")] = {
        element: element,
        clickzone: createEditorClickzone(element),
        handle: createElementHandle(element),
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
            for (let name in openElements) {
                game.updateTransform(openElements[name].element);
            }
            updateSlidePreview(element);
        }
        cssInput.onchange = save;

        nameInput = fh_slide_inspector.querySelector("[name=rename]");
    }

    nameInput.onchange = nameInput.onblur = function () {
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
    for (let i = 0; i < 4; i++) {
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

        for (let i = 0; i < 4; i++) {
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
    for (let i = 0; i < 4; i++) {
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
    for (let i = 0; i < 4; i++) {
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
    clickzone.onmouseup = (e) => {
        if (!cancelClick && editMode === "select" && e.button === 0) {
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
    new DragHandler({
        onmousedown: (e) => {
            if (editMode !== "select") return;
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
        },
        ondragend: () => {
            if (editMode !== "select") return;
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
            if (cancelClick)
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

    for (let i = 0; i < 4; i++) {
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
        new DragHandler({
            onmousedown: (e) => {
                focusGameContainer();
                e.stopPropagation();
            },
            ondrag: (e) => {
                if (editMode !== "select") return;
                const parentRect = svg.getBoundingClientRect();
                const x = (e.pageX - parentRect.left) / game.cachedGameRect.width * 100;
                const y = (e.pageY - parentRect.top) / game.cachedGameRect.height * 100;
                handle.points[i] = [x, y];
                if (shiftKey) {
                    var prev = i - 1 < 0 ? 3 : i - 1;
                    var next = i + 1 > 3 ? 0 : i + 1;
                    handle.points[(i % 2 == 0 ? prev : next)][0] = handle.points[i][0];
                    handle.points[(i % 2 == 0 ? next : prev)][1] = handle.points[i][1];
                }
                updateElementPoints(element, handle.points);
                if (element.dataset.fithtml) {
                    element.removeAttribute("data-fithtml");
                    openElementInspector(element);
                }
            },
            threshold: 0
        }).attach(ivert);
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
function deselectAllElements() {
    for (let name in openElements) {
        deselectElement(openElements[name].element);
    }
}

export { openElements, createElement, deleteElement, renameElement, setElementHTML, selectElement, deselectElement, deselectAllElements, openElement, openElementInspector, updateElementPoints, getElementMinMax, getElementTopLeft, getElementCenter, setElementTopLeft, setElementCenter, sendElementToBack, bringElementToFront, isHTML, pasteHTML, createEditorClickzone, createElementHandle, createElementPointsArray };