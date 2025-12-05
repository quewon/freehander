import { DragHandler } from '../utils/dragdrop.js';
import { deleteElement, openElementInspector, renameElement, selectElement } from './element.js';
import { game } from '../editor.js';
import { save } from '../utils/history.js';

const slidesContainer = document.querySelector(".fh-slides-container");
slidesContainer.onmousedown = () => {
    document.querySelector(":focus")?.blur();
    if (document.querySelector(".fh-editor .focused"))
        document.querySelector(".fh-editor .focused").classList.remove("focused");
    slidesContainer.classList.add("focused");
}
fh_add_slide.onclick = () => addSlide();

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

    var clone;
    var offset;
    var collapsedSlides;
    var originalInset;
    new DragHandler({
        ondragstart: (e) => {
            const rect = container.getBoundingClientRect();
            offset = [
                rect.left - e.mousedownPosition[0],
                rect.top - e.mousedownPosition[1]
            ]
            clone = container.cloneNode(true);
            clone.style.position = "absolute";
            clone.style.width = rect.width + "px";
            clone.style.height = rect.height + "px";
            clone.style.background = "none";
            clone.querySelector("label").remove();
            document.querySelector(".fh-editor").appendChild(clone);
            container.classList.add("dragging");

            originalInset = parseInt(container.dataset.inset);
            collapsedSlides = [];
            if (container.classList.contains("collapsed")) {
                var collapsed = container.nextElementSibling;
                while (collapsed && parseInt(collapsed.dataset.inset) > originalInset) {
                    collapsedSlides.push(collapsed);
                    collapsed = collapsed.nextElementSibling;
                }
            }
        },
        ondrag: (e) => {
            clone.style.left = (offset[0] + e.pageX) + "px";
            clone.style.top = (offset[1] + e.pageY) + "px";
            for (let slide of slidesContainer.children) {
                if (slide === container) continue;
                const rect = slide.getBoundingClientRect();
                if (e.pageY > rect.top && e.pageY < rect.bottom) {
                    var ratio = 1 / 2;
                    if (slide === slidesContainer.firstElementChild)
                        ratio = 4 / 5;
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
        },
        ondragend: () => {
            for (let collapsed of collapsedSlides) {
                collapsed.dataset.inset = parseInt(collapsed.dataset.inset) - originalInset + parseInt(container.dataset.inset);
            }
            container.after(...collapsedSlides);
            reorderPreviews();
            clone.remove();
            container.classList.remove("dragging");
            if (
                game.getPath(slide) !== originalPath ||
                slide.nextElementSibling !== originalNextSibling ||
                slide.previousElementSibling !== originalPreviousSibling
            )
                save();
        }
    }).attach(container);

    container.onmousedown = () => {
        game.goto(container.dataset.path);
        openElementInspector(slide);
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
    updateSlidePreview(game.getElementAtPath(preview.dataset.path));
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
    const previewContainer = findSlidePreview(slide);
    const preview = previewContainer.querySelector(".fh-slide-preview");
    preview.innerHTML = slide.innerHTML;
    for (const slide of preview.querySelectorAll(".fh-slide")) {
        if (previewContainer.classList.contains("collapsed"))
            slide.classList.add("open");
        else
            slide.classList.remove("open");
    }
    for (const element of preview.querySelectorAll(".fh-element")) {
        if (!element.style?.transform || element.style.transform === "")
            game.updateTransform(element);
        for (const iframe of element.querySelectorAll("iframe")) {
            const fake = document.createElement("div");
            fake.className = "fh-fake-iframe";
            fake.style.width = iframe.width + "px";
            fake.style.height = iframe.height + "px";
            iframe.replaceWith(fake);
        }
    }
    for (const media of preview.querySelectorAll("[autoplay]")) {
        media.removeAttribute("autoplay");
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
    for (let preview of [
        ...slidesContainer.querySelectorAll(".selected"),
        ...slidesContainer.children
    ]) {
        const slide = getSlide(preview);
        const inset = parseInt(preview.dataset.inset);
        var parentPreview = getParentPreview(preview);
        var parentSlide;
        if (parentPreview) {
            preview.dataset.inset = parseInt(parentPreview.dataset.inset) + 1;
            parentSlide = getSlide(parentPreview);
        } else {
            preview.dataset.inset = "0";
            var nextPreview = preview.nextElementSibling;
            while (nextPreview && parseInt(nextPreview.dataset.inset) >= inset) {
                nextPreview.dataset.inset = parseInt(nextPreview.dataset.inset) - inset;
                nextPreview = nextPreview.nextElementSibling;
            }
            parentSlide = game.gameElement;
        }
        parentSlide.appendChild(slide);
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
        preview.dataset.path = game.getPath(slide);
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
        for (const slide of game.gameElement.querySelectorAll(".fh-slide.open")) {
            game.exitSlide(slide);
        }
        game.currentSlide = null;
        game.goto(selectedPreview.dataset.path);
    }
}
function clearSlidePreviews() {
    while (slidesContainer.lastElementChild)
        slidesContainer.lastElementChild.remove();
}
function createPreviewsFromElement(element) {
    for (let child of element.children) {
        if (child.classList.contains("fh-slide")) {
            createSlidePreview(child);
            createPreviewsFromElement(child);
        }
    }
}
function deleteSelectedSlides() {
    for (let preview of slidesContainer.querySelectorAll(".fh-slide-preview-container.selected")) {
        deleteElement(game.getElementAtPath(preview.dataset.path));
    }
}

export { slidesContainer, addSlide, findSlidePreview, createSlidePreview, togglePreviewCollapse, getParentPreview, updateSlidePreview, updateSlidePreviewScale, reorderPreviews, clearSlidePreviews, createPreviewsFromElement, deleteSelectedSlides };