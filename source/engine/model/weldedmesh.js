import { Octree } from '../geometry/octree.js';
import { GetBoundingBox } from './modelutils.js';

// Welds coincident vertices and returns the vertex graph of an object.
export function GetWeldedMesh (object3D)
{
    let boundingBox = GetBoundingBox (object3D);
    let octree = new Octree (boundingBox);
    let vertices = [];
    let neighbors = [];
    let triangles = [];

    function GetIndex (vertex)
    {
        let index = octree.FindPoint (vertex);
        if (index === null) {
            index = vertices.length;
            vertices.push (vertex);
            neighbors.push (new Set ());
            octree.AddPoint (vertex, index);
        }
        return index;
    }

    object3D.EnumerateTriangleVertices ((v0, v1, v2) => {
        let i0 = GetIndex (v0);
        let i1 = GetIndex (v1);
        let i2 = GetIndex (v2);
        neighbors[i0].add (i1).add (i2);
        neighbors[i1].add (i0).add (i2);
        neighbors[i2].add (i0).add (i1);
        triangles.push ([i0, i1, i2]);
    });
    return { boundingBox, vertices, neighbors, triangles };
}
