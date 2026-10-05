import * as assert from 'assert';
import * as OV from '../../source/engine/main.js';
import { ImportFile } from '../utils/testfiles.js';

function GetDumbbellMesh ()
{
    const rings = 80;
    const sides = 40;
    let mesh = new OV.Mesh ();
    for (let i = 0; i <= rings; i++) {
        let t = i / rings;
        let radius = 0.1 + Math.pow (Math.abs (Math.sin (2.0 * Math.PI * t)), 0.7);
        for (let j = 0; j < sides; j++) {
            let angle = 2.0 * Math.PI * j / sides;
            mesh.AddVertex (new OV.Coord3D (radius * Math.cos (angle), radius * Math.sin (angle), 3.0 * t));
        }
    }
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < sides; j++) {
            let a = i * sides + j;
            let b = i * sides + (j + 1) % sides;
            let c = a + sides;
            let d = b + sides;
            mesh.AddTriangle (new OV.Triangle (a, b, d));
            mesh.AddTriangle (new OV.Triangle (a, d, c));
        }
    }
    return mesh;
}

export default function suite ()
{

describe ('Tooth Segmentation', function () {
    it ('Empty mesh', function () {
        assert.deepStrictEqual (OV.SegmentTeeth (new OV.Mesh ()), []);
    });

    it ('Single convex shape stays in one piece', function () {
        let sphere = OV.GenerateSphere (null, 1.0, 20, true);
        let segments = OV.SegmentTeeth (sphere);
        assert.strictEqual (segments.length, 1);
        assert.strictEqual (segments[0].TriangleCount (), sphere.TriangleCount ());
    });

    it ('Two lobes separated by a groove', function () {
        let mesh = GetDumbbellMesh ();
        let segments = OV.SegmentTeeth (mesh);
        assert.strictEqual (segments.length, 2);
        assert.strictEqual (segments[0].TriangleCount () + segments[1].TriangleCount (), mesh.TriangleCount ());
    });

    it ('Human mouth', function (done) {
        ImportFile (new OV.ImporterStl (), 'dental/human_mouth', 'human_mouth_detailed.stl', (model) => {
            let segments = OV.SegmentTeeth (model);
            let total = 0;
            for (let segment of segments) {
                total += segment.TriangleCount ();
            }
            assert.strictEqual (total, model.TriangleCount ());
            assert.ok (segments.length >= 24 && segments.length <= 40);
            done ();
        });
    });

    it ('Dense single arch scan', function (done) {
        ImportFile (new OV.ImporterStl (), 'dental/human_lower_jaw/092226-PLOZZA AYLIN', 'lower.stl', (model) => {
            let segments = OV.SegmentTeeth (model);
            let total = 0;
            for (let segment of segments) {
                total += segment.TriangleCount ();
            }
            assert.strictEqual (total, model.TriangleCount ());
            assert.ok (segments.length >= 10 && segments.length <= 20);
            done ();
        });
    });
});

}
