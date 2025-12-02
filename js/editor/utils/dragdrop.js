export class DragHandler {
    constructor(options) {
        this.ondragstart = options.ondragstart;
        this.ondrag = options.ondrag;
        this.ondragend = options.ondragend;
        this.threshold = options.threshold || 3;
    }

    attach(element) {
        element.addEventListener("mousedown", e => {
            const mousedownPosition = [e.pageX, e.pageY];
            const mousemoveEvent = (e) => {
                if (
                    Math.abs(mousedownPosition[0] - e.pageX) + Math.abs(mousedownPosition[1] - e.pageY) <= this.threshold
                ) {
                    return;
                }
                mouseupEvent();
                e.mousedownPosition = mousedownPosition;
                if (this.ondragstart) this.ondragstart(e);
                const muEvent = (e) => {
                    this.ondragend(e);
                    if (this.ondrag) document.removeEventListener("mousemove", this.ondrag);
                    document.removeEventListener("mouseup", muEvent);
                }
                if (this.ondrag) document.addEventListener("mousemove", this.ondrag);
                document.addEventListener("mouseup", muEvent);
            }
            const mouseupEvent = () => {
                document.removeEventListener("mousemove", mousemoveEvent);
                document.removeEventListener("mouseup", mouseupEvent);
            }
            document.addEventListener("mousemove", mousemoveEvent);
            document.addEventListener("mouseup", mouseupEvent);
        })
    }
}