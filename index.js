const functionutils = require('functionutils');

const CONTROLLER_LINE_LENGTH = 15;

module.exports = ({THREE}) => {
  class BoxTarget {
    constructor(position, quaternion, scale, size) {
      this.position = position;
      this.quaternion = quaternion;
      this.quaternionInverse = quaternion.clone().inverse();
      this.scale = scale;
      this.size = size;

      const halfScale = scale.clone().divideScalar(2);
      this.box = new THREE.Box3(
        position.clone().sub(size.clone().multiply(halfScale)),
        position.clone().add(size.clone().multiply(halfScale))
      );
    }

    getRelativePoint(point) {
      const {position, quaternionInverse} = this;
      return point.clone()
        .sub(position)
        .applyQuaternion(quaternionInverse)
        .add(position);
    }

    getUnrelativePoint(point) {
      const {position, quaternion} = this;
      return point.clone()
        .sub(position)
        .applyQuaternion(quaternion)
        .add(position);
    }

    intersectLine(line) {
      const {start, end} = line;
      const relativeStart = this.getRelativePoint(start);
      const relativeEnd = this.getRelativePoint(end);
      const relativeRay = new THREE.Ray(relativeStart, relativeEnd.clone().sub(relativeStart));

      const {box} = this;
      const relativeIntersectionPoint = relativeRay.intersectBox(box);
      if (relativeIntersectionPoint) {
        const unrelativeIntersectionPoint = this.getUnrelativePoint(relativeIntersectionPoint);
        return unrelativeIntersectionPoint;
      } else {
        return null;
      }
    }

    containsPoint(point) {
      return this.box.containsPoint(this.getRelativePoint(point));
    }
  }

  class PlaneTarget {
    constructor(position, quaternion, scale, width, height) {
      this.position = position;
      this.quaternion = quaternion;
      this.scale = scale;
      this.width = width;
      this.height = height;

      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion),
        position
      );
      this.plane = plane;
      const lines = {
        left: new THREE.Line3(
          position.clone().add(new THREE.Vector3(-width / 2, -height / 2, 0).multiply(scale).applyQuaternion(quaternion)),
          position.clone().add(new THREE.Vector3(-width / 2, height / 2, 0).multiply(scale).applyQuaternion(quaternion))
        ),
        right: new THREE.Line3(
          position.clone().add(new THREE.Vector3(width / 2, -height / 2, 0).multiply(scale).applyQuaternion(quaternion)),
          position.clone().add(new THREE.Vector3(width / 2, height / 2, 0).multiply(scale).applyQuaternion(quaternion))
        ),
        top: new THREE.Line3(
          position.clone().add(new THREE.Vector3(-width / 2, height / 2, 0).multiply(scale).applyQuaternion(quaternion)),
          position.clone().add(new THREE.Vector3(width / 2, height / 2, 0).multiply(scale).applyQuaternion(quaternion))
        ),
        bottom: new THREE.Line3(
          position.clone().add(new THREE.Vector3(-width / 2, -height / 2, 0).multiply(scale).applyQuaternion(quaternion)),
          position.clone().add(new THREE.Vector3(width / 2, -height / 2, 0).multiply(scale).applyQuaternion(quaternion))
        ),
      };
      this.lines = lines;
    }

    projectPoint(point) {
      const {width, height, plane, lines: {left, right, top, bottom}} = this;
      const planePoint = plane.projectPoint(point);

      const leftPoint = left.closestPointToPoint(planePoint, false);
      const rightPoint = right.closestPointToPoint(planePoint, false);
      const topPoint = top.closestPointToPoint(planePoint, false);
      const bottomPoint = bottom.closestPointToPoint(planePoint, false);

      if (
        planePoint.distanceTo(leftPoint) <= width &&
        planePoint.distanceTo(rightPoint) <= width &&
        planePoint.distanceTo(topPoint) <= height &&
        planePoint.distanceTo(bottomPoint) <= height
      ) {
        return {
          x: top.start.distanceTo(topPoint) / width,
          y: left.end.distanceTo(leftPoint) / height,
          z: point.distanceTo(planePoint),
        };
      } else {
        return null;
      }
    }

    intersectLine(line) {
      const {width, height, plane, lines: {left, right, top, bottom}} = this;
      const intersectionPoint = plane.intersectLine(line);

      if (intersectionPoint) {
        const leftPoint = left.closestPointToPoint(intersectionPoint, false);
        const rightPoint = right.closestPointToPoint(intersectionPoint, false);
        const topPoint = top.closestPointToPoint(intersectionPoint, false);
        const bottomPoint = bottom.closestPointToPoint(intersectionPoint, false);

        if (
          intersectionPoint.distanceTo(leftPoint) <= width &&
          intersectionPoint.distanceTo(rightPoint) <= width &&
          intersectionPoint.distanceTo(topPoint) <= height &&
          intersectionPoint.distanceTo(bottomPoint) <= height
        ) {
          return {
            x: top.start.distanceTo(topPoint) / width,
            y: left.end.distanceTo(leftPoint) / height,
            z: line.start.distanceTo(intersectionPoint),
          };
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
  }

  function unindexBufferGeometry(geometry) {
    if (geometry.index) {
      const indexes = geometry.index.array;
      const numIndexes = indexes.length;
      const positionAttribute = geometry.getAttribute('position');
      const oldPositions = positionAttribute ? positionAttribute.array : null;
      const positions = positionAttribute ? new Float32Array(numIndexes * 3) : null;
      const normalAttribute = geometry.getAttribute('normal');
      const oldNormals = normalAttribute ? normalAttribute.array : null;
      const normals = normalAttribute ? new Float32Array(numIndexes * 3) : null;
      const colorAttribute = geometry.getAttribute('color');
      const oldColors = colorAttribute ? colorAttribute.array : null;
      const colors = colorAttribute ? new Float32Array(numIndexes * 3) : null;
      const uvAttribute = geometry.getAttribute('uv');
      const oldUvs = uvAttribute ? uvAttribute.array : null;
      const uvs = uvAttribute ? new Float32Array(numIndexes * 2) : null;
      for (let i = 0; i < numIndexes; i++) {
        const index = indexes[i];

        if (positions !== null) {
          positions[(i * 3) + 0] = oldPositions[(index * 3) + 0];
          positions[(i * 3) + 1] = oldPositions[(index * 3) + 1];
          positions[(i * 3) + 2] = oldPositions[(index * 3) + 2];
        }
        if (normals !== null) {
          normals[(i * 3) + 0] = oldNormals[(index * 3) + 0];
          normals[(i * 3) + 1] = oldNormals[(index * 3) + 1];
          normals[(i * 3) + 2] = oldNormals[(index * 3) + 2];
        }
        if (colors !== null) {
          colors[(i * 3) + 0] = oldColors[(index * 3) + 0];
          colors[(i * 3) + 1] = oldColors[(index * 3) + 1];
          colors[(i * 3) + 2] = oldColors[(index * 3) + 2];
        }
        if (uvs !== null) {
          uvs[(i * 2) + 0] = oldUvs[(index * 2) + 0];
          uvs[(i * 2) + 1] = oldUvs[(index * 2) + 1];
        }
      }
      if (positions !== null) {
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      }
      if (normals !== null) {
        geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
      }
      if (colors !== null) {
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
      }
      if (uvs !== null) {
        geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      }
      geometry.index = null;
    }

    return geometry;
  }
  function mergeBufferGeometry(geometry1, geometry2) {
    if (geometry1.index) {
      geometry1 = unindexBufferGeometry(geometry1);
    }
    if (geometry2.index) {
      geometry2 = unindexBufferGeometry(geometry2);
    }

    const positions1 = geometry1.getAttribute('position').array;
    const positions2 = geometry2.getAttribute('position').array;
    const positions = new Float32Array(positions1.length + positions2.length);
    positions.set(positions1);
    positions.set(positions2, positions1.length);

    const normalAttribute1 = geometry1.getAttribute('normal');
    const normals1 = normalAttribute1 ? normalAttribute1.array : null;
    const normalAttribute2 = geometry2.getAttribute('normal');
    const normals2 = normalAttribute2 ? normalAttribute2.array : null;
    const normals = (normals1 && normals2) ? new Float32Array(normals1.length + normals2.length) : null;
    if (normals) {
      normals.set(normals1);
      normals.set(normals2, normals1.length);
    }

    const colorAttribute1 = geometry1.getAttribute('color');
    const colors1 = colorAttribute1 ? colorAttribute1.array : null;
    const colorAttribute2 = geometry2.getAttribute('color');
    const colors2 = colorAttribute2 ? colorAttribute2.array : null;
    const colors = (colors1 && colors2) ? new Float32Array(colors1.length + colors2.length) : null;
    if (colors) {
      colors.set(colors1);
      colors.set(colors2, colors1.length);
    }

    const uvAttribute1 = geometry1.getAttribute('uv');
    const uvs1 = uvAttribute1 ? uvAttribute1.array : null;
    const uvAttribute2 = geometry2.getAttribute('uv');
    const uvs2 = uvAttribute2 ? uvAttribute2.array : null;
    const uvs = (uvs1 & uvs2) ? new Float32Array(uvs1.length + uvs2.length) : null;
    if (uvs) {
      uvs.set(uvs1);
      uvs.set(uvs2, uvs1.length);
    }

    const geometry3 = new THREE.BufferGeometry();
    geometry3.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals) {
      geometry3.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
    }
    if (colors) {
      geometry3.addAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    if (uvs) {
      geometry3.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }

    return geometry3;
  }
  function concatBufferGeometry(geometries) {
    geometries = geometries.map(geometry => unindexBufferGeometry(geometry));

    const positions = (() => {
      const geometryPositions = geometries.map(geometry => geometry.getAttribute('position').array);
      const numPositions = functionutils.sum(geometryPositions.map(geometryPosition => geometryPosition.length));

      const result = new Float32Array(numPositions);
      let i = 0;
      geometryPositions.forEach(geometryPosition => {
        result.set(geometryPosition, i);
        i += geometryPosition.length;
      });
      return result;
    })();
    const normals = (() => {
      const geometryNormals = geometries.map(geometry => geometry.getAttribute('normal').array);
      const numNormals = functionutils.sum(geometryNormals.map(geometryNormal => geometryNormal.length));

      const result = new Float32Array(numNormals);
      let i = 0;
      geometryNormals.forEach(geometryNormal => {
        result.set(geometryNormal, i);
        i += geometryNormal.length;
      });
      return result;
    })();
    const uvs = (() => {
      const geometryUvs = geometries.map(geometry => geometry.getAttribute('uv').array);
      const numUvs = functionutils.sum(geometryUvs.map(geometryUv => geometryUv.length));

      const result = new Float32Array(numUvs);
      let i = 0;
      geometryUvs.forEach(geometryUv => {
        result.set(geometryUv, i);
        i += geometryUv.length;
      });
      return result;
    })();

    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geometry;
  }

  /* const sliceGeometry = (() => {
    const FRONT = 'front';
    const BACK = 'back';
    const STRADDLE = 'straddle';
    const ON = 'on';

    function sliceFace(plane, geom, points, position) {
      let i;
      let len = points.length;
      let p1;
      let p2;
      let intersection;
      let position1;
      let position2;
      const slicePoints = [];

      for (i = 0; i < len; i++) {
        p1 = points[i];
        p2 = i + 1 < len ? points[i + 1] : points[0];
        intersection = intersectPlane(p1, p2, plane);
        position1 = vertexPosition(plane, p1.vertex);
        position2 = vertexPosition(plane, p2.vertex);
        if (position1 == position && slicePoints.indexOf(p1) === -1) {
          slicePoints.push(p1);
        }
        if (intersection) {
          slicePoints.push(intersection);
        }
        if (position2 == position && slicePoints.indexOf(p2) === -1) {
          slicePoints.push(p2);
        }
      }

      if (slicePoints.length > 3) {
        addFace(geom, [
          slicePoints[0],
          slicePoints[1],
          slicePoints[2],
        ]);
        addFace(geom, [
          slicePoints[2],
          slicePoints[3],
          slicePoints[0],
        ]);
      } else {
        addFace(geom, slicePoints);
      }
    }

    function addFace(geom, points) {
      let existingIndex;
      const vertexIndices = [];
      let indexOffset = geom.vertices.length;
      let exists;
      const normals = [];
      const uvs = [];

      points.forEach(function(point) {
        existingIndex = geom.vertices.indexOf(point.vertex);
        if (existingIndex !== -1) {
          vertexIndices.push(existingIndex);
        } else {
          geom.vertices.push(point.vertex);
          vertexIndices.push(indexOffset);
          indexOffset += 1;
        }
        if (point.normal) {
          normals.push(point.normal);
        }
        if (point.uv) {
          uvs.push(point.uv);
        }
        return !exists;
      });

      const face = new THREE.Face3(
        vertexIndices[0],
        vertexIndices[1],
        vertexIndices[2],
        normals
      );
      geom.faces.push(face);
      if (uvs.length) {
        geom.faceVertexUvs[0].push(uvs);
      }
    }

    function facePoints(geom, face, faceIndex) {
      const uvs = geom.faceVertexUvs[0];
      return ['a', 'b', 'c'].map(function(key, i) {
        return {
          vertex: geom.vertices[face[key]],
          normal: face.vertexNormals[i],
          uv: uvs[faceIndex] ? uvs[faceIndex][i] : undefined,
        };
      });
    }

    function intersectPlane(p1, p2, plane) {
      const line = new THREE.Line3(p1.vertex, p2.vertex);
      const intersection = plane.intersectLine(line);
      if (intersection) {
        const distance = p1.vertex.distanceTo(intersection);
        const alpha = distance / line.distance();
        return {
          vertex: intersection,
          normal: p1.normal.clone().lerp(p2.normal, alpha).normalize(),
          uv: p1.uv && p2.uv ? p1.uv.clone().lerp(p2.uv, alpha) : null
        };
      }
    }

    function facePosition(plane, points) {
      const a = vertexPosition(plane, points[0].vertex);
      const b = vertexPosition(plane, points[1].vertex);
      const c = vertexPosition(plane, points[2].vertex);
      if (a == BACK || b == BACK || c == BACK) {
        if (a == FRONT || b == FRONT || c == FRONT) {
          return STRADDLE;
        }
        return BACK;
      }
      if (a == FRONT || b == FRONT || c == FRONT) {
        if (a == BACK || b == BACK || c == BACK) {
          return STRADDLE;
        }
        return FRONT;
      }
      return ON;
    }

    function vertexPosition(plane, vertex) {
      const distance = plane.distanceToPoint(vertex);
      if (distance < 0) {
        return BACK;
      }
      if (distance > 0) {
        return FRONT;
      }
      return ON;
    }

    return (geom, plane) => {
      const slicedFront = new THREE.Geometry();
      geom.faces.forEach((face, faceIndex) => {
        const pointsFront = facePoints(geom, face, faceIndex);
        const positionFront = facePosition(plane, pointsFront);
        if (positionFront == FRONT || positionFront == ON) {
          addFace(slicedFront, pointsFront);
        } else if (positionFront == STRADDLE) {
          sliceFace(plane, slicedFront, pointsFront, FRONT);
        }
      });

      const slicedBack = new THREE.Geometry();
      geom.faces.forEach((face, faceIndex) => {
        const pointsBack = facePoints(geom, face, faceIndex);
        const positionBack = facePosition(plane, pointsBack);
        if (positionBack == BACK) {
          addFace(slicedBack, pointsBack);
        } else if (positionBack == STRADDLE) {
          sliceFace(plane, slicedBack, pointsBack, BACK);
        }
      });

      return [slicedFront, slicedBack];
    };
  })();
  api.sliceGeometry = sliceGeometry;

  class FacePoint {
    constructor(position = null, normal = null, color = null, uv = null) {
      this.position = position;
      this.normal = normal;
      this.color = color;
      this.uv = uv;
    }
  }

  const sliceBufferGeometry = (() => {
    const FRONT = 'front';
    const BACK = 'back';
    const STRADDLE = 'straddle';
    const ON = 'on';

    function sliceFace(positions, normals, colors, uvs, points, plane, position) {
      const slicePoints = [];

      for (let i = 0; i < 3; i++) {
        const p1 = points[i];
        const p2 = ((i + 1) < 3) ? points[i + 1] : points[0];
        const intersection = intersectPlane(p1, p2, plane);
        const position1 = vertexPosition(plane, p1.position);
        const position2 = vertexPosition(plane, p2.position);
        if (position1 == position && slicePoints.indexOf(p1) === -1) {
          slicePoints.push(p1);
        }
        if (intersection) {
          const intersectionPoint = new FacePoint(
            intersection.vertex,
            intersection.normal,
            (p1.color && p2.color) ? p1.color.clone().add(p2.color).multiplyScalar(0.5) : null,
            intersection.uv,
          );
          slicePoints.push(intersectionPoint);
        }
        if (position2 == position && slicePoints.indexOf(p2) === -1) {
          slicePoints.push(p2);
        }
      }

      if (slicePoints.length > 3) {
        addFace(positions, normals, colors, uvs, [
          slicePoints[0],
          slicePoints[1],
          slicePoints[2],
        ]);
        addFace(positions, normals, colors, uvs, [
          slicePoints[2],
          slicePoints[3],
          slicePoints[0],
        ]);
      } else {
        addFace(positions, normals, colors, uvs, slicePoints);
      }
    }

    function addFace(positions, normals, colors, uvs, points) {
      positions.push(
        points[0].position.x,
        points[0].position.y,
        points[0].position.z,
        points[1].position.x,
        points[1].position.y,
        points[1].position.z,
        points[2].position.x,
        points[2].position.y,
        points[2].position.z,
      );
      normals.push(
        points[0].normal.x,
        points[0].normal.y,
        points[0].normal.z,
        points[1].normal.x,
        points[1].normal.y,
        points[1].normal.z,
        points[2].normal.x,
        points[2].normal.y,
        points[2].normal.z,
      );
      if (colors) {
        colors.push(
          points[0].color.r,
          points[0].color.g,
          points[0].color.b,
          points[1].color.r,
          points[1].color.g,
          points[1].color.b,
          points[2].color.r,
          points[2].color.g,
          points[2].color.b,
        );
      }
      if (uvs) {
        uvs.push(
          points[0].uv.x,
          points[0].uv.y,
          points[1].uv.x,
          points[1].uv.y,
          points[2].uv.x,
          points[2].uv.y,
        );
      }
    }

    function facePoints(geometry, faceIndex) {
      const positions = geometry.getAttribute('position').array;
      const normals = geometry.getAttribute('normal').array;
      const colorAttribute = geometry.getAttribute('color');
      const colors = colorAttribute ? colorAttribute.array : null;
      const uvAttribute = geometry.getAttribute('uv');
      const uvs = uvAttribute ? uvAttribute.array : null;

      return [
        new FacePoint(
          new THREE.Vector3().fromArray(positions, (faceIndex * 3 * 3) + (0 * 3)),
          new THREE.Vector3().fromArray(normals, (faceIndex * 3 * 3) + (0 * 3)),
          colors && new THREE.Color().fromArray(colors, (faceIndex * 3 * 3) + (0 * 3)),
          uvs && new THREE.Vector3().fromArray(uvs, (faceIndex * 3 * 2) + (0 * 2))
        ),
        new FacePoint(
          new THREE.Vector3().fromArray(positions, (faceIndex * 3 * 3) + (1 * 3)),
          new THREE.Vector3().fromArray(normals, (faceIndex * 3 * 3) + (1 * 3)),
          colors && new THREE.Color().fromArray(colors, (faceIndex * 3 * 3) + (1 * 3)),
          uvs && new THREE.Vector3().fromArray(uvs, (faceIndex * 3 * 2) + (1 * 2))
        ),
        new FacePoint(
          new THREE.Vector3().fromArray(positions, (faceIndex * 3 * 3) + (2 * 3)),
          new THREE.Vector3().fromArray(normals, (faceIndex * 3 * 3) + (2 * 3)),
          colors && new THREE.Color().fromArray(colors, (faceIndex * 3 * 3) + (2 * 3)),
          uvs && new THREE.Vector3().fromArray(uvs, (faceIndex * 3 * 2) + (2 * 2))
        ),
      ];
    }

    function intersectPlane(p1, p2, plane) {
      const line = new THREE.Line3(p1.position, p2.position);
      const intersection = plane.intersectLine(line);
      if (intersection) {
        const distance = p1.position.distanceTo(intersection);
        const alpha = distance / line.distance();
        return {
          vertex: intersection,
          normal: p1.normal.clone().lerp(p2.normal, alpha).normalize(),
          uv: p1.uv && p2.uv ? p1.uv.clone().lerp(p2.uv, alpha) : null
        };
      }
    }

    function facePosition(plane, points) {
      const a = vertexPosition(plane, points[0].position);
      const b = vertexPosition(plane, points[1].position);
      const c = vertexPosition(plane, points[2].position);
      if (a == BACK || b == BACK || c == BACK) {
        if (a == FRONT || b == FRONT || c == FRONT) {
          return STRADDLE;
        }
        return BACK;
      }
      if (a == FRONT || b == FRONT || c == FRONT) {
        if (a == BACK || b == BACK || c == BACK) {
          return STRADDLE;
        }
        return FRONT;
      }
      return ON;
    }

    function vertexPosition(plane, vertex) {
      const distance = plane.distanceToPoint(vertex);
      if (distance < 0) {
        return BACK;
      }
      if (distance > 0) {
        return FRONT;
      }
      return ON;
    }

    return (geometry, plane) => {
      const positions = geometry.getAttribute('position').array;
      const numVertices = positions.length / 3;
      const numFaces = numVertices / 3;

      const geometryFront = new THREE.BufferGeometry();
      const positionsFront = [];
      const normalsFront = geometry.getAttribute('normal') ? [] : null;
      const colorsFront = geometry.getAttribute('color') ? [] : null;
      const uvsFront = geometry.getAttribute('uv') ? [] : null;
      for (let i = 0; i < numFaces; i++) {
        const pointsFront = facePoints(geometry, i);
        const positionFront = facePosition(plane, pointsFront);
        if (positionFront == FRONT || positionFront == ON) {
          addFace(positionsFront, normalsFront, colorsFront, uvsFront, pointsFront);
        } else if (positionFront == STRADDLE) {
          sliceFace(positionsFront, normalsFront, colorsFront, uvsFront, pointsFront, plane, FRONT);
        }
      }
      geometryFront.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(positionsFront), 3));
      geometryFront.addAttribute('normal', new THREE.BufferAttribute(Float32Array.from(normalsFront), 3));
      if (colorsFront) {
        geometryFront.addAttribute('color', new THREE.BufferAttribute(Float32Array.from(colorsFront), 3));
      }
      if (uvsFront) {
        geometryFront.addAttribute('uv', new THREE.BufferAttribute(Float32Array.from(uvsFront), 2));
      }

      const geometryBack = new THREE.BufferGeometry();
      const positionsBack = [];
      const normalsBack = geometry.getAttribute('normal') ? [] : null;
      const colorsBack = geometry.getAttribute('color') ? [] : null;
      const uvsBack = geometry.getAttribute('uv') ? [] : null;
      for (let i = 0; i < numFaces; i++) {
        const pointsBack = facePoints(geometry, i);
        const positionBack = facePosition(plane, pointsBack);
        if (positionBack == BACK) {
          addFace(positionsBack, normalsBack, colorsBack, uvsBack, pointsBack);
        } else if (positionBack == STRADDLE) {
          sliceFace(positionsBack, normalsBack, colorsBack, uvsBack, pointsBack, plane, BACK);
        }
      }
      geometryBack.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(positionsBack), 3));
      geometryBack.addAttribute('normal', new THREE.BufferAttribute(Float32Array.from(normalsBack), 3));
      if (colorsBack) {
        geometryBack.addAttribute('color', new THREE.BufferAttribute(Float32Array.from(colorsBack), 3));
      }
      if (uvsBack) {
        geometryBack.addAttribute('uv', new THREE.BufferAttribute(Float32Array.from(uvsBack), 2));
      }

      return [geometryFront, geometryBack];
    };
  })(); */

  const makeControllerLine = (position, rotation, scale) => {
    return new THREE.Line3(
      position.clone(),
      position.clone().add(
        new THREE.Vector3(0, 0, -CONTROLLER_LINE_LENGTH)
          .multiply(scale)
          .applyQuaternion(rotation)
        )
    );
  };

  const makeBoxTarget = (position, rotation, scale, size) => new BoxTarget(position, rotation, scale, size);
  const makeBoxTargetOffset = (position, rotation, scale, start, end) => {
    const topLeft = position.clone().add(
      start.clone().multiply(scale).applyQuaternion(rotation)
    );
    const bottomRight = position.clone().add(
      end.clone().multiply(scale).applyQuaternion(rotation)
    );
    const newPosition = new THREE.Vector3((topLeft.x + bottomRight.x) / 2, (topLeft.y + bottomRight.y) / 2, (topLeft.z + bottomRight.z) / 2);
    const newSize = new THREE.Vector3(Math.abs(start.x - end.x), Math.abs(start.y - end.y), Math.abs(start.z - end.z));
    return makeBoxTarget(newPosition, rotation, scale, newSize);
  };
  const makePlaneTarget = (position, quaternion, scale, width, height) => new PlaneTarget(position, quaternion, scale, width, height);

  return {
    unindexBufferGeometry,
    mergeBufferGeometry,
    concatBufferGeometry,
    // sliceBufferGeometry,
    makeControllerLine,
    makeBoxTarget,
    makeBoxTargetOffset,
    makePlaneTarget,
  };
};
