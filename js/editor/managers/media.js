import { game, editorInspector, editMode, switchMode } from '../editor.js';
import { createElement, updateElementPoints, selectElement, startSelectionDrag } from './element.js';
import { get, set, del } from '../lib/idb-keyval.js';
import { loadAssetFolder } from "../utils/folder.js";
import { updateSlidePreview, updateSlidePreviewScale, slidesContainer } from './slide.js';

var mediaFolder;

function initMedia() {
    fh_media.onclick = async () => {
        if (!mediaFolder) {
            if ('showDirectoryPicker' in self) {
                var dirHandle = await get('media');
                if (!dirHandle || await dirHandle.requestPermission() !== 'granted') {
                    dirHandle = await window.showDirectoryPicker();
                    await set('media', dirHandle);
                }
                var files = [];
                async function* getFilesRecursively(entry, dirpath) {
                    dirpath = dirpath || "";
                    if (entry.kind === "file") {
                        const file = await entry.getFile();
                        if (file !== null) {
                            file.relativePath = dirpath + entry.name;
                            yield file;
                        }
                    } else if (entry.kind === "directory") {
                        for await (const handle of entry.values()) {
                            yield* getFilesRecursively(handle, dirpath + entry.name + "/");
                        }
                    }
                }
                for await (let file of getFilesRecursively(dirHandle)) {
                    files.push(file);
                }
                createMediaFolder(files);
                openMediaInspector();
            } else {
                fh_media_input.click();
            }
        } else {
            openMediaInspector();
        }
    };
    fh_media_reload_button.onclick = () => {
        mediaFolder = null;
        fh_media.click();
    }
    if ('showDirectoryPicker' in self) {
        fh_media_load_button.onclick = () => {
            mediaFolder = null;
            del('media');
            fh_media.click();
        }
        fh_media_fallback_message.remove();
    } else {
        fh_media_reload_button.innerHTML = "<b>⟳</b><br>(re)load";
        fh_media_load_button.remove();
    }
    fh_media_input.onchange = () => {
        createMediaFolder(fh_media_input.files);
        openMediaInspector();
        fh_media_input.value = "";
    }
}
function createMediaFolder(files) {
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
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
                switchMode();

            const rect = game.cachedGameRect;
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
                html = `<video autoplay loop><source data-filepath="${filepath}" type="${format}"></video>`;
            } else if (type === "audio") {
                html = `<audio autoplay loop controls><source data-filepath="${filepath}" type="${format}"></audio>`;
            } else if (type === "text") {
                html = file.querySelector("[name=text]").textContent;
            }

            const element = createElement(
                (e.pageX - rect.left) / rect.width * 100 - width / 2,
                (e.pageY - rect.top) / rect.height * 100 - height / 2,
                width, height, html
            );

            if (type === "image") {
                element.querySelector("img").onload = () => {
                    game.updateTransform(element);
                }
            } else if (type === "video") {
                const video = element.querySelector("video");
                await new Promise(resolve => {
                    video.onloadedmetadata = () => {
                        const width = video.videoWidth / rect.width * 100;
                        const height = video.videoHeight / rect.height * 100;
                        const x1 = (e.pageX - rect.left) / rect.width * 100 - width / 2;
                        const y1 = (e.pageY - rect.top) / rect.height * 100 - height / 2;
                        const x2 = x1 + width;
                        const y2 = y1 + height;
                        updateElementPoints(element, [
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
                const x1 = (e.pageX - rect.left) / rect.width * 100 - width / 2;
                const y1 = (e.pageY - rect.top) / rect.height * 100 - height / 2;
                const x2 = x1 + width;
                const y2 = y1 + height;
                updateElementPoints(element, [
                    [x1, y1],
                    [x2, y1],
                    [x2, y2],
                    [x1, y2]
                ]);
            }

            selectElement(element);
            startSelectionDrag(e);
        }
    }

    refreshMedia();
}
async function refreshMedia() {
    for (let asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        asset.removeAttribute("src");
    }

    if (!mediaFolder) return;

    for (const asset of game.gameElement.querySelectorAll("[data-filepath]")) {
        const referenceElement = mediaFolder.querySelector(`[data-filepath="${asset.dataset.filepath}"]`);
        if (!referenceElement) {
            console.error(`media asset "${asset.dataset.filepath}" was not found.`);
        } else {
            asset.setAttribute("src", referenceElement.dataset.url);
        }
    }

    game.onresize();
}
function openMediaInspector() {
    for (let inspectors of editorInspector.children)
        inspectors.classList.add("hidden");
    fh_media_inspector.classList.remove("hidden");
    const selectedInspector = document.body.querySelector(".fh-toolbar .inspector_button.selected");
    if (selectedInspector)
        selectedInspector.classList.remove("selected");
    fh_media.classList.add("selected");
    fh_folder_container.innerHTML = "";
    fh_folder_container.appendChild(mediaFolder);
}

export { initMedia, createMediaFolder, refreshMedia, openMediaInspector, mediaFolder }