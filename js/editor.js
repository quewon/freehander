import { Game } from "./game.js";
import { loadAssetFolder } from "./folder.js";

var editMode = "select";
var shiftKey = false;
var metaKey = false;
var mediaFolder;
var openElements = {};

function isHTML(string) {
    const fragment = document.createRange().createContextualFragment(string);
    fragment.querySelectorAll('*').forEach(el => el.parentNode.removeChild(el));
    return !(fragment.textContent || '').trim();
}

class Editor extends Game {
    constructor(gameElement) {
        const main = document.querySelector(".fh-game-container");
        main.onmousedown = (e) => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            main.classList.add("focused");
            if (e.target.classList.contains("fh-game-container") || e.target === this.editorOverlay) {
                for (let name in openElements) {
                    if (openElements[name].clickzone.classList.contains("selected"))
                        this.deselectElement(openElements[name].element);
                }

                if (editMode === "select") {
                    this.selectionMousedown(e);
                }
            }
        }
        const inspector = document.querySelector(".fh-inspector");
        inspector.onmousedown = (e) => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            inspector.classList.add("focused");
        }
        const slidesContainer = document.querySelector(".fh-slides-container");
        slidesContainer.onmousedown = () => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            slidesContainer.classList.add("focused");
        }

        document.querySelector("[name=add_slide]").onclick = () => this.addSlide();
        document.querySelector("[name=select_mode]").onclick = () => this.switchMode("select");
        document.querySelector("[name=text_mode]").onclick = () => this.switchMode("text");
        document.querySelector("[name=doodle_mode]").onclick = () => this.switchMode("doodle");
        document.querySelector("[name=inspect]").onclick = () => this.openElementInspector();
        document.querySelector("[name=document").onclick = () => this.openDocumentInspector();
        const mediaInput = document.querySelector("input[name=media_input]");
        mediaInput.onchange = () => {
            this.createMediaFolder(mediaInput.files);
            this.openMediaInspector();
            mediaInput.value = "";
        }
        document.querySelector("[name=media]").onclick = async () => {
            if (!mediaFolder) {
                mediaInput.click();
            } else {
                this.openMediaInspector();
            }
        };
        document.querySelector("[name=play]").onclick = () => this.playGame();

        document.addEventListener("keydown", e => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
                return;
            }

            if (e.key === "Shift")
                shiftKey = true;
            if (e.key === "Meta" || e.key === "Ctrl")
                metaKey = true;

            if (e.key === "Delete" || e.key === "Backspace") {
                if (this.slidesContainer.classList.contains("focused")) {
                    for (let preview of this.slidesContainer.querySelectorAll(".fh-slide-preview-container.selected")) {
                        this.deleteElement(this.getElementAtPath(preview.dataset.path));
                    }
                } else if (!this.editorInspector.classList.contains("focused")) {
                    for (let clickzone of this.editorOverlay.querySelectorAll(".fh-editor-clickzone.selected")) {
                        this.deleteElement(openElements[clickzone.getAttribute("name")].element);
                    }
                }
            }
            
            if (this.slidesContainer.classList.contains("focused")) {
                const selected = this.slidesContainer.querySelector(".selected");
                switch (e.key) {
                    case "Enter":
                        this.addSlide();
                        e.preventDefault();
                        break;
                    case "ArrowUp":
                    case "ArrowLeft":
                        const prev = selected.previousElementSibling;
                        if (prev) {
                            this.goto(prev.dataset.path);
                        }
                        break;
                    case "ArrowDown":
                    case "ArrowRight":
                        const next = selected.nextElementSibling;
                        if (next) {
                            this.goto(next.dataset.path);
                        }
                        break;
                }
            }
            var html = "";
            var selectedClickzones;
            if (this.slidesContainer.classList.contains("focused")) {
                selectedClickzones = this.slidesContainer.querySelectorAll(".selected");
            } else {
                selectedClickzones = this.editorOverlay.querySelectorAll(".selected");
            }
            var selectedElements = [];
            for (let selected of selectedClickzones) {
                var element;
                if (this.slidesContainer.classList.contains("focused")) {
                    element = this.currentSlide.parentElement.querySelector(`:scope > [name="${selected.getAttribute("name")}"]`);
                    var clone = element.cloneNode(true);
                    for (let slide of clone.querySelectorAll(".fh-slide")) {
                        slide.remove();
                    }
                    html += clone.outerHTML;
                } else {
                    element = this.currentSlide.querySelector(`:scope > [name="${selected.getAttribute("name")}"]`);
                    html += element.outerHTML;
                }
                selectedElements.push(element);
            }
            if (html !== "") {
                if (metaKey && e.code === "KeyC") {
                    //copy
                    navigator.clipboard.writeText(html);
                    e.preventDefault();
                } else if (metaKey && e.code === "KeyX") {
                    //cut
                    navigator.clipboard.writeText(html);
                    for (let element of selectedElements) {
                        this.deleteElement(element);
                    }
                    e.preventDefault();
                } else if (metaKey && e.code === "KeyD") {
                    //duplicate
                    this.pasteHTML(html, this.currentSlide);
                    e.preventDefault();
                }
            }
            if (metaKey && e.code === "KeyV") {
                //paste
                navigator.clipboard.readText()
                .then(text => {
                    this.pasteHTML(text, this.currentSlide);
                })
                e.preventDefault();
            }
        })
        document.addEventListener("keyup", e => {
            if (e.key === "Shift")
                shiftKey = false;
            if (e.key === "Meta" || e.key === "Ctrl")
                metaKey = false;
        })

        super(gameElement);
        
        this.editorOverlay.addEventListener("mousedown", e => {
            if (editMode === "text") {
                this.textmodeMousedown(e);
            } else if (editMode === "doodle") {
                this.doodlemodeMousedown(e);
            }
        })
    }

    pasteHTML(html, parent) {
        if (!isHTML(html)) {
            html = `<div class="fh-element" name="element1">${html}</div>`;
        }

        var beforeCount = parent.children.length;
        parent.insertAdjacentHTML("beforeend", html);
        var newElementCount = parent.children.length - beforeCount;

        for (let i=newElementCount-1; i>=0; i--) {
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
                var preview = this.createSlidePreview(element);
                if (parent.classList.contains("fh-slide")) {
                    var previousPreview = this.findSlidePreview(parent);
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
                if (parent === this.currentSlide) {
                    this.openElement(element);
                }
            }
        }
    }

    selectionMousedown(e) {
        const mousedownPosition = [e.pageX, e.pageY];
        const box = document.createElement("div");
        box.style.position = "absolute";
        box.style.border = "1px solid greenyellow";
        box.style.backgroundColor = "rgba(0, 255, 100, .1)";
        box.style.boxSizing = "border-box";
        const mousemoveEvent = (e) => {
            if (Math.abs(mousedownPosition[0] - e.pageX) + Math.abs(mousedownPosition[1] - e.pageY) > 3) {
                this.editorOverlay.appendChild(box);
            }
            const rect = this.cachedGameRect;
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
                        this.selectElement(openElements[name].element);
                } else {
                    if (data.clickzone.classList.contains("selected"))
                        this.deselectElement(openElements[name].element);
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

    doodlemodeMousedown(e) {
        const padding = 5;
        const gameRect = this.cachedGameRect;
        var canvasRect = [e.pageX - gameRect.left, e.pageY - gameRect.top, 0, 0];
        const element = this.createElement(
            canvasRect[0] / gameRect.width * 100,
            canvasRect[1] / gameRect.height * 100,
            1, 1,
            `<svg width="0" height="0" viewBox="0 0 0 0"><path d="" /></svg>`
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
            this.updateElementPoints(element, [
                [(min[0] - padding) / this.cachedGameRect.width * 100, (min[1] - padding) / this.cachedGameRect.height * 100],
                [(max[0] + padding) / this.cachedGameRect.width * 100, (min[1] - padding) / this.cachedGameRect.height * 100],
                [(max[0] + padding) / this.cachedGameRect.width * 100, (max[1] + padding) / this.cachedGameRect.height * 100],
                [(min[0] - padding) / this.cachedGameRect.width * 100, (max[1] + padding) / this.cachedGameRect.height * 100]
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
                this.deleteElement(element);
                return;
            }
            this.updateElementPoints(element, [
                [(canvasRect[0] - padding) / this.cachedGameRect.width * 100, (canvasRect[1] - padding) / this.cachedGameRect.height * 100],
                [(canvasRect[2] + canvasRect[0] + padding) / this.cachedGameRect.width * 100, (canvasRect[1] - padding) / this.cachedGameRect.height * 100],
                [(canvasRect[2] + canvasRect[0] + padding) / this.cachedGameRect.width * 100, (canvasRect[3] + canvasRect[1] + padding) / this.cachedGameRect.height * 100],
                [(canvasRect[0] - padding) / this.cachedGameRect.width * 100, (canvasRect[3] + canvasRect[1] + padding) / this.cachedGameRect.height * 100]
            ]);
            document.removeEventListener("mousemove", mousemoveEvent);
            document.removeEventListener("mouseup", mouseupEvent);
        }
        document.addEventListener("mousemove", mousemoveEvent);
        document.addEventListener("mouseup", mouseupEvent);
    }

    textmodeMousedown(e) {
        const mousedownPosition = [e.pageX, e.pageY];
        for (let name in openElements) {
            if (openElements[name].clickzone.classList.contains("selected"))
                this.deselectElement(openElements[name].element);
        }
        const box = document.createElement("div");
        box.style.position = "absolute";
        box.style.border = "1px solid greenyellow";
        box.style.boxSizing = "border-box";
        this.editorOverlay.appendChild(box);
        const mousemoveEvent = (e) => {
            const rect = this.cachedGameRect;
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
            const rect = this.cachedGameRect;
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
            const element = this.createElement(x, y, w, h);

            const textarea = document.createElement("textarea");
            textarea.setAttribute("autocomplete", "off");
            textarea.setAttribute("autocorrect", "off");
            textarea.setAttribute("autocapitalize", "off");
            textarea.setAttribute("spellcheck", "off");
            textarea.style.fontFamily = "var(--editor-font)";
            textarea.style.backgroundColor = "white";
            textarea.style.position = "absolute";
            textarea.style.transform = "translate(-50%, -50%)";
            const c = this.getElementCenter(element);
            textarea.style.left = c[0] + "%";
            textarea.style.top = c[1] + "%";
            textarea.value = element.innerHTML;
            textarea.oninput = () => {
                textarea.style.height = "";
                textarea.style.height = (textarea.scrollHeight + 2) + "px";
                this.setElementHTML(element, textarea.value);
                if (!sizeSet) {
                    const c = this.getElementCenter(element);
                    textarea.style.left = c[0] + "%";
                    textarea.style.top = c[1] + "%";
                    const x1 = x;
                    const y1 = y;
                    const x2 = x + (element.clientWidth / this.cachedGameRect.width * 100);
                    const y2 = y + (element.clientHeight / this.cachedGameRect.height * 100);
                    this.updateElementPoints(element, [
                        [x1, y1],
                        [x2, y1],
                        [x2, y2],
                        [x1, y2]
                    ]);
                }
            }
            this.editorOverlay.appendChild(textarea);
            setTimeout(() => {
                textarea.focus();
                textarea.onblur = () => {
                    textarea.remove();
                    if (sizeSet) box.remove();
                    if (textarea.value.trim() === "") {
                        this.deleteElement(element);
                    }
                }
            }, 1);

            this.switchMode();
            if (!sizeSet) box.remove();
            document.removeEventListener("mousemove", mousemoveEvent);
            document.removeEventListener("mouseup", mouseupEvent);
        }
        document.addEventListener("mousemove", mousemoveEvent);
        document.addEventListener("mouseup", mouseupEvent);
    }

    init(gameElement) {
        super.init(gameElement);
        window.addEventListener("load", () => {
            this.openElementInspector();
        }, { once: true });
        this.onresize();
        this.reorderPreviews();
    }

    initGameElement(gameElement) {
        super.initGameElement(gameElement);
        
        this.slidesContainer = document.querySelector(".fh-slides-container");
        while (this.slidesContainer.lastElementChild)
            this.slidesContainer.lastElementChild.remove();
        this.editorOverlay = document.querySelector(".fh-editor-overlay");
        this.editorInspector = document.querySelector(".fh-inspector");
        document.querySelector(".fh-editor .fh-game").replaceWith(this.gameElement);
    }
    
    initElements() {
        const createChildSlidePreviews = (parentSlide) => {
            for (let child of parentSlide.children) {
                if (child.classList.contains("fh-slide")) {
                    this.createSlidePreview(child);
                    createChildSlidePreviews(child);
                }
            }
        }
        createChildSlidePreviews(this.gameElement);
        this.refreshMedia();
    }

    async createGameFile() {
        var game_css = await fetch("/css/game.css").then(res => res.text());
        var game_module = await fetch("/js/game.js").then(res => res.text());
        game_module = game_module.replace("export { Game };", "");

        var html = await fetch("/template.html").then(res => res.text());
        html = html.replace("<title></title>", `<title>${this.gameElement.dataset.title}</title>`);
        html = html.replace("<!-- _FH_GAME_STYLE -->", `<style>${game_css}</style>`);
        html = html.replace("<!-- _FH_GAME_MODULE -->", `<script>${game_module}</script>`);
        
        const startString = "<!-- _FH_DATA_START -->";
        const endString = "<!-- _FH_DATA_END -->";
        html = 
            html.substring(0, html.indexOf(startString) + startString.length) + 
            this.gameElement.outerHTML + 
            html.substring(html.indexOf(endString), html.length);

        return new Blob([html], { type: "text/html" });
    }

    async playGame() {
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
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
        var blob = await this.createGameFile();
        var url = URL.createObjectURL(blob);
        window.open(url, "_blank").focus();
    }

    async saveGame() {
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
            asset.setAttribute("src", asset.dataset.filepath);
        }
        var file = await this.createGameFile();
        var url = URL.createObjectURL(file);

        var a = document.createElement("a");
        a.href = url;
        a.download = `${this.gameElement.dataset.title}.html`;
        a.click();
        
        this.refreshMedia();
    }

    async exportGame() {
        var mediaContained = {};
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
            asset.setAttribute("src", asset.dataset.filepath);
            mediaContained[asset.dataset.filepath] = true;
        }
        
        var zip = new JSZip();
        zip.file("index.html", await this.createGameFile());
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
        zip.generateAsync({ type: 'blob' }).then(content => {
            saveAs(content, `${this.gameElement.dataset.title}.zip`)
        })

        this.refreshMedia();
    }

    loadGame() {
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
                    gameElementContainer.firstElementChild;
                    this.init(gameElementContainer.firstElementChild);
                }
                reader.readAsText(htmlFile, "UTF-8");
            }
            input.value = "";
        }
        input.click();
    }

    createEditorClickzone(element) {
        const clickzone = document.createElement("div");
        clickzone.className = "fh-editor-clickzone";
        clickzone.setAttribute("name", element.getAttribute("name"));
        this.editorOverlay.appendChild(clickzone);

        var grabbedClickzones = [];
        var grabOffsets;
        var mousedownPosition;
        var cancelClick = false;
        var initialClick = false;
        var doubleClick = false;
        var doubleClickTimeout;

        clickzone.onwheel = (e) => {
            var points = openElements[element.getAttribute("name")].handle.points;
            const rect = this.cachedGameRect;
            const anchor = [
                (e.pageX - rect.left) / rect.width * 100,
                (e.pageY - rect.top) / rect.height * 100
            ]
            const scale = 1 + (e.deltaY / 1000);
            for (let point of points) {
                point[0] = anchor[0] + (point[0] - anchor[0]) * scale;
                point[1] = anchor[1] + (point[1] - anchor[1]) * scale;
            }
            this.updateElementPoints(element, points);
            e.preventDefault();
        }
        const mousemoveEvent = (e) => {
            if (Math.abs(mousedownPosition[0] - e.pageX) + Math.abs(mousedownPosition[1] - e.pageY) > 3) {
                cancelClick = true;
                doubleClick = false;
            }
            const rect = this.cachedGameRect;
            const x = (e.pageX - rect.left) / rect.width * 100;
            const y = (e.pageY - rect.top) / rect.height * 100;
            for (let i=0; i<grabbedClickzones.length; i++) {
                const clickzone = grabbedClickzones[i];
                const element = openElements[clickzone.getAttribute("name")].element;
                const offset = grabOffsets[i];
                this.setElementCenter(element, [offset[0] + x, offset[1] + y]);
            }
        }
        const mouseupEvent = () => {
            const points = openElements[element.getAttribute("name")].handle.points;
            if (!(
                points[0][0] < 100 &&
                points[2][0] > 0 &&
                points[0][1] < 100 &&
                points[2][0] > 0
            )) {
                console.log("out of bounds element deleted.");
                this.deleteElement(element);
            }
            document.removeEventListener("mousemove", mousemoveEvent);
            document.removeEventListener("mouseup", mouseupEvent);
        }
        clickzone.onmouseup = (e) => {
            if (editMode === "select" && e.button === 0) {
                if (!cancelClick) {
                    this.selectElement(element);
                }
                if (doubleClick) {
                    this.openElementInspector(element);
                    setTimeout(() => {
                        const textarea = this.editorInspector.querySelector("textarea");
                        if (textarea) {
                            textarea.focus();
                            textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                        }
                    }, 1);
                    doubleClick = false;
                }
            }
        }
        clickzone.onmousedown = (e) => {
            cancelClick = false;
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
                    doubleClick = true;
                }

                if (!shiftKey && !clickzone.classList.contains("selected")) {
                    for (let name in openElements) {
                        if (openElements[name].clickzone.classList.contains("selected"))
                            this.deselectElement(openElements[name].element);
                    }
                }

                const rect = this.cachedGameRect;
                const x = (e.pageX - rect.left) / rect.width * 100;
                const y = (e.pageY - rect.top) / rect.height * 100;

                const selected = this.editorOverlay.querySelectorAll(".fh-editor-clickzone.selected");
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
                    if (!shiftKey) this.bringElementToFront(el);
                    const center = this.getElementCenter(el);
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
            this.sendElementToBack(element);
            e.preventDefault();
        })

        return clickzone;
    }

    createElementHandle(element) {
        const name = element.getAttribute("name");

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "fh-element-handle");
        svg.setAttribute("name", name);
        this.editorOverlay.appendChild(svg);

        const handle = {
            svg: svg,
            points: this.createElementPointsArray(element),
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
                const x = (e.pageX - rect.left) / this.cachedGameRect.width * 100;
                const y = (e.pageY - rect.top) / this.cachedGameRect.height * 100;
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
                    const x = (e.pageX - rect.left) / this.cachedGameRect.width * 100;
                    const y = (e.pageY - rect.top) / this.cachedGameRect.height * 100;
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
                    this.updateElementPoints(element, handle.points);
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
                    const x = (e.pageX - parentRect.left) / this.cachedGameRect.width * 100;
                    const y = (e.pageY - parentRect.top) / this.cachedGameRect.height * 100;

                    handle.points[i] = [x, y];
                    if (shiftKey) {
                        var prev = i-1 < 0 ? 3 : i-1;
                        var next = i+1 > 3 ? 0 : i+1;
                        handle.points[(i%2==0 ? prev : next)][0] = handle.points[i][0];
                        handle.points[(i%2==0 ? next : prev)][1] = handle.points[i][1];
                    }

                    this.updateElementPoints(element, handle.points);
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

    sendElementToBack(element) {
        element.parentElement.prepend(element);

        if (element.parentElement === this.currentSlide) {
            const data = openElements[element.getAttribute("name")];

            const svg = data.handle.svg;
            svg.parentElement.prepend(svg);
            
            const clickzone = data.clickzone;
            clickzone.parentElement.prepend(clickzone);
        }
    }

    bringElementToFront(element) {
        element.parentElement.appendChild(element);

        if (element.parentElement === this.currentSlide) {
            const data = openElements[element.getAttribute("name")];

            const clickzone = data.clickzone;
            clickzone.parentElement.appendChild(clickzone);

            const svg = data.handle.svg;
            svg.parentElement.appendChild(svg);
        }
    }

    createElementPointsArray(element) {
        if (!element.dataset.x1) {
            const x1 = element.offsetLeft / this.cachedGameRect.width * 100;
            const y1 = element.offsetTop / this.cachedGameRect.height * 100;
            const x2 = (element.offsetLeft + element.clientWidth) / this.cachedGameRect.width * 100;
            const y2 = (element.offsetTop + element.clientHeight) / this.cachedGameRect.height * 100;
            this.updateElementPoints(element, [
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

    getElementCenter(element) {
        var points;
        if (element.parentElement === this.currentSlide) {
            points = openElements[element.getAttribute("name")].handle.points;
        } else {
            points = this.createElementPointsArray(element);
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

    setElementCenter(element, position) {
        const c = this.getElementCenter(element);
        var p;
        if (element.parentElement === this.currentSlide) {
            p = openElements[element.getAttribute("name")].handle.points;
        } else {
            p = this.createElementPointsArray(element);
        }
        const x = position[0] - c[0];
        const y = position[1] - c[1];
        this.updateElementPoints(element, [
            [p[0][0] + x, p[0][1] + y],
            [p[1][0] + x, p[1][1] + y],
            [p[2][0] + x, p[2][1] + y],
            [p[3][0] + x, p[3][1] + y]
        ]);
    }

    updateElementPoints(element, points) {
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

        this.updateTransform(element);
        this.updateSlidePreview(element.parentElement);
    }

    createSlidePreview(slide) {
        const name = slide.getAttribute("name");
        const container = document.createElement("div");
        container.setAttribute("name", name);
        container.dataset.path = this.getPath(slide);

        var inset = 0;
        var parentSlide = slide.parentElement;
        while (parentSlide !== this.gameElement) {
            inset++;
            parentSlide = parentSlide.parentElement;
        }
        container.dataset.inset = inset;
        
        container.className = "fh-slide-preview-container";
        if (slide.classList.contains("open")) {
            container.classList.add("selected");
        }
        container.onmousedown = (e) => {
            this.goto(container.dataset.path);
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
                    for (let slide of this.slidesContainer.children) {
                        if (slide === container) continue;
                        const rect = slide.getBoundingClientRect();
                        if (e.pageY > rect.top && e.pageY < rect.bottom) {
                            var ratio = 1/2;
                            if (slide === this.slidesContainer.firstElementChild)
                                ratio = 4/5;
                            if (e.pageY < rect.top + rect.height * ratio) {
                                this.slidesContainer.insertBefore(container, slide);
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
                        const style = getComputedStyle(this.slidesContainer);
                        const insetMargin = parseFloat(style.getPropertyValue("--inset-margin"));
                        const padding = parseFloat(style.getPropertyValue("--preview-padding"));
                        const pixelsInset = clone.querySelector(".fh-slide-preview").getBoundingClientRect().left - this.slidesContainer.getBoundingClientRect().left - padding;
                        var maxInset = parseInt(previous.dataset.inset) + 1;
                        var targetInset = 0;
                        if (pixelsInset > insetMargin) {
                            targetInset = Math.floor(pixelsInset / insetMargin);
                            targetInset = Math.min(maxInset, targetInset);
                        }
                        container.dataset.inset = targetInset;
                        this.updateSlidePreviewScale(container.querySelector(".fh-slide-preview"));
                    }
                }
                var muEvent = () => {
                    for (let collapsed of collapsedSlides) {
                        collapsed.dataset.inset = parseInt(collapsed.dataset.inset) - originalInset + parseInt(container.dataset.inset);
                    }
                    container.after(...collapsedSlides);
                    this.reorderPreviews();
                    clone.remove();
                    container.classList.remove("dragging");
                    document.removeEventListener("mousemove", mmEvent);
                    document.removeEventListener("mouseup", muEvent);
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

        const preview = document.createElement("div");
        preview.className = "fh-slide-preview";
        container.appendChild(preview);

        const label = document.createElement("label");
        label.textContent = name;
        container.appendChild(label);

        const button = document.createElement("button");
        button.textContent = "v";
        button.style.display = "none";
        container.appendChild(button);
        button.onclick = () => {
            this.togglePreviewCollapse(container);
        }

        this.slidesContainer.appendChild(container);
        this.updateSlidePreview(slide);
        if (this.cachedGameRect)
            this.updateSlidePreviewScale(preview);

        return container;
    }

    togglePreviewCollapse(preview) {
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
            var parentPreview = this.getParentPreview(nextPreview);
            while (!hidden && parentPreview !== preview) {
                if (parentPreview.classList.contains("collapsed"))
                    hidden = true;
                parentPreview = this.getParentPreview(parentPreview);
            }
            nextPreview.style.display = hidden ? "none" : "block";
            nextPreview = nextPreview.nextElementSibling;
        }
    }

    getParentPreview(preview) {
        var parentPreview = preview.previousElementSibling;
        while (parentPreview && parseInt(parentPreview.dataset.inset) >= parseInt(preview.dataset.inset)) {
            parentPreview = parentPreview.previousElementSibling;
        }
        return parentPreview;
    }

    updateSlidePreview(slide) {
        slide = slide || this.currentSlide;
        var preview = this.findSlidePreview(slide).querySelector(".fh-slide-preview");
        preview.innerHTML = "";
        for (let child of slide.children) {
            preview.appendChild(child.cloneNode(true));
        }
    }
    
    updateSlidePreviewScale(preview) {
        const inset = parseInt(preview.parentElement.dataset.inset);
        const style = getComputedStyle(this.slidesContainer);
        const padding = parseFloat(style.getPropertyValue("--preview-padding"));
        const insetMargin = parseFloat(style.getPropertyValue("--inset-margin"));
        const size = parseFloat(style.getPropertyValue("--preview-size"));
        var aspectRatio = parseFloat(this.gameElement.dataset.aspectratio);
        if (!aspectRatio || isNaN(aspectRatio)) aspectRatio = 1;

        var scale;
        if (aspectRatio < 1) {
            scale = size / this.cachedGameRect.height;
        } else {
            scale = size / this.cachedGameRect.width;
        }

        preview.style.width = this.gameElement.style.width;
        preview.style.height = this.gameElement.style.height;
        preview.style.fontSize = this.gameElement.style.fontSize;
        preview.style.transform = `scale(${scale})`;

        var left = insetMargin * inset + parseFloat(style.getPropertyValue("--preview-left-margin"));
        preview.style.left = left + "px";
        preview.nextElementSibling.style.left = left + "px";
        preview.style.top = padding + "px";

        preview.parentElement.style.width = Math.max(
            250, 
            this.cachedGameRect.width * scale + insetMargin * inset + parseFloat(style.getPropertyValue("--preview-right-margin")) + parseFloat(style.getPropertyValue("--preview-left-margin"))
        ) + "px";
        preview.parentElement.style.height = ((this.cachedGameRect.height * scale) + padding * 2) + "px";

        var button = preview.parentElement.querySelector("button");
        button.style.left = insetMargin * inset + "px";
    }

    onresize() {
        super.onresize();
        this.editorOverlay.style.width = this.gameElement.style.width;
        this.editorOverlay.style.height = this.gameElement.style.height;
        if (this.cachedGameRect) {
            for (let slide of this.gameElement.querySelectorAll(".fh-slide")) {
                slide.classList.add("open");
            }
            for (let element of document.querySelectorAll(".fh-element")) {
                this.updateTransform(element);
            }
            for (let slide of this.gameElement.querySelectorAll(".fh-slide")) {
                this.updateSlidePreview(slide);
            }
            for (let preview of this.slidesContainer.querySelectorAll(".fh-slide-preview")) {
                this.updateSlidePreviewScale(preview);
            }
            this.goto(this.currentSlide);
        }
    }

    switchMode(modename) {
        editMode = modename || "select";
        this.editorOverlay.style.cursor = "default";
        if (editMode === "text") {
            this.editorOverlay.style.cursor = "crosshair";
        } else if (editMode === "doodle") {
            this.editorOverlay.style.cursor = "crosshair";
            for (let name in openElements) {
                this.deselectElement(openElements[name].element);
            }
        }
        const toolbar = document.querySelector(".fh-toolbar");
        if (toolbar.querySelector(".selected"))
            toolbar.querySelector(".selected").classList.remove("selected");
        toolbar.querySelector(`[name=${editMode}_mode]`).classList.add("selected");
    }

    addSlide() {
        // apply focus on slides container
        this.slidesContainer.onmousedown();

        const slide = document.createElement("div");
        slide.className = "fh-slide";

        var basename = "slide";
        var i = 1;
        if (this.currentSlide) {
            var nameExists = true;
            while (nameExists) {
                nameExists = false;
                for (let sibling of this.currentSlide.parentElement.children) {
                    if (sibling.getAttribute("name") === basename + i) {
                        i++;
                        nameExists = true;
                    }
                }
            }
        }
        var name = basename + i;
        slide.setAttribute("name", name);
        if (this.currentSlide) {
            this.currentSlide.after(slide);
        } else {
            this.gameElement.appendChild(slide);
        }
        
        const preview = this.createSlidePreview(slide);
        if (this.currentSlide) {
            const siblingPreview = this.findSlidePreview(this.currentSlide);
            var child = siblingPreview;
            while (parseInt(child.nextElementSibling.dataset.inset) > parseInt(siblingPreview.dataset.inset)) {
                child = child.nextElementSibling;
            }
            child.after(preview);
        }

        this.goto(this.getPath(slide));
    }

    renameElement(element, name, preview) {
        if (element.classList.contains("fh-slide")) {
            preview = preview || this.findSlidePreview(element);
            preview.querySelector("label").textContent = name;
            preview.setAttribute("name", name);
            
            var repath = [];
            repath.push({
                preview: preview,
                element: element
            })
            for (let childSlide of element.querySelectorAll(".fh-slide")) {
                const preview = this.findSlidePreview(childSlide);
                repath.push({
                    preview: preview,
                    element: childSlide
                })
            }

            element.setAttribute("name", name);

            for (let data of repath) {
                data.preview.dataset.path = this.getPath(data.element);
            }

            if (document.body.querySelector(".fh-toolbar .selected[name=inspect]")) {
                this.editorInspector.querySelector("[name=rename]").value = name;
            }
        } else if (element.classList.contains("fh-element")) {
            if (element.parentElement === this.currentSlide) {
                const data = openElements[element.getAttribute("name")];
                data.clickzone.setAttribute("name", name);
                data.handle.svg.setAttribute("name", name);
                delete openElements[element.getAttribute("name")];
                openElements[name] = data;
            }

            element.setAttribute("name", name);

            if (element.parentElement === this.currentSlide) {
                const data = openElements[element.getAttribute("name")];
                if (data.clickzone.classList.contains("selected") && document.body.querySelector(".fh-toolbar .selected[name=inspect]"))
                    this.editorInspector.querySelector("[name=rename]").value = name;
            }
        }
    }

    createElement(x, y, w, h, content) {
        content = content || "";
        
        var basename = "element";
        var i = 1;
        while (this.currentSlide.querySelector(`:scope > [name="${basename+i}"]`)) {
            i++;
        }
        const name = basename + i;

        const element = document.createElement("div");
        element.className = "fh-element";
        element.innerHTML = content;
        element.setAttribute("name", name);
        this.currentSlide.appendChild(element);

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

        this.openElement(element);

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
                    this.updateTransform(element);
                }
            } else {
                asset.onload = () => {
                    this.updateTransform(element);
                }
            }
        }

        return element;
    }
    
    reorderPreviews() {
        var slidePreviewPairs = [];
        for (let preview of this.slidesContainer.children) {
            slidePreviewPairs.push({
                preview: preview,
                slide: this.getElementAtPath(preview.dataset.path)
            })
        }
        const getSlide = (preview) => {
            for (let check of slidePreviewPairs) {
                if (check.preview === preview)
                    return check.slide;
            }
            return null;
        }
        for (let selected of this.slidesContainer.querySelectorAll(".selected")) {
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
                this.renameElement(slide, name, selected);
            }
        }
        for (let preview of this.slidesContainer.children) {
            const slide = getSlide(preview);
            const inset = parseInt(preview.dataset.inset);
            var parentPreview = this.getParentPreview(preview);
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
                    this.renameElement(slide, name, preview);
                }
                parentSlide.appendChild(slide);
                preview.dataset.path = this.getPath(slide);
            } else {
                preview.dataset.inset = "0";
                var nextPreview = preview.nextElementSibling;
                while (nextPreview && parseInt(nextPreview.dataset.inset) >= inset) {
                    nextPreview.dataset.inset = parseInt(nextPreview.dataset.inset) - inset;
                    nextPreview = nextPreview.nextElementSibling;
                }
                this.gameElement.appendChild(slide);
                preview.dataset.path = this.getPath(slide);
            }

            this.updateSlidePreviewScale(preview.querySelector(".fh-slide-preview"));
        }
        for (let preview of this.slidesContainer.children) {
            preview.querySelector("button").style.display = "none";
            if (getSlide(preview).querySelectorAll(":scope > .fh-slide").length > 0) {
                preview.querySelector("button").style.display = "block";
            }
        }
        const selectedPreview = this.slidesContainer.querySelector(".selected");
        if (selectedPreview) {
            const parent = this.getParentPreview(selectedPreview);
            if (parent && parent.classList.contains("collapsed")) {
                this.togglePreviewCollapse(parent);
            }
            this.selectElement(getSlide(selectedPreview));
            this.goto(this.currentSlide);
        }
    }

    deleteElement(element) {
        if (element.classList.contains("fh-element")) {
            this.deselectElement(element);
            const slide = element.parentElement;
            if (slide === this.currentSlide) {
                const name = element.getAttribute("name");
                const data = openElements[name];
                data.clickzone.remove();
                data.handle.svg.remove();
                delete openElements[name];
            }
            element.remove();
            this.updateSlidePreview(slide);
        } else if (element.classList.contains("fh-slide")) {
            const preview = this.findSlidePreview(element);
            const nextPreview = preview.nextElementSibling || preview.previousElementSibling;

            if (this.currentSlide === element)
                this.currentSlide = null;

            preview.remove();
            this.reorderPreviews();
            element.remove();
            this.reorderPreviews();

            if (!nextPreview) {
                this.addSlide();
            } else {
                this.goto(nextPreview.dataset.path);
            }
        }
    }

    deselectElement(element) {
        if (element.parentElement === this.currentSlide) {
            const data = openElements[element.getAttribute("name")];
            data.clickzone.classList.remove("selected");
            data.handle.svg.style.display = "none";
            if (document.body.querySelector(".fh-toolbar .selected[name=inspect]"))
                this.openElementInspector();
        }
    }

    selectElement(element) {
        if (element.parentElement === this.currentSlide) {
            const data = openElements[element.getAttribute("name")];
            data.clickzone.classList.add("selected");
            data.handle.svg.style.display = "block";
            if (document.body.querySelector(".fh-toolbar .selected[name=inspect]"))
                this.openElementInspector(element);
        }
    }

    openElementInspector(element) {
        if (!element) {
            const selectedElement = this.editorOverlay.querySelector(".selected");
            if (selectedElement) {
                element = openElements[selectedElement.getAttribute("name")].element;
            } else {
                element = this.currentSlide;
            }
        }
        const name = element.getAttribute("name");

        for (let input of this.editorInspector.querySelectorAll("input, textarea")) {
            if (input.onblur)
                input.onblur();
        }

        if (element.classList.contains("fh-element")) {
            this.editorInspector.innerHTML = `
                <b>ELEMENT</b><br>
                <br>
                <label>name</label><br>
                <input type="text" value="${name}" name="rename" /><br>
                <br>
                <label>HTML</label><br>
                <textarea name="html">${element.innerHTML}</textarea><br>
                <br>
                <label>show script</label><br>
                <textarea name="onshow">${element.dataset.onshow ? element.dataset.onshow : ""}</textarea><br>
                <br>
                <label>click script</label><br>
                <textarea name="onclick">${element.dataset.onclick ? element.dataset.onclick : ""}</textarea><br>
                <br>
            `;

            const htmlInput = this.editorInspector.querySelector("[name=html]");
            const showScriptInput = this.editorInspector.querySelector("[name=onshow]");
            const clickScriptInput = this.editorInspector.querySelector("[name=onclick]");

            showScriptInput.addEventListener("input", () => {
                element.dataset.onshow = showScriptInput.value;
            })

            clickScriptInput.addEventListener("input", () => {
                element.dataset.onclick = clickScriptInput.value;
            })

            htmlInput.addEventListener("input", () => {
                this.setElementHTML(element, htmlInput.value);
            })
            htmlInput.onblur = () => {
                if (htmlInput.value.trim() === "") {
                    this.deleteElement(element);
                }
            }
        } else {
            // inspecting slide
            this.editorInspector.innerHTML = `
                <b>SLIDE</b><br>
                <br>
                <label>name</label><br>
                <input type="text" value="${name}" name="rename" /><br>
                <br>
                <label>enter script</label><br>
                <textarea name="onenter">${element.dataset.onenter ? element.dataset.onenter : ""}</textarea><br>
                <br>
                <label>exit script</label><br>
                <textarea name="onexit">${element.dataset.onexit ? element.dataset.onexit : ""}</textarea><br>
                <br>
                <label>CSS</label><br>
                <textarea name="css"></textarea><br>
                <br>
            `

            const enterScriptInput = this.editorInspector.querySelector("[name=onenter]");
            const exitScriptInput = this.editorInspector.querySelector("[name=onexit]");
            
            enterScriptInput.addEventListener("input", () => {
                element.dataset.onenter = enterScriptInput.value;
            })

            exitScriptInput.addEventListener("input", () => {
                element.dataset.onexit = exitScriptInput.value;
            })

            const cssInput = this.editorInspector.querySelector("[name=css]");
            var styleElement = element.querySelector(":scope > style");
            if (!styleElement) {
                styleElement = document.createElement("style");
                styleElement.textContent = "@scope {\n  svg {\n    stroke: black;\n    fill: none;\n  }\n}";
                element.prepend(styleElement);
            }
            cssInput.value = styleElement.textContent;
            cssInput.addEventListener("input", () => {
                styleElement.textContent = cssInput.value;
                for (let name in openElements) {
                    this.updateTransform(openElements[name].element);
                }
                this.updateSlidePreview(element);
            })
        }

        const nameInput = this.editorInspector.querySelector("[name=rename]");
        nameInput.onchange = nameInput.onblur = () => {
            if (!element.parentElement) return;
            var name = this.editorInspector.querySelector("[name=rename]").value.trim();
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
                this.renameElement(element, name);
            }
        }

        for (let textarea of this.editorInspector.querySelectorAll("textarea")) {
            textarea.setAttribute("autocomplete", "off");
            textarea.setAttribute("autocorrect", "off");
            textarea.setAttribute("autocapitalize", "off");
            textarea.setAttribute("spellcheck", "off");
            textarea.style.width = "100%";
            textarea.addEventListener("input", function() {
                this.style.height = "";
                this.style.height = (this.scrollHeight + 2) + "px";
            })
            textarea.style.height = (textarea.scrollHeight + 2) + "px";
        }

        const selectedInspector = document.body.querySelector(".fh-toolbar .inspector.selected");
        if (selectedInspector)
            selectedInspector.classList.remove("selected");
        document.body.querySelector(".fh-toolbar [name=inspect]").classList.add("selected");
    }

    openDocumentInspector() {
        this.editorInspector.innerHTML = `
            <b>GAME</b><br>
            <br>
            <label>title</label><br>
            <input type="text" value="${this.gameElement.dataset.title}" name="title" /><br>
            <br>
            <label>aspect ratio</label><br>
            <input type="number" value="${this.gameElement.dataset.aspectratio}" step="0.1" name="aspectratio" /><br>
            <br>
            <div style="display: flex; gap: 1.5em;">
                <button type="button" name="load"><b><</b><br>load</button>
                <button type="button" name="save"><b>v</b><br>save</button>
                <button type="button" name="export"><b>[]</b><br>export</button>
            </div>
            <input style="display: none;" type="file" accept="text/html" name="html_input">
        `

        this.editorInspector.querySelector("[name=load]").onclick = () => this.loadGame();
        this.editorInspector.querySelector("[name=save]").onclick = () => this.saveGame();
        this.editorInspector.querySelector("[name=export]").onclick = () => this.exportGame();
        
        const titleInput = this.editorInspector.querySelector("[name=title]");
        titleInput.oninput = () => {
            this.gameElement.dataset.title = titleInput.value;
            document.title = titleInput.value;
        }

        const aspectRatioInput = this.editorInspector.querySelector("[name=aspectratio]");
        aspectRatioInput.oninput = () => {
            this.gameElement.dataset.aspectratio = aspectRatioInput.value;
            this.onresize();
        }

        const selectedInspector = document.body.querySelector(".fh-toolbar .inspector.selected");
        if (selectedInspector)
            selectedInspector.classList.remove("selected");
        document.body.querySelector(".fh-toolbar [name=document]").classList.add("selected");
    }

    createMediaFolder(files) {
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
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
                    this.switchMode();

                const rect = this.cachedGameRect;
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

                const element = this.createElement(
                    (e.pageX - rect.left) / rect.width * 100 - width/2,
                    (e.pageY - rect.top) / rect.height * 100 - height/2,
                    width, height, html
                );

                if (type === "image") {
                    element.querySelector("img").onload = () => {
                        this.updateTransform(element);
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
                            this.updateElementPoints(element, [
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
                    this.updateElementPoints(element, [
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
        
        this.refreshMedia();
    }

    async refreshMedia() {
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
            asset.removeAttribute("src");
        }

        if (!mediaFolder) return;
        
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
            const referenceElement = mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
            if (!referenceElement) {
                console.error(`media asset "${asset.dataset.filepath}" was not found.`);
                break;
            }
            asset.setAttribute("src", referenceElement.dataset.url);
        }

        setTimeout(() => {
            this.onresize();
        }, 500);
    }

    openMediaInspector() {
        this.editorInspector.innerHTML = "";
        this.editorInspector.appendChild(mediaFolder);

        var reloadButton = document.createElement("button");
        reloadButton.type = "button";
        reloadButton.textContent = "(re)load folder";
        reloadButton.onclick = () => {
            mediaFolder = null;
            document.querySelector(".inspector[name=media]").click();
        }
        this.editorInspector.appendChild(reloadButton);

        const selectedInspector = document.body.querySelector(".fh-toolbar .inspector.selected");
        if (selectedInspector)
            selectedInspector.classList.remove("selected");
        document.body.querySelector(".fh-toolbar [name=media]").classList.add("selected");
    }

    goto(path) {
        while (this.slidesContainer.querySelector(".selected"))
            this.slidesContainer.querySelector(".selected").classList.remove("selected");
        for (let name in openElements) {
            this.deselectElement(openElements[name].element);
        }
        while (this.editorOverlay.lastElementChild) {
            this.editorOverlay.lastElementChild.remove();
        }

        super.goto(path);

        this.findSlidePreview(this.currentSlide).classList.add("selected");

        for (let element of this.currentSlide.children) {
            if (element.classList.contains("fh-element")) {
                this.openElement(element);
            }
        }
        if (document.body.querySelector(".fh-toolbar .selected[name=inspect]"))
            this.openElementInspector();
    }

    openElement(element) {
        openElements[element.getAttribute("name")] = {
            element: element,
            clickzone: this.createEditorClickzone(element),
            handle: this.createElementHandle(element),
        }
        this.updateElementPoints(element, this.createElementPointsArray(element));
    }

    findSlidePreview(slide) {
        return this.slidesContainer.querySelector(`[data-path="${this.getPath(slide)}"]`);
    }

    setElementHTML(element, html) {
        element.innerHTML = html;
        if (element.getAttribute("name") in openElements) {
            this.updateTransform(element);
        }
        this.updateSlidePreview(element.parentElement);
    }

    async runScript(script) { }
}

export { Editor };