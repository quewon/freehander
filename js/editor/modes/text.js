import { DragHandler } from '../utils/dragdrop.js';
import { game, editMode, switchMode, editorOverlay } from '../editor.js';
import { openElements, deselectElement, selectElement, openElementInspector, updateElementPoints, setElementHTML, createElement, deleteElement, updateSelectionHandles } from '../managers/element.js';

fh_text_mode.onclick = () => switchMode("text");

const box = fh_text_box;
box.remove();

const textDragHandler = new DragHandler({
    onmousedown: (e) => {
        if (editMode !== "text") return;
        for (let name in openElements) {
            if (openElements[name].clickzone.classList.contains("selected"))
                deselectElement(openElements[name].element);
        }
        const rect = game.cachedGameRect;
        box.style.left = (e.pageX - rect.left) / rect.width * 100 + "%";
        box.style.top = (e.pageY - rect.top) / rect.height * 100 + "%";
        box.style.width = "";
        box.style.height = "";
        editorOverlay.appendChild(box);
    },
    ondrag: (e) => {
        if (editMode !== "text") return;
        const rect = game.cachedGameRect;
        var min = [
            (Math.min(e.mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100,
            (Math.min(e.mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100
        ];
        var max = [
            (Math.max(e.mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100,
            (Math.max(e.mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100,
        ];
        box.style.left = min[0] + "%";
        box.style.top = min[1] + "%";
        box.style.width = (max[0] - min[0]) + "%";
        box.style.height = (max[1] - min[1]) + "%";
    },
    ondragend: (e) => {
        if (editMode !== "text") return;
        const rect = game.cachedGameRect;
        var x, y, w, h;
        var sizeSet = false;
        if (Math.abs(e.mousedownPosition[0] - e.pageX) + Math.abs(e.mousedownPosition[1] - e.pageY) > 3) {
            x = parseFloat(box.style.left);
            y = parseFloat(box.style.top);
            w = parseFloat(box.style.width);
            h = parseFloat(box.style.height);
            sizeSet = true;
        } else {
            x = (e.mousedownPosition[0] - rect.left) / rect.width * 100;
            y = (e.mousedownPosition[1] - rect.top) / rect.height * 100;
        }
        const element = createElement(x, y, w, h);
        if (!sizeSet) element.dataset.fithtml = "true";
        box.remove();
        selectElement(element);

        openElementInspector(element);
        var htmlInput = fh_element_inspector.querySelector("[name=html]");
        htmlInput.style.borderColor = "";
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
    },
    threshold: 0
});

export { textDragHandler };