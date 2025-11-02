var assetFolderElement;
var supportedImageFormats = ["jpg", "jpeg", "png", "gif"];
var supportedAudioFormats = ["mp3", "wav", "ogg"];

function loadAssetFolder(files, element) {
    assetFolderElement = element;
    clearAssetFolder();
    var structure = getFolderStructure(files);
    var userFolder = createFolderElement(element, Object.keys(structure)[0], structure);
    userFolder.querySelector("details").open = true;
    userFolder.querySelector("summary").focus();
}

function clearAssetFolder() {
    if (assetFolderElement)
        assetFolderElement.innerHTML = "";
    // for (let sprite of allSprites()) {
    //     if (sprite.src && !sprite.src.includes("_preset/")) {
    //         sprite.loaded = false;
    //     }
    // }
}

function getFolderStructure(files) {
    files = [...files];
    const structure = {};
    files.sort((a, b) => {
        const apath = (a.webkitRelativePath || a.path).toLowerCase();
        const bpath = (b.webkitRelativePath || b.path).toLowerCase();
        return apath.localeCompare(bpath)
    });
    for (let file of files) {
        const pathParts = (file.webkitRelativePath || file.path).split('/');
        let current = structure;
        for (let i = 0; i < pathParts.length - 1; i++) {
            const dirName = pathParts[i];
            if (!current[dirName]) {
                current[dirName] = { kind: "directory", children: {} };
            }
            current = current[dirName].children;
        }
        const filename = pathParts[pathParts.length - 1];
        const filenameParts = filename.split(".");
        const ext = filenameParts[filenameParts.length - 1].toLowerCase();
        if (supportedImageFormats.includes(ext)) {
            current[filename] = { 
                kind: "image", 
                path: file.webkitRelativePath || file.path,
                file: file
            };
        } else if (supportedAudioFormats.includes(ext)) {
            current[filename] = { 
                kind: "audio",
                path: file.webkitRelativePath || file.path,
                file: file
            };
        }
    };
    return structure;
}

function createFolderElement(parentElement, directoryName, parent) {
    const list = createElement({ tagName: "ul" });
    for (const name in parent[directoryName].children) {
        if (parent[directoryName].children[name].kind !== "directory")
            continue;
        createFolderElement(list, name, parent[directoryName].children);
    }
    for (const name in parent[directoryName].children) {
        switch (parent[directoryName].children[name].kind) {
            case "image":
                createImageFileElement(list, name, parent[directoryName].children);
                break;
            case "audio":
                createAudioFileElement(list, name, parent[directoryName].children);
                break;
        }
    }
    return createElement({
        tagName: "li",
        className: "folder",
        parent: parentElement,
        children: [
            createElement({
                tagName: "details",
                children: [
                    createElement({
                        tagName: "summary",
                        textContent: directoryName,
                        title: "folder"
                    }),
                    list
                ]
            })
        ]
    })
}

function createAudioFileElement(parentElement, filename, parent) {
    const file = parent[filename].file;
    const el = createElement({
        tagName: "li",
        className: "file",
        parent: parentElement,
        title: "audio file",
        dataset: {
            filepath: parent[filename].path,
            url: URL.createObjectURL(file),
            type: "audio"
        },
        children: [
            createElement({
                tagName: "span",
                className: "icon",
                style: `background-image: url(_preset/music.png)`
            }),
            createElement({
                tagName: "span",
                textContent: filename
            })
        ]
    });
    return el;
}

function createImageFileElement(parentElement, filename, parent) {
    const file = parent[filename].file;
    const url = URL.createObjectURL(file);
    const el = createElement({
        tagName: "li",
        className: "file",
        parent: parentElement,
        title: "image file",
        dataset: {
            filepath: parent[filename].path,
            url: url,
            type: "image"
        },
        children: [
            createElement({
                tagName: "span",
                className: "icon",
                style: `background-image: url(${url})`
            }),
            createElement({
                tagName: "span",
                textContent: filename
            })
        ]
    });
    return el;
}

function createElement(o) {
    var element = document.createElement(o.tagName);
    for (let property in o) {
        if (["parent", "children", "dataset", "tagName", "value"].includes(property))
            continue;
        if (["list"].includes(property)) {
            element.setAttribute(property, o[property]);
        } else {
            element[property] = o[property];
        }
    }
    if (o.children) {
        for (let child of o.children) {
            element.appendChild(child);
        }
    }
    if (o.dataset) {
        for (let data in o.dataset) {
            element.dataset[data] = o.dataset[data];
        }
    }
    if (o.value)
        element.value = o.value;
    if (o.parent)
        o.parent.appendChild(element);
    return element;
}

export { loadAssetFolder };