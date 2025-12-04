import { transform2d } from './matrix.js';

const isEditor = document.querySelector(".fh-editor");

class Game {
    gameElement;
    currentSlide;

    constructor(gameElement) {
        this.init(gameElement);
        window.onresize = window.onload = () => {
            this.onresize();
        }
    }

    init(gameElement) {
        this.currentSlide = null;
        this.gameElement = null;

        this.initGameElement(gameElement);
        this.initElements();

        const openSlides = this.gameElement.querySelectorAll(".fh-slide.open");
        if (openSlides.length > 0) {
            this.goto(openSlides[openSlides.length - 1]);
        } else {
            console.error("no open slide found. picking topmost slide.");
            const slide = this.gameElement.querySelector(".fh-slide");
            if (!slide) {
                throw new Error("no slides found.");
            }
            this.goto(slide);
        }

        this.onresize();
    }

    initGameElement(gameElement) {
        const elementPositioned = !!gameElement;
        gameElement = gameElement || document.createElement("div");
        gameElement.className = "fh-game";

        if (!gameElement.firstElementChild)
            gameElement.innerHTML = `<div class="fh-slide open" name="slide1"></div>`;
        if (!gameElement.dataset.aspectratio)
            gameElement.dataset.aspectratio = 1;
        if (!gameElement.dataset.title)
            gameElement.dataset.title = "untitled";
        document.title = gameElement.dataset.title;
        if (!elementPositioned) {
            document.body.appendChild(gameElement);
        }
        this.gameElement = gameElement;
    }

    initElements() {
        for (let element of this.gameElement.querySelectorAll(".fh-slide > .fh-element")) {
            //TODO: proper script parsing here to check if script is empty / only populated with comments
            if (element.dataset.onclick && element.dataset.onclick.trim() !== "") {
                const clickzone = document.createElement("button");
                clickzone.type = "button";
                clickzone.textContent = element.textContent;
                clickzone.className = "fh-clickzone";
                clickzone.setAttribute("name", element.getAttribute("name"));

                var points = this.createElementPointsArray(element);
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
                clickzone.style.left = min[0] + "%";
                clickzone.style.top = min[1] + "%";
                clickzone.style.width = (max[0] - min[0]) + "%";
                clickzone.style.height = (max[1] - min[1]) + "%";

                clickzone.onclick = () => {
                    this.runScript(element.dataset.onclick, element);
                };
                element.parentElement.appendChild(clickzone);
            }
        }
    }

    async runScript(script, element) {
        const keys = Object.getOwnPropertyNames(Game.prototype);
        const values = keys.map(key => this[key].bind(this));
        Function(...keys, `(async () => { ${script} })()`).apply(element || window, values);
    }

    onresize() {
        let ratio = parseFloat(this.gameElement.dataset.aspectratio);
        if (!ratio || isNaN(ratio)) ratio = 1;
        let w = this.gameElement.parentElement.clientWidth;
        let h = this.gameElement.parentElement.clientHeight;
        if (w / h > ratio) {
            w = h * ratio;
        } else if (w / h < ratio) {
            h = w / ratio;
        }
        this.gameElement.style.width = w + "px";
        this.gameElement.style.height = h + "px";
        this.gameElement.style.fontSize = (16 * w / 600) + "px";
        this.cachedGameRect = this.gameElement.getBoundingClientRect();
        this.goto(this.currentSlide);
    }

    createElementPointsArray(element) {
        return [
            [parseFloat(element.dataset.x1), parseFloat(element.dataset.y1)],
            [parseFloat(element.dataset.x2), parseFloat(element.dataset.y2)],
            [parseFloat(element.dataset.x3), parseFloat(element.dataset.y3)],
            [parseFloat(element.dataset.x4), parseFloat(element.dataset.y4)]
        ]
    }

    updateTransform(element, points) {
        points = points || this.createElementPointsArray(element);
        transform2d(
            element,
            points[0][0] * this.cachedGameRect.width / 100,
            points[0][1] * this.cachedGameRect.height / 100,
            points[1][0] * this.cachedGameRect.width / 100,
            points[1][1] * this.cachedGameRect.height / 100,
            points[3][0] * this.cachedGameRect.width / 100,
            points[3][1] * this.cachedGameRect.height / 100,
            points[2][0] * this.cachedGameRect.width / 100,
            points[2][1] * this.cachedGameRect.height / 100,
        );
        if (!isEditor) {
            const svgs = element.querySelectorAll("svg");
            if (svgs.length > 0) {
                element.style.transform = "";
                for (let svg of svgs) {
                    svg.style.display = "none";
                    svg.offsetHeight;
                    svg.style.display = "";
                }
                const cover = document.createElement("div");
                cover.className = "fh-svgload-cover";
                element.after(cover);

                var search = cover;
                var computedBackgroundColor = getComputedStyle(search).backgroundColor;
                while (computedBackgroundColor === 'rgba(0, 0, 0, 0)' || computedBackgroundColor === 'transparent') {
                    search = search.parentElement;
                    if (!search) {
                        computedBackgroundColor = "white";
                        break;
                    }
                    computedBackgroundColor = getComputedStyle(search).backgroundColor;
                }
                var rgba = [255, 255, 255, 1];
                if (computedBackgroundColor.indexOf("rgba(") === 0)
                    rgba = computedBackgroundColor.slice(5, -1).split(",");
                else if (computedBackgroundColor.indexOf("rgb(") === 0)
                    rgba = [...computedBackgroundColor.slice(4, -1).split(","), 1];
                cover.style.backgroundColor = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, 1)`;

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        transform2d(
                            element,
                            points[0][0] * this.cachedGameRect.width / 100,
                            points[0][1] * this.cachedGameRect.height / 100,
                            points[1][0] * this.cachedGameRect.width / 100,
                            points[1][1] * this.cachedGameRect.height / 100,
                            points[3][0] * this.cachedGameRect.width / 100,
                            points[3][1] * this.cachedGameRect.height / 100,
                            points[2][0] * this.cachedGameRect.width / 100,
                            points[2][1] * this.cachedGameRect.height / 100,
                        );
                        cover.remove();
                    })
                })
            }
        }
    }

    findElementClickzone(element) {
        return element.parentElement.querySelector(`.fh-clickzone[name="${element.getAttribute("name")}"]`);
    }

    getElementAtPath(path) {
        if (path.length > 0 && path[path.length - 1] === "/") {
            path = path.substring(0, path.length - 1);
        }
        var originalSlide = this.currentSlide;
        var element = this.currentSlide;
        var ignoreSpecialParts = false;
        for (let part of path.split("/")) {
            switch (part) {
                case ".":
                    if (!ignoreSpecialParts) {
                        break;
                    }
                case "..":
                    if (!ignoreSpecialParts) {
                        if (element === this.gameElement) {
                            console.error(`could not reach path "${path}" from ${this.getPath()}. returning original slide.`);
                            return originalSlide;
                        } else {
                            element = element.parentElement;
                        }
                        break;
                    }
                case "":
                    if (!ignoreSpecialParts) {
                        element = this.gameElement;
                        break;
                    }
                default:
                    var ignoreSpecialParts = true;
                    var partFound = false;
                    for (let child of element.children) {
                        if (child.getAttribute("name") === part) {
                            element = child;
                            partFound = true;
                            break;
                        }
                    }
                    if (!partFound) {
                        console.error(`could not reach path "${path}" from ${this.getPath()}. returning original slide.`);
                        return originalSlide;
                    }
                    break;
            }
        }
        return element;
    }

    getPath(element) {
        if (!element) element = this.currentSlide;
        var path = "";
        while (element !== this.gameElement) {
            path = element.getAttribute("name") + "/" + path;
            element = element.parentElement;
            if (!element) {
                return "/";
            }
        }
        if (path.length > 0) {
            path = path.substring(0, path.length - 1);
        }
        return "/" + path;
    }

    exitSlide(slide) {
        if (slide.dataset.onexit)
            this.runScript(slide.dataset.onexit, slide);
        for (const element of slide.children) {
            if (!element.classList.contains("fh-element")) continue;
            for (let source of element.querySelectorAll("[src]")) {
                const src = source.getAttribute("src");
                if (src.trim() !== "") {
                    source.setAttribute("data-src", src);
                    source.setAttribute("src", "");
                }
            }
            for (let media of element.querySelectorAll("audio, video")) {
                media.pause();
            }
        }
    }

    enterSlide(slide) {
        if (slide.dataset.onenter)
            this.runScript(slide.dataset.onenter, slide);
        for (let element of slide.children) {
            if (!element.classList.contains("hidden") && element.classList.contains("fh-element")) {
                if (element.dataset.onshow)
                    this.runScript(element.dataset.onshow, element);
                for (let source of element.querySelectorAll("[data-src]")) {
                    const src = source.getAttribute("data-src");
                    if (src.trim() !== "")
                        source.setAttribute("src", src);
                }
                for (let media of element.querySelectorAll("audio[autoplay], video[autoplay]")) {
                    media.play();
                }
            }
        }
    }

    goto(path) {
        for (let slide of this.gameElement.querySelectorAll(".fh-slide.open")) {
            slide.classList.remove("open");
        }

        if (!this.currentSlide) {
            this.currentSlide = this.gameElement;
            for (let element of this.gameElement.querySelectorAll("[src]")) {
                const src = element.getAttribute("src");
                if (src.trim() !== "") {
                    element.setAttribute("data-src", src);
                    element.setAttribute("src", "");
                }
            }
            for (let media of this.gameElement.querySelectorAll("audio, video")) {
                media.pause();
            }
        }

        const previousSlide = this.currentSlide;
        this.currentSlide = typeof path === "string" ? this.getElementAtPath(path) : path;

        for (let open of document.querySelectorAll(".open"))
            open.classList.remove("open");

        var slide = this.currentSlide;
        while (slide !== this.gameElement) {
            slide.classList.add("open");
            slide = slide.parentElement;
        }

        if (previousSlide !== this.currentSlide) {
            var slidesExited = [];
            var slidesEntered = [];

            var s = previousSlide;
            while (s !== this.gameElement) {
                slidesExited.push(s);
                s = s.parentElement;
            }
            s = this.currentSlide;
            while (s !== this.gameElement) {
                slidesEntered.unshift(s);
                s = s.parentElement;
            }

            while (slidesExited[slidesExited.length - 1] === slidesEntered[0]) {
                slidesExited.pop();
                slidesEntered.shift();
            }

            for (let s of slidesExited) {
                this.exitSlide(s);
            }
            for (let s of slidesEntered) {
                this.enterSlide(s);
            }
        }

        if (this.cachedGameRect) {
            for (let element of document.querySelectorAll(".fh-slide.open > .fh-element")) {
                this.updateTransform(element);
            }
        }
    }

    show(...paths) {
        for (let path of paths) {
            const element = this.getElementAtPath(path);
            const clickzone = this.findElementClickzone(element);
            element.classList.remove("hidden");
            if (clickzone) clickzone.classList.remove("hidden");
            this.updateTransform(element);
            if (element.dataset.onshow) {
                this.runScript(element.dataset.onshow, element);
            }
            for (let source of element.querySelectorAll("[data-src]")) {
                const src = source.getAttribute("data-src");
                if (src.trim() !== "")
                    source.setAttribute("src", src);
            }
            for (let media of element.querySelectorAll("audio[autoplay], video[autoplay]")) {
                media.play();
            }
        }
    }

    hide(...paths) {
        for (let path of paths) {
            const element = this.getElementAtPath(path);
            const clickzone = this.findElementClickzone(element);
            element.classList.add("hidden");
            if (clickzone) clickzone.classList.add("hidden");
            for (let source of element.querySelectorAll("[src]")) {
                const src = source.getAttribute("src");
                if (src.trim() !== "") {
                    source.setAttribute("data-src", src);
                    source.setAttribute("src", "");
                }
            }
            for (let media of element.querySelectorAll("audio, video")) {
                media.pause();
            }
        }
    }

    async seconds(seconds) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, seconds * 1000);
        })
    }

    async s(seconds) {
        await this.seconds(seconds);
    }

    async click() {
        return new Promise(resolve => {
            var clickListener = () => {
                resolve();
                document.removeEventListener("mouseup", clickListener);
                document.removeEventListener("keydown", keyListener);
            }
            var keyListener = (e) => {
                if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)
                    return;
                if (e.key === " ") {
                    resolve();
                    document.removeEventListener("mouseup", clickListener);
                    document.removeEventListener("keydown", keyListener);
                }
            }
            document.addEventListener("mouseup", clickListener);
            document.addEventListener("keydown", keyListener);
        })
    }
}

export { Game };