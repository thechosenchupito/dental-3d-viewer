import { Coord3D, CoordDistance3D, DotVector3D } from '../geometry/coord3d.js';
import { GetWeldedMesh } from './weldedmesh.js';

export class Cusp
{
    constructor (position, height, prominence)
    {
        this.position = position;
        this.height = height;
        this.prominence = prominence;
    }
}

export class CuspDetectionOptions
{
    constructor ()
    {
        // occlusal direction, pointing from the root to the chewing surface
        this.upDirection = new Coord3D (0.0, 0.0, 1.0);
        // minimum drop (relative to the model extent along the up direction) separating two cusps
        this.minRelativeProminence = 0.01;
        // minimum distance between two cusps (relative to the bounding box diagonal)
        this.minRelativeDistance = 0.05;
        // cusps must be in the top part of the model along the up direction (0 accepts all, 0.5 the upper half)
        this.minRelativeHeight = 0.0;
        // maximum number of returned cusps, null for no limit
        this.maxCount = null;
    }
}

function FindRoot (parents, index)
{
    while (parents[index] !== index) {
        parents[index] = parents[parents[index]];
        index = parents[index];
    }
    return index;
}

// Local maxima along the up direction, ranked by topological persistence
// (the height drop needed to reach a higher peak). Noise bumps have a low prominence.
export function DetectCusps (object3D, options)
{
    let opts = new CuspDetectionOptions ();
    if (options) {
        Object.assign (opts, options);
    }

    let up = opts.upDirection.Clone ().Normalize ();
    if (up.Length () === 0.0) {
        return [];
    }

    let { boundingBox, vertices, neighbors } = GetWeldedMesh (object3D);
    if (vertices.length === 0) {
        return [];
    }

    let heights = vertices.map ((vertex) => DotVector3D (vertex, up));
    let minHeight = heights.reduce ((a, b) => Math.min (a, b), Infinity);
    let maxHeight = heights.reduce ((a, b) => Math.max (a, b), -Infinity);
    let extent = maxHeight - minHeight;
    if (extent <= 0.0) {
        return [];
    }

    // vertices are visited from the highest to the lowest (union-find over the already visited ones)
    let order = vertices.map ((_, index) => index);
    order.sort ((a, b) => heights[b] - heights[a] || a - b);

    let parents = vertices.map ((_, index) => index);
    let processed = new Array (vertices.length).fill (false);
    let peakOfRoot = new Map ();
    let prominences = new Map ();

    for (let vertexIndex of order) {
        processed[vertexIndex] = true;
        let roots = new Set ();
        for (let neighborIndex of neighbors[vertexIndex]) {
            if (processed[neighborIndex]) {
                roots.add (FindRoot (parents, neighborIndex));
            }
        }

        // no visited neighbor: a new local maximum is born (the global one keeps an infinite prominence)
        if (roots.size === 0) {
            peakOfRoot.set (vertexIndex, vertexIndex);
            prominences.set (vertexIndex, Infinity);
            continue;
        }

        let sortedRoots = Array.from (roots).sort ((a, b) => {
            return heights[peakOfRoot.get (b)] - heights[peakOfRoot.get (a)] || a - b;
        });
        // when peaks merge, the lowest ones die: their prominence is the drop from the peak to the merge height
        let mainRoot = sortedRoots[0];
        parents[vertexIndex] = mainRoot;
        for (let i = 1; i < sortedRoots.length; i++) {
            let root = sortedRoots[i];
            let peakIndex = peakOfRoot.get (root);
            prominences.set (peakIndex, heights[peakIndex] - heights[vertexIndex]);
            parents[root] = mainRoot;
        }
    }

    // keep prominent peaks in the allowed height range, strongest first
    let minProminence = opts.minRelativeProminence * extent;
    let candidates = [];
    for (let [peakIndex, prominence] of prominences) {
        if (prominence >= minProminence && heights[peakIndex] >= minHeight + opts.minRelativeHeight * extent) {
            candidates.push (new Cusp (vertices[peakIndex].Clone (), heights[peakIndex], prominence));
        }
    }
    candidates.sort ((a, b) => b.prominence - a.prominence || b.height - a.height);

    let minDistance = opts.minRelativeDistance * CoordDistance3D (boundingBox.GetMin (), boundingBox.GetMax ());
    // greedy non-maximum suppression: drop candidates too close to an already accepted cusp
    let cusps = [];
    for (let candidate of candidates) {
        let isFarEnough = cusps.every ((cusp) => {
            return CoordDistance3D (cusp.position, candidate.position) >= minDistance;
        });
        if (isFarEnough) {
            cusps.push (candidate);
        }
    }

    if (opts.maxCount !== null && opts.maxCount !== undefined) {
        cusps = cusps.slice (0, opts.maxCount);
    }
    return cusps;
}
