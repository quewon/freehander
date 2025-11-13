const supportedMediaFormats = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "audio/mpeg",
    "audio/x-m4a",
    "audio/wav",
    "audio/ogg",
    "audio/aiff",
    "video/mp4",
    "video/webm",
]
const formatConverter = {
    // "video/quicktime": "video/mp4",
}

var assetFolderElement;

function loadAssetFolder(files, element) {
    assetFolderElement = element;
    assetFolderElement.innerHTML = "";
    var structure = getFolderStructure(files);
    var userFolder = createFolderElement(element, Object.keys(structure)[0], structure);
    userFolder.querySelector("details").open = true;
    userFolder.querySelector("summary").focus();
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

        const kind = file.type.split("/")[0];
        if (supportedMediaFormats.includes(file.type) || kind === "text") {
            current[file.name] = {
                kind: "file",
                type: kind,
                format: kind === "text" ? "text/plain" : file.type,
                path: file.webkitRelativePath || file.path,
                file: file
            }
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
        if (parent[directoryName].children[name].kind === "file") {
            createFileElement(list, name, parent[directoryName].children, parent[directoryName].children[name].type, parent[directoryName].children[name].format);
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

function createFileElement(parentElement, filename, parent, type, format) {
    const file = parent[filename].file;
    var url;
    if (type === "text") {
        var reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = function (e) {
            el.appendChild(
                createElement({
                    tagName: "div",
                    name: "text",
                    style: "display: none",
                    textContent: e.target.result
                })
            )
        }
    } else {
        url = URL.createObjectURL(file);
    }
    var previewElement;
    if (type === "image") {
        previewElement = createElement({
            tagName: "span",
            className: "icon",
            style: `background-image: url(${url});`
        })
    }
    const el = createElement({
        tagName: "li",
        className: "file",
        parent: parentElement,
        title: type + " file",
        dataset: {
            filepath: parent[filename].path,
            type: type,
            format: formatConverter[format] || format
        },
        children: [
            previewElement,
            createElement({
                tagName: "span",
                textContent: filename
            }),
        ]
    });
    if (url)
        el.dataset.url = url;
    return el;
}

function createElement(o) {
    var element = document.createElement(o.tagName);
    for (let property in o) {
        if (["parent", "children", "dataset", "tagName", "value"].includes(property))
            continue;
        if (["list", "name"].includes(property)) {
            element.setAttribute(property, o[property]);
        } else {
            element[property] = o[property];
        }
    }
    if (o.children) {
        for (let child of o.children) {
            if (child)
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