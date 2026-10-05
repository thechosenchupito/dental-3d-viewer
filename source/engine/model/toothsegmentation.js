import { Coord3D, CrossVector3D, DotVector3D, SubCoord3D } from '../geometry/coord3d.js';
import { Mesh } from './mesh.js';
import { Triangle } from './triangle.js';
import { GetWeldedMesh } from './weldedmesh.js';

export class ToothSegmentationOptions
{
    constructor ()
    {
        // vertices more concave than this (normalized by the mean edge length) are treated as separation grooves
        this.concavityThreshold = 0.1;
        // number of smoothing passes applied to the concavity values to suppress scan noise
        this.smoothingIterations = 3;
        // regions smaller than this fraction of the vertices are merged into the neighboring region
        this.minRelativeSize = 0.01;
    }
}

function GetVertexNormals (vertices, triangles)
{
    let normals = vertices.map (() => new Coord3D (0.0, 0.0, 0.0));
    for (let triangle of triangles) {
        let v0 = vertices[triangle[0]];
        let v1 = vertices[triangle[1]];
        let v2 = vertices[triangle[2]];
        let faceNormal = CrossVector3D (SubCoord3D (v1, v0), SubCoord3D (v2, v0));
        for (let index of triangle) {
            normals[index].x += faceNormal.x;
            normals[index].y += faceNormal.y;
            normals[index].z += faceNormal.z;
        }
    }
    for (let normal of normals) {
        normal.Normalize ();
    }
    return normals;
}

// Positive values mean concave (neighbors lie on the outer side of the surface).
function GetConcavity (vertices, neighbors, triangles, smoothingIterations)
{
    let normals = GetVertexNormals (vertices, triangles);
    let edgeLengthSum = 0.0;
    let edgeCount = 0;
    let concavity = new Array (vertices.length).fill (0.0);
    for (let i = 0; i < vertices.length; i++) {
        let center = new Coord3D (0.0, 0.0, 0.0);
        for (let neighborIndex of neighbors[i]) {
            let neighbor = vertices[neighborIndex];
            center.x += neighbor.x;
            center.y += neighbor.y;
            center.z += neighbor.z;
            edgeLengthSum += SubCoord3D (neighbor, vertices[i]).Length ();
            edgeCount++;
        }
        let count = neighbors[i].size;
        if (count > 0) {
            center.MultiplyScalar (1.0 / count);
            concavity[i] = DotVector3D (SubCoord3D (center, vertices[i]), normals[i]);
        }
    }

    let meanEdgeLength = edgeCount > 0 ? edgeLengthSum / edgeCount : 1.0;
    for (let i = 0; i < concavity.length; i++) {
        concavity[i] /= meanEdgeLength;
    }

    for (let iteration = 0; iteration < smoothingIterations; iteration++) {
        let smoothed = concavity.slice ();
        for (let i = 0; i < concavity.length; i++) {
            let sum = concavity[i];
            for (let neighborIndex of neighbors[i]) {
                sum += concavity[neighborIndex];
            }
            smoothed[i] = sum / (neighbors[i].size + 1);
        }
        concavity = smoothed;
    }
    return concavity;
}

function GetConnectedRegions (candidate, neighbors)
{
    let labels = new Array (candidate.length).fill (-1);
    let regions = [];
    for (let start = 0; start < candidate.length; start++) {
        if (!candidate[start] || labels[start] !== -1) {
            continue;
        }
        let label = regions.length;
        let region = [start];
        labels[start] = label;
        for (let i = 0; i < region.length; i++) {
            for (let neighborIndex of neighbors[region[i]]) {
                if (candidate[neighborIndex] && labels[neighborIndex] === -1) {
                    labels[neighborIndex] = label;
                    region.push (neighborIndex);
                }
            }
        }
        regions.push (region);
    }
    return { labels, regions };
}

// Grows the labeled regions over the unlabeled vertices (breadth first, so each vertex joins the nearest region).
function GrowLabels (labels, seeds, neighbors)
{
    let queue = seeds.slice ();
    for (let i = 0; i < queue.length; i++) {
        let label = labels[queue[i]];
        for (let neighborIndex of neighbors[queue[i]]) {
            if (labels[neighborIndex] === -1) {
                labels[neighborIndex] = label;
                queue.push (neighborIndex);
            }
        }
    }
}

// Splits a dentition mesh into one mesh per tooth. The teeth are the convex regions that remain once the
// concave grooves between teeth (and between teeth and gum) are removed. Meshes are sorted by triangle count.
// Gum or other large non-tooth regions can be returned as well: filter them with the caller's own criteria.
export function SegmentTeeth (object3D, options)
{
    let opts = new ToothSegmentationOptions ();
    if (options) {
        Object.assign (opts, options);
    }

    let { vertices, neighbors, triangles } = GetWeldedMesh (object3D);
    if (vertices.length === 0) {
        return [];
    }

    let concavity = GetConcavity (vertices, neighbors, triangles, opts.smoothingIterations);
    let isConvex = concavity.map ((value) => value <= opts.concavityThreshold);
    let { labels, regions } = GetConnectedRegions (isConvex, neighbors);

    let minSize = Math.max (1, Math.floor (opts.minRelativeSize * vertices.length));
    let seeds = [];
    let keptCount = 0;
    let remap = new Map ();
    for (let label = 0; label < regions.length; label++) {
        if (regions[label].length >= minSize) {
            remap.set (label, keptCount++);
            seeds.push (...regions[label]);
        }
    }

    let finalLabels = labels.map ((label) => (remap.has (label) ? remap.get (label) : -1));
    GrowLabels (finalLabels, seeds, neighbors);

    // parts of the mesh not connected to any kept region
    for (let start = 0; start < finalLabels.length; start++) {
        if (finalLabels[start] === -1) {
            finalLabels[start] = keptCount++;
            GrowLabels (finalLabels, [start], neighbors);
        }
    }

    let segments = [];
    for (let i = 0; i < keptCount; i++) {
        segments.push ({ mesh : new Mesh (), vertexMap : new Map () });
    }

    for (let triangle of triangles) {
        let triangleLabels = triangle.map ((index) => finalLabels[index]);
        let label = triangleLabels[0];
        if (triangleLabels[1] === triangleLabels[2]) {
            label = triangleLabels[1];
        }

        let segment = segments[label];
        let newIndices = triangle.map ((index) => {
            if (!segment.vertexMap.has (index)) {
                let vertex = vertices[index];
                segment.vertexMap.set (index, segment.mesh.AddVertex (vertex.Clone ()));
            }
            return segment.vertexMap.get (index);
        });
        segment.mesh.AddTriangle (new Triangle (newIndices[0], newIndices[1], newIndices[2]));
    }

    let meshes = segments.map ((segment) => segment.mesh).filter ((mesh) => mesh.TriangleCount () > 0);
    meshes.sort ((a, b) => b.TriangleCount () - a.TriangleCount ());
    return meshes;
}
