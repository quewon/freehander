// https://math.stackexchange.com/a/339033

function matrix_adjugate(m) {
    return [
        m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4],
        m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5],
        m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]
    ];
}

function matrix_multm(a, b) { // multiply two matrices
    var c = Array(9);
    for (var i = 0; i != 3; ++i) {
        for (var j = 0; j != 3; ++j) {
            var cij = 0;
            for (var k = 0; k != 3; ++k) {
                cij += a[3*i + k]*b[3*k + j];
            }
            c[3*i + j] = cij;
        }
    }
    return c;
}

function matrix_multv(m, v) { // multiply matrix and vector
    return [
        m[0]*v[0] + m[1]*v[1] + m[2]*v[2],
        m[3]*v[0] + m[4]*v[1] + m[5]*v[2],
        m[6]*v[0] + m[7]*v[1] + m[8]*v[2]
    ];
}

function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
    var m = [
        x1, x2, x3,
        y1, y2, y3,
        1,  1,  1
    ];
    var v = matrix_multv(matrix_adjugate(m), [x4, y4, 1]);
    return matrix_multm(m, [
        v[0], 0, 0,
        0, v[1], 0,
        0, 0, v[2]
    ]);
}

function general2DProjection(
    x1s, y1s, x1d, y1d,
    x2s, y2s, x2d, y2d,
    x3s, y3s, x3d, y3d,
    x4s, y4s, x4d, y4d
) {
    var s = basisToPoints(x1s, y1s, x2s, y2s, x3s, y3s, x4s, y4s);
    var d = basisToPoints(x1d, y1d, x2d, y2d, x3d, y3d, x4d, y4d);
    return matrix_multm(d, matrix_adjugate(s));
}

function transform2d(element, x1, y1, x2, y2, x3, y3, x4, y4) {
    var w = element.clientWidth, h = element.clientHeight;
    var t = general2DProjection(
        0, 0, x1, y1, w, 0, x2, y2, 0, h, x3, y3, w, h, x4, y4
    );
    for (var i = 0; i != 9; ++i)
        t[i] = t[i]/t[8];
    t = [
            t[0], t[3], 0, t[6],
            t[1], t[4], 0, t[7],
            0   , 0   , 1, 0   ,
            t[2], t[5], 0, t[8]
        ];
    t = "matrix3d(" + t.join(", ") + ")";
    element.style["-webkit-transform"] = t;
    element.style["-moz-transform"] = t;
    element.style["-o-transform"] = t;
    element.style.transform = t;
}

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
        for (let element of this.gameElement.querySelectorAll(".fh-element")) {
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
        if (!this.editorOverlay) {
            const svgs = element.querySelectorAll("svg");
            if (svgs.length > 0) {
                element.style.transform = "";
                for (let svg of svgs) {
                    svg.style.display = "none";
                    svg.offsetHeight;
                    svg.style.display = "";
                }
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
        }
        if (path.length > 0) {
            path = path.substring(0, path.length - 1);
        }
        return "/" + path;
    }

    goto(path) {
        for (let slide of this.gameElement.querySelectorAll(".fh-slide.open")) {
            slide.classList.remove("open");
        }

        if (!this.currentSlide) {
            this.currentSlide = this.gameElement;
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
                if (s.dataset.onexit)
                    this.runScript(s.dataset.onexit, s);
                if (!this.editorOverlay) {
                    for (let element of s.children) {
                        if (element.classList.contains("fh-element")) {
                            const media = element.querySelector("[data-autoplay]");
                            if (media) {
                                media.pause();
                            }
                        }
                    }
                }
            }
            for (let s of slidesEntered) {
                if (s.dataset.onenter)
                    this.runScript(s.dataset.onenter, s);
                for (let element of s.children) {
                    if (!element.classList.contains("hidden") && element.classList.contains("fh-element") && element.dataset.onshow) {
                        this.runScript(element.dataset.onshow, element);
                    }
                }
                if (!this.editorOverlay) {
                    for (let element of s.children) {
                        if (element.classList.contains("fh-element")) {
                            const media = element.querySelector("[data-autoplay]");
                            if (media && media.dataset.autoplay.toLowerCase() === "true") {
                                media.play();
                            }
                        }
                    }
                }
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
        }
    }

    hide(...paths) {
        for (let path of paths) {
            const element = this.getElementAtPath(path);
            const clickzone = this.findElementClickzone(element);
            element.classList.add("hidden");
            if (clickzone) clickzone.classList.add("hidden");
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
                document.removeEventListener("click", clickListener);
                document.removeEventListener("keydown", keyListener);
            }
            var keyListener = (e) => {
                if (e.key === " ") {
                    resolve();
                    document.removeEventListener("click", clickListener);
                    document.removeEventListener("keydown", keyListener);
                }
            }
            document.addEventListener("click", clickListener);
            document.addEventListener("keydown", keyListener);
        })
    }
}

export { Game };