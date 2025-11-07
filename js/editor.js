import { Game } from "./game.js";
import { loadAssetFolder } from "./folder.js";

class Editor extends Game {
    editMode = "select";
    shiftKey = false;
    metaKey = false;
    openElements = {};
    mediaFolder;

    constructor(gameElement) {
        const main = document.querySelector(".fh-game-container");
        main.onmousedown = (e) => {
            if (document.querySelector(".fh-editor .focused"))
                document.querySelector(".fh-editor .focused").classList.remove("focused");
            main.classList.add("focused");
            if (e.target.classList.contains("fh-game-container") || e.target === this.editorOverlay) {
                for (let name in this.openElements) {
                    if (this.openElements[name].clickzone.classList.contains("selected"))
                        this.deselectElement(this.openElements[name].element);
                }

                if (this.editMode === "select") {
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
            if (!this.mediaFolder) {
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
                this.shiftKey = true;
            if (e.key === "Meta" || e.key === "Ctrl")
                this.metaKey = true;

            if (e.key === "Delete" || e.key === "Backspace") {
                if (this.slidesContainer.classList.contains("focused")) {
                    for (let preview of this.slidesContainer.querySelectorAll(".fh-slide-preview-container.selected")) {
                        this.deleteElement(this.getElementAtPath(preview.dataset.path));
                    }
                } else {
                    for (let clickzone of this.editorOverlay.querySelectorAll(".fh-editor-clickzone.selected")) {
                        this.deleteElement(this.openElements[clickzone.getAttribute("name")].element);
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

            var pastedElement;

            const selectedClickzone = this.editorOverlay.querySelector(".selected");
            if (selectedClickzone) {
                const element = this.openElements[selectedClickzone.getAttribute("name")].element;
                if (this.metaKey && e.code === "KeyC") {
                    //copy
                    navigator.clipboard.writeText(element.innerHTML);
                    this.copiedElement = element;
                    e.preventDefault();
                } else if (this.metaKey && e.code === "KeyX") {
                    //cut
                    navigator.clipboard.writeText(element.innerHTML);
                    this.copiedElement = element;
                    this.deleteElement(element);
                    e.preventDefault();
                } else if (this.metaKey && e.code === "KeyD") {
                    //duplicate
                    const newElement = this.createElement(0, 0, 0, 0, element.innerHTML);
                    this.updateElementPoints(newElement, this.openElements[selectedClickzone.getAttribute("name")].handle.points);
                    var name = element.getAttribute("name") + "*";
                    var nameExists = true;
                    while (nameExists) {
                        nameExists = false;
                        for (let child of this.currentSlide.children) {
                            if (child !== newElement && child.getAttribute("name") === name) {
                                name = name + "*";
                                nameExists = true;
                            }
                        }
                    }
                    this.renameElement(newElement, name);
                    e.preventDefault();
                }
            }

            if (this.metaKey && e.code === "KeyV") {
                //paste
                navigator.clipboard.readText()
                .then(text => {
                    const element = this.createElement(0, 0, 0, 0, text);
                    if (this.copiedElement) {
                        var points = this.createElementPointsArray(this.copiedElement);
                        this.updateElementPoints(element, points);
                        var name = this.copiedElement.getAttribute("name");
                        var nameExists = true;
                        while (nameExists) {
                            nameExists = false;
                            for (let child of this.currentSlide.children) {
                                if (child !== element && child.getAttribute("name") === name) {
                                    name = name + "*";
                                    nameExists = true;
                                }
                            }
                        }
                        this.renameElement(element, name);
                    }
                })
                e.preventDefault();
            }
        })
        document.addEventListener("keyup", e => {
            if (e.key === "Shift")
                this.shiftKey = false;
            if (e.key === "Meta" || e.key === "Ctrl")
                this.metaKey = false;
        })

        super(gameElement);
        
        this.editorOverlay.addEventListener("mousedown", e => {
            if (this.editMode === "text") {
                this.textmodeMousedown(e);
            } else if (this.editMode === "doodle") {
                this.doodlemodeMousedown(e);
            }
        })
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

            for (let name in this.openElements) {
                const data = this.openElements[name];
                const points = data.handle.points;
                if (
                    min[0] < points[2][0] &&
                    max[0] > points[0][0] &&
                    min[1] < points[2][1] &&
                    max[1] > points[0][1]
                ) {
                    if (!data.clickzone.classList.contains("selected"))
                        this.selectElement(this.openElements[name].element);
                } else {
                    if (data.clickzone.classList.contains("selected"))
                        this.deselectElement(this.openElements[name].element);
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
            0, 0,
            `<svg width="0" height="0"><path fill="none" stroke="black" stroke-width="1" d=""></path></svg>`
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
        for (let name in this.openElements) {
            if (this.openElements[name].clickzone.classList.contains("selected"))
                this.deselectElement(this.openElements[name].element);
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
                textarea.style.height = textarea.scrollHeight + "px";
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
        this.openElementInspector();
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
            const referenceElement = this.mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
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
            var source = this.mediaFolder.querySelector(`[data-filepath="${key}"]`);
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
            var htmlFile;
            // var mediaDirectory;
            // if (input.files.length > 1) {
            //     for (let file of input.files) {
            //         console.log(file);
            //     }
            // } else {
                htmlFile = input.files[0];
            // }
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

        clickzone.onwheel = (e) => {
            var points = this.openElements[element.getAttribute("name")].handle.points;
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
            }
            const rect = this.cachedGameRect;
            const x = (e.pageX - rect.left) / rect.width * 100;
            const y = (e.pageY - rect.top) / rect.height * 100;
            for (let i=0; i<grabbedClickzones.length; i++) {
                const clickzone = grabbedClickzones[i];
                const element = this.openElements[clickzone.getAttribute("name")].element;
                const offset = grabOffsets[i];
                this.setElementCenter(element, [offset[0] + x, offset[1] + y]);
            }
        }
        const mouseupEvent = () => {
            const points = this.openElements[element.getAttribute("name")].handle.points;
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
        clickzone.onmouseup = () => {
            if (!cancelClick) {
                this.selectElement(element);
            }
            if (!initialClick && !cancelClick) {
                this.openElementInspector(element);
                setTimeout(() => {
                    const textarea = this.editorInspector.querySelector("textarea");
                    if (textarea) {
                        textarea.focus();
                        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                    }
                }, 1);
            }
        }
        clickzone.onmousedown = (e) => {
            cancelClick = false;
            mousedownPosition = [e.pageX, e.pageY];

            if (this.editMode === "select") {
                if (e.button === 0) {
                    initialClick = !clickzone.classList.contains("selected");

                    if (!this.shiftKey && !clickzone.classList.contains("selected")) {
                        for (let name in this.openElements) {
                            if (this.openElements[name].clickzone.classList.contains("selected"))
                                this.deselectElement(this.openElements[name].element);
                        }
                    }

                    const rect = this.cachedGameRect;
                    const x = (e.pageX - rect.left) / rect.width * 100;
                    const y = (e.pageY - rect.top) / rect.height * 100;

                    const selected = this.editorOverlay.querySelectorAll(".fh-editor-clickzone.selected");
                    if (clickzone.classList.contains("selected")) {
                        grabbedClickzones = [...selected];
                    } else if (this.shiftKey) {
                        grabbedClickzones = [...selected, clickzone];
                    } else {
                        grabbedClickzones = [clickzone];
                    }
                    
                    grabOffsets = [];
                    for (let clickzone of grabbedClickzones) {
                        const name = clickzone.getAttribute("name");
                        const el = this.openElements[name].element;
                        if (!this.shiftKey) this.bringElementToFront(el);
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
                    if (this.shiftKey) {
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
                    if (this.shiftKey) {
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
            const data = this.openElements[element.getAttribute("name")];

            const svg = data.handle.svg;
            svg.parentElement.prepend(svg);
            
            const clickzone = data.clickzone;
            clickzone.parentElement.prepend(clickzone);
        }
    }

    bringElementToFront(element) {
        element.parentElement.appendChild(element);

        if (element.parentElement === this.currentSlide) {
            const data = this.openElements[element.getAttribute("name")];

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
            points = this.openElements[element.getAttribute("name")].handle.points;
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
            p = this.openElements[element.getAttribute("name")].handle.points;
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

        if (element.parentElement === this.currentSlide) {
            const data = this.openElements[element.getAttribute("name")];

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

        this.updateElementTransform(element);
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
            this.goto(this.getPath(slide));
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
                var mmEvent = (e) => {
                    clone.style.left = (offset[0] + e.pageX) + "px";
                    clone.style.top = (offset[1] + e.pageY) + "px";
                    for (let slide of [...this.slidesContainer.children]) {
                        if (slide === container) continue;
                        const rect = slide.getBoundingClientRect();
                        if (e.pageY > rect.top && e.pageY < rect.bottom) {
                            var ratio = 1/2;
                            if (slide === this.slidesContainer.firstElementChild)
                                ratio = 4/5;
                            if (e.pageY < rect.top + rect.height * ratio) {
                                this.slidesContainer.insertBefore(container, slide);
                            } else {
                                slide.after(container);
                            }
                            break;
                        }
                    }

                    const previous = container.previousElementSibling;
                    if (previous) {
                        const style = getComputedStyle(this.slidesContainer);
                        const insetMargin = parseFloat(style.getPropertyValue("--inset-margin"));
                        const padding = parseFloat(style.getPropertyValue("--preview-padding"));
                        const pixelsInset = clone.querySelector(".fh-slide-preview").getBoundingClientRect().left - padding;
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

        this.slidesContainer.appendChild(container);
        this.updateSlidePreview(slide);
        if (this.cachedGameRect)
            this.updateSlidePreviewScale(preview);

        return container;
    }

    updateSlidePreview(slide) {
        slide = slide || this.currentSlide;
        var preview = this.findSlidePreview(slide).querySelector(".fh-slide-preview");
        preview.innerHTML = "";
        for (let child of slide.children) {
            if (child.classList.contains("fh-element")) {
                preview.appendChild(child.cloneNode(true));
            }
        }
    }
    
    updateSlidePreviewScale(preview) {
        const inset = parseInt(preview.parentElement.dataset.inset);
        const style = getComputedStyle(this.slidesContainer);
        const width = parseFloat(style.getPropertyValue("--preview-width"));
        const padding = parseFloat(style.getPropertyValue("--preview-padding"));
        const insetMargin = parseFloat(style.getPropertyValue("--inset-margin"));
        const scale = (width - insetMargin * inset) / this.cachedGameRect.width;

        preview.style.width = this.gameElement.style.width;
        preview.style.height = this.gameElement.style.height;
        preview.style.fontSize = this.gameElement.style.fontSize;
        preview.style.transform = `scale(${scale})`;

        var left = padding + insetMargin * inset;
        preview.style.left = left + "px";
        preview.nextElementSibling.style.left = left + "px";
        preview.style.top = padding + "px";
        preview.parentElement.style.height = ((this.cachedGameRect.height * scale) + padding * 2) + "px";
    }

    onresize() {
        super.onresize();
        this.editorOverlay.style.width = this.gameElement.style.width;
        this.editorOverlay.style.height = this.gameElement.style.height;
        for (let preview of this.slidesContainer.querySelectorAll(".fh-slide-preview")) {
            this.updateSlidePreviewScale(preview);
        }
        for (let slide of this.gameElement.querySelectorAll(".fh-slide")) {
            this.updateSlidePreview(slide);
        }
        var parentSlide = this.currentSlide.parentElement;
        while (parentSlide !== this.gameElement) {
            for (let child of parentSlide.children) {
                if (child.classList.contains("fh-element")) {
                    this.updateElementTransform(child);
                }
            }
            parentSlide = parentSlide.parentElement;
        }
    }

    switchMode(modename) {
        this.editMode = modename || "select";
        this.editorOverlay.style.cursor = "default";
        if (this.editMode === "text") {
            this.editorOverlay.style.cursor = "crosshair";
        } else if (this.editMode === "doodle") {
            this.editorOverlay.style.cursor = "crosshair";
        }
        const toolbar = document.querySelector(".fh-toolbar");
        if (toolbar.querySelector(".selected"))
            toolbar.querySelector(".selected").classList.remove("selected");
        toolbar.querySelector(`[name=${this.editMode}_mode]`).classList.add("selected");
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

    renameElement(element, name) {
        if (element.classList.contains("fh-slide")) {
            const preview = this.findSlidePreview(element);
            preview.querySelector("label").textContent = name;
            
            var repath = [];
            repath.push({
                preview: preview,
                element: element
            })
            for (let childSlide of element.querySelectorAll(".fh-slide")) {
                const preview = childSlide.findSlidePreview();
                repath.push({
                    preview: preview,
                    element: childSlide
                })
            }

            element.setAttribute("name", name);

            for (let data of repath) {
                data.preview.dataset.path = this.getPath(data.element);
            }

            if (document.body.querySelector(".fh-toolbar .selected[name=inspect]"))
                this.openElementInspector();
        } else if (element.classList.contains("fh-element")) {
            if (element.parentElement === this.currentSlide) {
                const data = this.openElements[element.getAttribute("name")];
                data.clickzone.setAttribute("name", name);
                data.handle.svg.setAttribute("name", name);
                delete this.openElements[element.getAttribute("name")];
                this.openElements[name] = data;
            }

            element.setAttribute("name", name);

            if (element.parentElement === this.currentSlide) {
                const data = this.openElements[element.getAttribute("name")];
                if (data.clickzone.classList.contains("selected") && document.body.querySelector(".fh-toolbar .selected[name=inspect]"))
                    this.openElementInspector(element);
            }
        }
    }

    createElement(x, y, w, h, content) {
        content = content || "";
        
        var basename = "element";
        var i = 1;
        while (this.currentSlide.parentElement.querySelector(
            `.fh-slide[name="${this.currentSlide.getAttribute("name")}"] > [name="${basename+i}"]`
        )) {
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
            const referenceElement = this.mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
            if (!referenceElement) {
                console.error(`media asset "${asset.dataset.filepath}" was not found.`);
                break;
            }
            asset.setAttribute("src", referenceElement.dataset.url);
            if (asset.tagName === "source") {
                asset.parentElement.load();
                asset.parentElement.onloadeddata = () => {
                    this.updateElementTransform(element);
                }
            } else {
                asset.onload = () => {
                    this.updateElementTransform(element);
                }
            }
        }

        return element;
    }
    
    reorderPreviews() {
        var elementMatches = {};
        for (let preview of this.slidesContainer.children) {
            elementMatches[preview.dataset.path] = this.getElementAtPath(preview.dataset.path);
        }
        for (let preview of this.slidesContainer.children) {
            if (preview.dataset.inset !== "0") {
                var parentPreview = preview.previousElementSibling;
                while (parentPreview && parseInt(parentPreview.dataset.inset) >= parseInt(preview.dataset.inset)) {
                    parentPreview = parentPreview.previousElementSibling;
                }
                if (!parentPreview) {
                    preview.dataset.inset = "0";
                } else {
                    preview.dataset.inset = parseInt(parentPreview.dataset.inset) + 1;
                    const slide = elementMatches[preview.dataset.path];
                    const parentSlide = this.getElementAtPath(parentPreview.dataset.path);

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
                        this.renameElement(slide, name);
                    }
                    parentSlide.appendChild(slide);
                    preview.dataset.path = this.getPath(slide);
                }
                this.updateSlidePreviewScale(preview.querySelector(".fh-slide-preview"));
            }

            if (preview.dataset.inset === "0") {
                const slide = this.getElementAtPath(preview.dataset.path);

                var name = slide.getAttribute("name");
                var nameExists = true;
                while (nameExists) {
                    nameExists = false;
                    for (let child of this.gameElement.children) {
                        if (child !== slide && child.getAttribute("name") === name) {
                            name = name + "*";
                            nameExists = true;
                        }
                    }
                }
                if (name !== slide.getAttribute("name")) {
                    this.renameElement(slide, name);
                }

                this.gameElement.appendChild(slide);
                preview.dataset.path = this.getPath(slide);
            }
        }
        const selectedPreview = this.slidesContainer.querySelector(".selected");
        if (selectedPreview)
            this.goto(selectedPreview.dataset.path);
    }

    deleteElement(element) {
        if (element.classList.contains("fh-element")) {
            this.deselectElement(element);
            const slide = element.parentElement;
            if (slide === this.currentSlide) {
                const name = element.getAttribute("name");
                const data = this.openElements[name];
                data.clickzone.remove();
                data.handle.svg.remove();
                delete this.openElements[name];
            }
            element.remove();
            this.updateSlidePreview(slide);
        } else if (element.classList.contains("fh-slide")) {
            const preview = this.findSlidePreview(element);
            const nextPreview = preview.nextElementSibling || preview.previousElementSibling;

            preview.remove();
            this.reorderPreviews();

            element.remove();

            if (this.currentSlide === element)
                this.currentSlide = null;

            if (!nextPreview) {
                this.addSlide();
            } else {
                this.goto(nextPreview.dataset.path);
            }
        }
    }

    deselectElement(element) {
        if (element.parentElement === this.currentSlide) {
            const data = this.openElements[element.getAttribute("name")];
            data.clickzone.classList.remove("selected");
            data.handle.svg.style.display = "none";
            if (document.body.querySelector(".fh-toolbar .selected[name=inspect]"))
                this.openElementInspector();
        }
    }

    selectElement(element) {
        if (element.parentElement === this.currentSlide) {
            const data = this.openElements[element.getAttribute("name")];
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
                element = this.openElements[selectedElement.getAttribute("name")].element;
            } else {
                element = this.currentSlide;
            }
        }
        const name = element.getAttribute("name");
        if (element.classList.contains("fh-element")) {
            this.editorInspector.innerHTML = `
                <b>ELEMENT</b><br>
                <br>
                <label>name</label><br>
                <input type="text" value="${name}" name="rename" /><br>
                <br>
                <label>HTML</label><br>
                <textarea style="width: 100%;" name="html">${element.innerHTML}</textarea><br>
                <br>
                <label>click script</label><br>
                <textarea style="width: 100%;" name="onclick">${element.dataset.onclick ? element.dataset.onclick : ""}</textarea><br>
                <br>
                <label>x&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</label> <input type="number" value="${element.dataset.x1}" name="x"></input><br>
                <label>y&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</label> <input type="number" value="${element.dataset.y1}" name="y"></input><br>
                <br>
            `;

            const xInput = this.editorInspector.querySelector("[name=x]");
            const yInput = this.editorInspector.querySelector("[name=y]");
            xInput.onchange = () => {
                var points = element.parentElement === this.currentSlide ? this.openElements[name].handle.points : this.createElementPointsArray(element);
                const x = parseInt(xInput.value);
                points[1][0] = (points[1][0] - points[0][0]) + x;
                points[2][0] = (points[2][0] - points[0][0]) + x;
                points[0][0] = x;
                points[3][0] = x;
                this.updateElementPoints(element, points);
            }
            yInput.onchange = () => {
                var points = element.parentElement === this.currentSlide ? this.openElements[name].handle.points : this.createElementPointsArray(element);
                const y = parseInt(yInput.value);
                points[2][1] = (points[2][1] - points[0][1]) + y;
                points[3][1] = (points[3][1] - points[0][1]) + y;
                points[0][1] = y;
                points[1][1] = y;
                this.updateElementPoints(element, points);
            }

            const htmlInput = this.editorInspector.querySelector("[name=html]");
            const clickScriptInput = this.editorInspector.querySelector("[name=onclick]");
            clickScriptInput.onchange = () => {
                element.dataset.onclick = clickScriptInput.value;
            }

            htmlInput.oninput = clickScriptInput.oninput = function() {
                this.style.height = "";
                this.style.height = this.scrollHeight + "px";
            }

            htmlInput.addEventListener("input", () => {
                this.setElementHTML(element, htmlInput.value);
            })
            htmlInput.onblur = () => {
                if (htmlInput.value.trim() === "") {
                    this.deleteElement(element);
                }
            }

            htmlInput.oninput();
            clickScriptInput.oninput();
        } else {
            // inspecting slide
            this.editorInspector.innerHTML = `
                <b>SLIDE</b><br>
                <br>
                <label>name</label><br>
                <input type="text" value="${name}" name="rename" /><br>
                <br>
                <label>enter script</label><br>
                <textarea style="width: 100%" name="onenter">${element.dataset.onenter ? element.dataset.onenter : ""}</textarea><br>
                <br>
                <label>exit script</label><br>
                <textarea style="width: 100%" name="onexit">${element.dataset.onexit ? element.dataset.onexit : ""}</textarea><br>
                <br>
            `

            const enterScriptInput = this.editorInspector.querySelector("[name=onenter]");
            enterScriptInput.onchange = () => {
                element.dataset.onenter = enterScriptInput.value;
            }

            const exitScriptInput = this.editorInspector.querySelector("[name=onexit]");
            exitScriptInput.onchange = () => {
                element.dataset.onexit = exitScriptInput.value;
            }

            exitScriptInput.oninput = enterScriptInput.oninput = function() {
                this.style.height = "";
                this.style.height = this.scrollHeight + "px";
            }

            exitScriptInput.oninput();
            enterScriptInput.oninput();
        }

        this.editorInspector.querySelector("[name=rename]").onchange = () => {
            var name = this.editorInspector.querySelector("[name=rename]").value.trim();
            var nameExists = true;
            while (nameExists) {
                nameExists = false;
                for (let sibling of element.parentElement.children) {
                    if (sibling !== element && sibling.getAttribute("name") === name) {
                        name = name + "*";
                        nameExists = true;
                    }
                }
            }
            if (name !== element.getAttribute("name")) {
                this.renameElement(element, name);
            }
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
        titleInput.onchange = () => {
            this.gameElement.dataset.title = titleInput.value;
            document.title = titleInput.value;
        }

        const aspectRatioInput = this.editorInspector.querySelector("[name=aspectratio]");
        aspectRatioInput.onchange = () => {
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

        this.mediaFolder = document.createElement("ul");
        loadAssetFolder(files, this.mediaFolder);

        for (let file of this.mediaFolder.querySelectorAll(".file")) {
            file.onmousedown = async (e) => {
                const type = file.dataset.type;
                const format = file.dataset.format;
                const filepath = file.dataset.filepath;

                if (this.editMode !== "select")
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
                        this.updateElementTransform(element);
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

                const clickzone = this.openElements[element.getAttribute("name")].clickzone;
                clickzone.onmousedown(e);
            }
        }
        
        this.refreshMedia();
    }

    async refreshMedia() {
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
            asset.removeAttribute("src");
        }

        if (!this.mediaFolder) return;
        
        for (let asset of this.gameElement.querySelectorAll("[data-filepath]")) {
            const referenceElement = this.mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
            if (!referenceElement) {
                console.error(`media asset "${asset.dataset.filepath}" was not found.`);
                break;
            }
            asset.setAttribute("src", referenceElement.dataset.url);
        }
    }

    openMediaInspector() {
        this.editorInspector.innerHTML = "";
        this.editorInspector.appendChild(this.mediaFolder);

        var reloadButton = document.createElement("button");
        reloadButton.type = "button";
        reloadButton.textContent = "(re)load folder";
        reloadButton.onclick = () => {
            this.mediaFolder = null;
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
        for (let name in this.openElements) {
            this.deselectElement(this.openElements[name].element);
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
        this.openElements[element.getAttribute("name")] = {
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
        if (element.getAttribute("name") in this.openElements) {
            this.updateElementTransform(element);
        }
        this.updateSlidePreview(element.parentElement);
    }

    async runScript(script) { }
}

export { Editor };