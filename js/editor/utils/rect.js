function getPointsCenter(points) {
    var c = [0, 0];
    for (let i = 0; i < 4; i++) {
        c[0] += points[i][0];
        c[1] += points[i][1];
    }
    return [
        c[0] / 4,
        c[1] / 4
    ]
}

function getPointsMinMax(points) {
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
    return { min, max };
}

function getPointsTopLeft(points) {
    return getPointsMinMax(points).min;
}

export { getPointsCenter, getPointsMinMax, getPointsTopLeft };