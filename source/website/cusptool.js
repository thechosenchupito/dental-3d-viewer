import { DetectCusps } from '../engine/model/cuspdetection.js';
import { SegmentTeeth } from '../engine/model/toothsegmentation.js';
import { GetBoundingBox } from '../engine/model/modelutils.js';
import { GetWeldedMesh } from '../engine/model/weldedmesh.js';
import { Model } from '../engine/model/model.js';
import { Mesh } from '../engine/model/mesh.js';
import { Triangle } from '../engine/model/triangle.js';
import { Coord3D, DotVector3D, CoordDistance3D } from '../engine/geometry/coord3d.js';

import { dentalGridRects, dentalGridWidth, dentalGridHeight } from './dentalgrid.js';

import * as THREE from 'three';

const maxCuspCount = 6;

// Principal axis of the tooth (power iteration on the covariance), oriented like the reference direction.
// Falls back to the reference when the principal axis is far from it (e.g. wide molar crowns).
function GetToothAxis (tooth, reference)
{
    let { vertices } = GetWeldedMesh (tooth);
    if (vertices.length < 3) {
        return reference;
    }
    let center = new Coord3D (0.0, 0.0, 0.0);
    for (let v of vertices) {
        center.x += v.x / vertices.length;
        center.y += v.y / vertices.length;
        center.z += v.z / vertices.length;
    }
    let cov = [0, 0, 0, 0, 0, 0];
    for (let v of vertices) {
        let x = v.x - center.x, y = v.y - center.y, z = v.z - center.z;
        cov[0] += x * x; cov[1] += x * y; cov[2] += x * z;
        cov[3] += y * y; cov[4] += y * z; cov[5] += z * z;
    }
    let axis = reference.Clone ();
    for (let i = 0; i < 30; i++) {
        let next = new Coord3D (
            cov[0] * axis.x + cov[1] * axis.y + cov[2] * axis.z,
            cov[1] * axis.x + cov[3] * axis.y + cov[4] * axis.z,
            cov[2] * axis.x + cov[4] * axis.y + cov[5] * axis.z
        );
        if (next.Length () === 0.0) {
            return reference;
        }
        axis = next.Normalize ();
    }
    let dot = DotVector3D (axis, reference);
    if (Math.abs (dot) < Math.cos (Math.PI / 6.0)) {
        return reference;
    }
    return dot < 0.0 ? new Coord3D (-axis.x, -axis.y, -axis.z) : axis;
}

// Gum, bone and base fragments are much bigger or smaller than the teeth: keep segments with a typical tooth size.
function GetToothLikeSegments (segments)
{
    if (segments.length < 4) {
        return segments;
    }
    let sizes = segments.map ((segment) => {
        let box = GetBoundingBox (segment);
        return CoordDistance3D (box.GetMin (), box.GetMax ());
    });
    let median = Array.from (sizes).sort ((a, b) => a - b)[Math.floor (sizes.length / 2)];
    let sized = segments.filter ((_, index) => sizes[index] >= 0.4 * median && sizes[index] <= 1.8 * median);
    // teeth sit in an arch: drop fragments that are not close to at least two other segments
    let centers = sized.map ((segment) => {
        let box = GetBoundingBox (segment);
        return new Coord3D ((box.GetMin ().x + box.GetMax ().x) / 2.0, (box.GetMin ().y + box.GetMax ().y) / 2.0, (box.GetMin ().z + box.GetMax ().z) / 2.0);
    });
    return sized.filter ((_, index) => {
        let near = centers.filter ((center, other) => other !== index && CoordDistance3D (center, centers[index]) <= 2.0 * median);
        return near.length >= 2;
    });
}

// With both arches visible the lower teeth chew upwards and the upper ones downwards: the arches are split at the
// biggest gap of the tooth heights along the up direction. Returns null when there is a single arch.
function FindArchSplit (teeth, up)
{
    if (teeth.length < 4) {
        return null;
    }
    let heights = teeth.map ((tooth) => {
        let box = GetBoundingBox (tooth);
        let min = box.GetMin ();
        let max = box.GetMax ();
        return DotVector3D (new Coord3D ((min.x + max.x) / 2.0, (min.y + max.y) / 2.0, (min.z + max.z) / 2.0), up);
    });
    let sorted = Array.from (heights).sort ((a, b) => a - b);
    let gap = 0.0;
    let split = 0.0;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > gap) {
            gap = sorted[i] - sorted[i - 1];
            split = (sorted[i] + sorted[i - 1]) / 2.0;
        }
    }
    let sizes = teeth.map ((tooth) => {
        let box = GetBoundingBox (tooth);
        return CoordDistance3D (box.GetMin (), box.GetMax ());
    }).sort ((a, b) => a - b);
    // a single arch has no significant gap: keep the direction chosen by the user
    if (gap < 0.4 * sizes[Math.floor (sizes.length / 2)]) {
        return null;
    }
    return split;
}

// For every tooth returns the occlusal direction: the up vector for the lower arch, its opposite for the upper
// arch (whose teeth chew downwards). With a single arch every tooth gets the up vector.
function GetArchDirections (teeth, up)
{
    let split = FindArchSplit (teeth, up);
    if (split === null) {
        return teeth.map (() => up);
    }
    let flipped = new Coord3D (-up.x, -up.y, -up.z);
    return teeth.map ((tooth) => {
        let box = GetBoundingBox (tooth);
        let min = box.GetMin ();
        let max = box.GetMax ();
        let height = DotVector3D (new Coord3D ((min.x + max.x) / 2.0, (min.y + max.y) / 2.0, (min.z + max.z) / 2.0), up);
        return height > split ? flipped : up;
    });
}

// Converts the viewer up vector to the model space (the displayed object is rotated by the model loader).
export function GetModelUpDirection (viewer, mainObject)
{
    let cameraUp = viewer.GetCamera ().up;
    let up = new THREE.Vector3 (cameraUp.x, cameraUp.y, cameraUp.z);
    up.applyQuaternion (mainObject.quaternion.clone ().invert ());
    return new Coord3D (up.x, up.y, up.z).Normalize ();
}

// Returns a copy of the model where every mesh is divided in an upper and a lower arch mesh, or null when the
// model does not contain two separate arches.
export function SplitModelIntoArches (model, up)
{
    let teeth = GetToothLikeSegments (SegmentTeeth (model));
    let split = FindArchSplit (teeth, up);
    if (split === null) {
        return null;
    }

    let result = new Model ();
    result.SetName (model.GetName ());
    result.SetUnit (model.GetUnit ());
    for (let i = 0; i < model.MaterialCount (); i++) {
        result.AddMaterial (model.GetMaterial (i));
    }

    // index 0 = below the split plane (lower arch), index 1 = above it (upper arch)
    let archNames = ['Lower arch', 'Upper arch'];
    let archMeshes = [new Mesh (), new Mesh ()];
    archMeshes.forEach ((mesh, index) => mesh.SetName (archNames[index]));

    model.EnumerateMeshInstances ((meshInstance) => {
        let mesh = meshInstance.GetTransformedMesh ();
        // old vertex/normal/color/uv index -> index in the new arch mesh, so shared data is copied only once
        let archMaps = [new Map (), new Map ()];
        for (let i = 0; i < mesh.TriangleCount (); i++) {
            let triangle = mesh.GetTriangle (i);
            let centroid = new Coord3D (0.0, 0.0, 0.0);
            for (let index of [triangle.v0, triangle.v1, triangle.v2]) {
                let vertex = mesh.GetVertex (index);
                centroid.x += vertex.x / 3.0;
                centroid.y += vertex.y / 3.0;
                centroid.z += vertex.z / 3.0;
            }
            // a triangle belongs to the arch where its centroid lies
            let arch = DotVector3D (centroid, up) > split ? 1 : 0;
            let target = archMeshes[arch];
            let maps = archMaps[arch];
            let copy = (key, index, add, getter) => {
                if (index === null) {
                    return null;
                }
                let mapKey = key + ':' + index;
                if (!maps.has (mapKey)) {
                    maps.set (mapKey, add.call (target, getter.call (mesh, index).Clone ()));
                }
                return maps.get (mapKey);
            };
            let newTriangle = new Triangle (
                copy ('v', triangle.v0, target.AddVertex, mesh.GetVertex),
                copy ('v', triangle.v1, target.AddVertex, mesh.GetVertex),
                copy ('v', triangle.v2, target.AddVertex, mesh.GetVertex)
            );
            if (triangle.HasVertexColors ()) {
                newTriangle.SetVertexColors (
                    copy ('c', triangle.c0, target.AddVertexColor, mesh.GetVertexColor),
                    copy ('c', triangle.c1, target.AddVertexColor, mesh.GetVertexColor),
                    copy ('c', triangle.c2, target.AddVertexColor, mesh.GetVertexColor)
                );
            }
            if (triangle.HasNormals ()) {
                newTriangle.SetNormals (
                    copy ('n', triangle.n0, target.AddNormal, mesh.GetNormal),
                    copy ('n', triangle.n1, target.AddNormal, mesh.GetNormal),
                    copy ('n', triangle.n2, target.AddNormal, mesh.GetNormal)
                );
            }
            if (triangle.HasTextureUVs ()) {
                newTriangle.SetTextureUVs (
                    copy ('u', triangle.u0, target.AddTextureUV, mesh.GetTextureUV),
                    copy ('u', triangle.u1, target.AddTextureUV, mesh.GetTextureUV),
                    copy ('u', triangle.u2, target.AddTextureUV, mesh.GetTextureUV)
                );
            }
            newTriangle.SetMaterial (triangle.mat);
            newTriangle.SetCurve (triangle.curve);
            target.AddTriangle (newTriangle);
        }
    });

    // an arch without triangles is not added to the model
    for (let mesh of archMeshes) {
        if (mesh.TriangleCount () > 0) {
            result.AddMeshToRootNode (mesh);
        }
    }
    return result;
}

// In the reference picture the arch fills about 81% of the grid width and its front edge sits at about 21% of the
// grid height below the top edge.
const gridArchWidthRatio = 0.81;
const gridFrontOffsetRatio = 0.21;
const gridBarThickness = 2.0;

// Places the grid on the occlusal plane of an arch: x across the arch, y towards the incisors, z along the
// occlusal direction (towards the viewer looking at the chewing surfaces).
function CreateArchGrid (teeth, occlusalDirection)
{
    let normal = new THREE.Vector3 (occlusalDirection.x, occlusalDirection.y, occlusalDirection.z).normalize ();
    let helper = Math.abs (normal.x) < 0.9 ? new THREE.Vector3 (1, 0, 0) : new THREE.Vector3 (0, 1, 0);
    let e1 = new THREE.Vector3 ().crossVectors (normal, helper).normalize ();
    let e2 = new THREE.Vector3 ().crossVectors (normal, e1);

    let centers = [];
    let allVertices = [];
    let toothTops = [];
    for (let tooth of teeth) {
        let { vertices } = GetWeldedMesh (tooth);
        let center = new THREE.Vector3 ();
        let top = -Infinity;
        for (let vertex of vertices) {
            let point = new THREE.Vector3 (vertex.x, vertex.y, vertex.z);
            center.add (point);
            top = Math.max (top, point.dot (normal));
            allVertices.push (point);
        }
        centers.push (center.divideScalar (vertices.length));
        toothTops.push (top);
    }

    // the transverse direction is the main axis of the arch, the sagittal one is perpendicular to it
    let mean = new THREE.Vector2 ();
    let points = centers.map ((center) => new THREE.Vector2 (center.dot (e1), center.dot (e2)));
    points.forEach ((point) => mean.add (point));
    mean.divideScalar (points.length);
    let sxx = 0.0, syy = 0.0, sxy = 0.0;
    for (let point of points) {
        sxx += (point.x - mean.x) ** 2;
        syy += (point.y - mean.y) ** 2;
        sxy += (point.x - mean.x) * (point.y - mean.y);
    }
    let angle = 0.5 * Math.atan2 (2.0 * sxy, sxx - syy);
    let transverse = e1.clone ().multiplyScalar (Math.cos (angle)).addScaledVector (e2, Math.sin (angle));
    let sagittal = new THREE.Vector3 ().crossVectors (normal, transverse);

    // (e1, e2) is an arbitrary basis of the occlusal plane
    // the arch is a horseshoe: the long tail of the tooth centers points to the back, so the incisors are opposite
    let meanY = centers.reduce ((sum, center) => sum + center.dot (sagittal), 0.0) / centers.length;
    let skewness = centers.reduce ((sum, center) => sum + (center.dot (sagittal) - meanY) ** 3, 0.0);
    if (skewness > 0.0) {
        sagittal.negate ();
    }
    let side = new THREE.Vector3 ().crossVectors (sagittal, normal);

    // extent of the arch in the grid reference frame (side = x, sagittal = y)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let point of allVertices) {
        let x = point.dot (side);
        minX = Math.min (minX, x);
        maxX = Math.max (maxX, x);
        minY = Math.min (minY, point.dot (sagittal));
        maxY = Math.max (maxY, point.dot (sagittal));
    }
    // a deep arch needs a bigger grid, so that its back still fits inside
    let scale = Math.max (
        (maxX - minX) / (gridArchWidthRatio * dentalGridWidth),
        (maxY - minY) / ((1.0 - gridFrontOffsetRatio - 0.03) * dentalGridHeight)
    );
    // the grid is shifted so that the front of the arch lands at the offset of the reference picture
    let topY = maxY + gridFrontOffsetRatio * dentalGridHeight * scale;
    let centerY = topY - 0.5 * dentalGridHeight * scale;
    // the grid lies at the median height of the tooth tops, i.e. on the chewing surfaces
    let depth = Array.from (toothTops).sort ((a, b) => a - b)[Math.floor (toothTops.length / 2)];
    let origin = new THREE.Vector3 ()
        .addScaledVector (side, 0.5 * (minX + maxX))
        .addScaledVector (sagittal, centerY)
        .addScaledVector (normal, depth);

    let placement = new THREE.Matrix4 ().makeBasis (side, sagittal, normal);
    placement.scale (new THREE.Vector3 (scale, scale, scale));
    placement.setPosition (origin);

    // every black bar of the reference SVG is one box instance: a single draw call for the whole grid
    let grid = new THREE.InstancedMesh (
        new THREE.BoxGeometry (1, 1, 1),
        new THREE.MeshBasicMaterial ({ color : 0x000000 }),
        dentalGridRects.length
    );
    let local = new THREE.Matrix4 ();
    dentalGridRects.forEach (([x, y, width, height], index) => {
        local.compose (
            new THREE.Vector3 (x + width / 2.0 - dentalGridWidth / 2.0, dentalGridHeight / 2.0 - y - height / 2.0, 0.0),
            new THREE.Quaternion (),
            new THREE.Vector3 (width, height, gridBarThickness)
        );
        grid.setMatrixAt (index, new THREE.Matrix4 ().multiplyMatrices (placement, local));
    });
    grid.instanceMatrix.needsUpdate = true;
    grid.frustumCulled = false;
    return grid;
}

// Finds the arch mesh of a split model that is the closest (along the up direction) to the given teeth.
function GetNearestArchName (model, teeth, up)
{
    let height = (box) => DotVector3D (new Coord3D ((box.GetMin ().x + box.GetMax ().x) / 2.0, (box.GetMin ().y + box.GetMax ().y) / 2.0, (box.GetMin ().z + box.GetMax ().z) / 2.0), up);
    let teethHeight = teeth.reduce ((sum, tooth) => sum + height (GetBoundingBox (tooth)), 0.0) / teeth.length;
    let bestName = null;
    let bestDistance = Infinity;
    model.EnumerateMeshInstances ((meshInstance) => {
        let distance = Math.abs (height (GetBoundingBox (meshInstance)) - teethHeight);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestName = meshInstance.GetMesh ().GetName ();
        }
    });
    return bestName;
}

// Draws the cusp markers and the reference grids of the arches, and keeps them in sync with the arch selection
// and with the cusps toggle button.
export class CuspTool
{
    constructor (viewer)
    {
        this.viewer = viewer;
        this.gridButton = null;
        this.cuspsButton = null;
        this.showCusps = true;
        this.archFilter = false;
        this.selectedArch = null;
        this.gridObjects = [];
        this.extraObject = null;
        this.showGrid = false;
        this.model = null;
        this.mainObject = null;
    }

    // The toggle is hidden until the grid is enabled.
    SetCuspsButton (button)
    {
        this.cuspsButton = button;
        this.cuspsButton.Show (false);
    }

    // Shows or hides only the red markers: the grids are not affected.
    SetCuspsVisible (isVisible)
    {
        this.showCusps = isVisible;
        this.cuspsButton.SetSelected (isVisible);
        this.UpdateGridVisibility ();
    }

    SetGridButton (button)
    {
        this.gridButton = button;
    }

    // Once the model is split into arches, a grid is shown only while its arch mesh is selected.
    SetArchFilter (isActive)
    {
        this.archFilter = isActive;
        this.selectedArch = null;
        this.UpdateGridVisibility ();
    }

    // Called when the mesh selection changes (archName is the selected mesh name or null).
    SetSelectedArch (archName)
    {
        this.selectedArch = archName;
        this.UpdateGridVisibility ();
    }

    // An arch group is visible when no filter is active or when its arch is selected; the markers inside it
    // follow the cusps toggle.
    UpdateGridVisibility ()
    {
        for (let grid of this.gridObjects) {
            grid.visible = !this.archFilter || grid.userData.arch === this.selectedArch;
            for (let child of grid.children) {
                if (child.userData.isCusp) {
                    child.visible = this.showCusps;
                }
            }
        }
        this.viewer.Render ();
    }

    // Enables or disables the grid (and the cusp markers) for the given model.
    SetGridActive (isActive, model, mainObject)
    {
        this.showGrid = isActive;
        if (model === null) {
            this.archFilter = false;
            this.selectedArch = null;
        }
        this.Update (model, mainObject);
    }

    // Rebuilds the extra objects and the buttons state; the cusps toggle is reset to on every time.
    Update (model, mainObject)
    {
        this.gridButton.SetSelected (this.showGrid);
        // the cusps toggle exists only with the grid and starts enabled
        this.cuspsButton.Show (this.showGrid);
        this.showCusps = true;
        this.cuspsButton.SetSelected (true);
        if (this.extraObject !== null) {
            this.viewer.RemoveExtraObject (this.extraObject);
            this.extraObject = null;
        }
        this.gridObjects = [];
        if (model === null || !this.showGrid) {
            return;
        }
        this.Show (model, mainObject);
    }

    // Uses the viewer up vector as occlusal direction, so the user can pick it with the up vector buttons.
    // The model data keeps the file coordinates, while the displayed object is rotated by the model loader,
    // so the occlusal direction and the markers are converted between the two spaces.
    Show (model, mainObject)
    {
        let boundingBox = GetBoundingBox (model);
        let radius = 0.004 * CoordDistance3D (boundingBox.GetMin (), boundingBox.GetMax ());
        let globalUp = GetModelUpDirection (this.viewer, mainObject);
        let teeth = GetToothLikeSegments (SegmentTeeth (model));
        let directions = GetArchDirections (teeth, globalUp);

        let extraObject = new THREE.Object3D ();
        extraObject.quaternion.copy (mainObject.quaternion);

        // markers and grids of an arch are shown only while that arch is selected
        let archGroups = new Map ();
        for (let direction of new Set (directions)) {
            let archTeeth = teeth.filter ((_, index) => directions[index] === direction);
            let group = new THREE.Object3D ();
            group.userData.arch = GetNearestArchName (model, archTeeth, globalUp);
            archGroups.set (direction, group);
            extraObject.add (group);
            this.gridObjects.push (group);
        }

        {
            // each tooth is analyzed on its own, so a whole dentition gives up to 6 cusps per tooth
            let material = new THREE.MeshBasicMaterial ({
                color : 0xe53935
            });
            for (let [index, tooth] of teeth.entries ()) {
                let cusps = DetectCusps (tooth, {
                    upDirection : GetToothAxis (tooth, directions[index]),
                    minRelativeProminence : 0.03,
                    minRelativeDistance : 0.15,
                    minRelativeHeight : 0.5,
                    maxCount : maxCuspCount
                });
                // cusps are tagged so the toggle can hide them without touching the grid
                for (let cusp of cusps) {
                    let marker = new THREE.Mesh (new THREE.SphereGeometry (radius, 16, 12), material);
                    marker.position.set (cusp.position.x, cusp.position.y, cusp.position.z);
                    marker.userData.isCusp = true;
                    archGroups.get (directions[index]).add (marker);
                }
            }
        }

        if (this.showGrid) {
            // one grid per arch
            for (let direction of new Set (directions)) {
                let archTeeth = teeth.filter ((_, index) => directions[index] === direction);
                if (archTeeth.length >= 3) {
                    let grid = CreateArchGrid (archTeeth, direction);
                    archGroups.get (direction).add (grid);
                }
            }
        }
        this.extraObject = extraObject;
        this.viewer.AddExtraObject (extraObject);
        this.UpdateGridVisibility ();
    }
}