import { DragHandler } from '../utils/dragdrop.js';
import { get, set } from '../lib/idb-keyval.js';
import { save } from '../utils/history.js';
import { editMode, switchMode, game } from '../editor.js';
import { createElement, deleteElement, updateElementPoints } from '../managers/element.js';

// tooltip

const doodleSettings = {
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
    text.value = doodleSettings[setting];
    picker.value = standardize_color(doodleSettings[setting]);
    text.oninput = function () {
        var value = this.value.trim() === "" ? "none" : this.value;
        set(setting, value); doodleSettings[setting] = value;
        picker.value = standardize_color(value);
    }
    text.onchange = function () {
        this.value = this.value.trim() === "" ? "none" : this.value;
    }
    picker.oninput = function () {
        set(setting, this.value); doodleSettings[setting] = this.value;
        text.value = this.value;
    };
}

fh_doodle_tooltip.querySelector("[name=stroke-width]").value = doodleSettings.strokeWidth;
fh_doodle_tooltip.querySelector("[name=stroke-width]").oninput = function () {
    set('stroke-width', Math.max(this.value, 1));
    doodleSettings.strokeWidth = Math.max(this.value, 1);
};
fh_doodle_tooltip.querySelector("[name=stroke-width]").onchange = function () {
    if (this.value < 1) this.value = 1;
};

fh_doodle_mode.onclick = () => {
    var hidden = fh_doodle_tooltip.classList.contains("hidden");
    switchMode("doodle");
    if (hidden)
        fh_doodle_tooltip.classList.remove("hidden");
}

// doodle

const padding = 5;
var canvasRect;
var element;
var svg;
var path;
var pathPoints;

const doodleDragHandler = new DragHandler({
    onmousedown: e => {
        if (editMode !== "doodle") return;
        fh_doodle_tooltip.classList.add("hidden");

        const rect = game.cachedGameRect;
        canvasRect = [e.pageX - rect.left, e.pageY - rect.top, 0, 0];
        element = createElement(
            canvasRect[0] / rect.width * 100,
            canvasRect[1] / rect.height * 100,
            1, 1,
            `<svg width="0" height="0" viewBox="0 0 0 0"><path fill="${doodleSettings.fill}" stroke="${doodleSettings.stroke}" stroke-width="${doodleSettings.strokeWidth}" d="" /></svg>`
        )
        svg = element.querySelector("svg");
        path = svg.firstElementChild;
        pathPoints = [[0, 0]];
    },
    ondrag: (e) => {
        if (editMode !== "doodle") return;
        const rect = game.cachedGameRect;
        const min = [
            Math.min(canvasRect[0], (e.pageX - rect.left)),
            Math.min(canvasRect[1], (e.pageY - rect.top))
        ]
        const max = [
            Math.max(canvasRect[0] + canvasRect[2], (e.pageX - rect.left)),
            Math.max(canvasRect[1] + canvasRect[3], (e.pageY - rect.top))
        ]
        const offset = [
            min[0] - canvasRect[0],
            min[1] - canvasRect[1]
        ]
        updateElementPoints(element, [
            [(min[0] - padding) / rect.width * 100, (min[1] - padding) / rect.height * 100],
            [(max[0] + padding) / rect.width * 100, (min[1] - padding) / rect.height * 100],
            [(max[0] + padding) / rect.width * 100, (max[1] + padding) / rect.height * 100],
            [(min[0] - padding) / rect.width * 100, (max[1] + padding) / rect.height * 100]
        ]);
        canvasRect = [min[0], min[1], (max[0] - min[0]), (max[1] - min[1])];

        svg.setAttribute("width", canvasRect[2] + padding * 2);
        svg.setAttribute("height", canvasRect[3] + padding * 2);
        svg.setAttribute("viewBox", `0 0 ${canvasRect[2] + padding * 2} ${canvasRect[3] + padding * 2}`)

        for (let point of pathPoints) {
            point[0] -= offset[0];
            point[1] -= offset[1];
        }
        pathPoints.push([e.pageX - canvasRect[0] - rect.left, e.pageY - canvasRect[1] - rect.top]);
        var d = "";
        for (let i = 0; i < pathPoints.length; i++) {
            d += i > 0 ? "L" : "M";
            d += `${pathPoints[i][0] + padding} ${pathPoints[i][1] + padding} `;
        }
        path.setAttribute("d", d);
    },
    ondragend: () => {
        if (editMode !== "doodle") return;
        if (canvasRect[2] === 0 && canvasRect[3] === 0) {
            deleteElement(element);
            return;
        }
        const rect = game.cachedGameRect;
        updateElementPoints(element, [
            [(canvasRect[0] - padding) / rect.width * 100, (canvasRect[1] - padding) / rect.height * 100],
            [(canvasRect[2] + canvasRect[0] + padding) / rect.width * 100, (canvasRect[1] - padding) / rect.height * 100],
            [(canvasRect[2] + canvasRect[0] + padding) / rect.width * 100, (canvasRect[3] + canvasRect[1] + padding) / rect.height * 100],
            [(canvasRect[0] - padding) / rect.width * 100, (canvasRect[3] + canvasRect[1] + padding) / rect.height * 100]
        ]);
        save();
    },
    threshold: 0
})

export { doodleSettings, doodleDragHandler };