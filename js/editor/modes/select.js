import { DragHandler } from '../utils/dragdrop.js';
import { game, switchMode, editMode, editorOverlay } from '../editor.js';
import { openElements, selectElement, deselectElement, createElementPointsArray, getElementMinMax } from '../managers/element.js';

fh_select_mode.onclick = () => switchMode("select");

const selectionBox = fh_selection_box;
fh_selection_box.remove();

const selectDragHandler = new DragHandler({
    onmousedown: (e) => {
        selectionBox.style.left = e.pageX + "px";
        selectionBox.style.top = e.pageY + "px";
        selectionBox.style.width = "";
        selectionBox.style.height = "";
    },
    ondragstart: () => {
        if (editMode !== "select") return;
        editorOverlay.appendChild(selectionBox);
    },
    ondrag: (e) => {
        if (editMode !== "select") return;
        const rect = game.cachedGameRect;
        var min = [
            (Math.min(e.mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100,
            (Math.min(e.mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100
        ];
        var max = [
            (Math.max(e.mousedownPosition[0], e.pageX) - rect.left) / rect.width * 100,
            (Math.max(e.mousedownPosition[1], e.pageY) - rect.top) / rect.height * 100,
        ];
        selectionBox.style.left = min[0] + "%";
        selectionBox.style.top = min[1] + "%";
        selectionBox.style.width = (max[0] - min[0]) + "%";
        selectionBox.style.height = (max[1] - min[1]) + "%";

        for (let name in openElements) {
            const data = openElements[name];
            const mm = getElementMinMax(data.element);
            if (
                min[0] < mm.max[0] &&
                max[0] > mm.min[0] &&
                min[1] < mm.max[1] &&
                max[1] > mm.min[1]
            ) {
                if (!data.clickzone.classList.contains("selected"))
                    selectElement(data.element);
            } else {
                if (data.clickzone.classList.contains("selected"))
                    deselectElement(data.element);
            }
        }
    },
    ondragend: () => {
        selectionBox.remove();
    }
})

export { selectDragHandler };