"use client";

import Konva from "konva";
import { useEffect, useRef } from "react";
import { Group, Line } from "react-konva";
import type { FarmPoint } from "@/lib/farm-layout";

const SOURCE_OFFSET = 32;
const TARGET_OFFSET = 36;

function direction(from: FarmPoint, to: FarmPoint): FarmPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function orthogonalPath(points: FarmPoint[]): number[] {
  const result = [points[0].x, points[0].y];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (Math.abs(current.x - previous.x) >= Math.abs(current.y - previous.y)) {
      result.push(current.x, previous.y);
    } else {
      result.push(previous.x, current.y);
    }

    result.push(current.x, current.y);
  }

  return result;
}

function buildFlowPoints(
  from: FarmPoint,
  to: FarmPoint,
  waypoints: FarmPoint[],
  fromOffset: number,
  toOffset: number,
): number[] {
  if (waypoints.length === 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const horizontalDirection = dx >= 0 ? 1 : -1;
    const verticalDirection = dy >= 0 ? 1 : -1;
    const startX = from.x + horizontalDirection * fromOffset;
    const startY = from.y + verticalDirection * fromOffset;
    const endX = to.x - horizontalDirection * toOffset;
    const endY = to.y - verticalDirection * toOffset;

    if (Math.abs(dx) >= Math.abs(dy)) {
      const bendX = Math.abs(endX - startX) < 24 ? (startX + endX) / 2 : endX;
      const finalY = dy === 0 ? to.y : endY;

      return [startX, from.y, bendX, from.y, bendX, finalY];
    }

    const bendY = Math.abs(endY - startY) < 24 ? (startY + endY) / 2 : endY;
    const finalX = dx === 0 ? to.x : endX;

    return [from.x, startY, from.x, bendY, finalX, bendY];
  }

  const sourceDirection = direction(from, waypoints[0]);
  const targetDirection = direction(to, waypoints[waypoints.length - 1]);
  const path = [
    {
      x: from.x + sourceDirection.x * fromOffset,
      y: from.y + sourceDirection.y * fromOffset,
    },
    ...waypoints,
    {
      x: to.x + targetDirection.x * toOffset,
      y: to.y + targetDirection.y * toOffset,
    },
  ];

  return orthogonalPath(path);
}

export default function ConnectionLine({
  from,
  to,
  waypoints = [],
  fromOffset = SOURCE_OFFSET,
  toOffset = TARGET_OFFSET,
  selected,
  preview = false,
  connectionId,
  onSelect,
  onSelectAt,
}: {
  from: FarmPoint;
  to: FarmPoint;
  waypoints?: FarmPoint[];
  fromOffset?: number;
  toOffset?: number;
  selected: boolean;
  preview?: boolean;
  connectionId?: string;
  onSelect: () => void;
  onSelectAt?: (point: FarmPoint) => void;
}) {
  const flowRef = useRef<Konva.Line | null>(null);
  const points = buildFlowPoints(from, to, waypoints, fromOffset, toOffset);
  const color = preview ? "#7c3aed" : selected ? "#dc2626" : "#0284c7";

  useEffect(() => {
    const node = flowRef.current;

    if (!node) {
      return;
    }

    let frame = 0;
    let offset = 0;
    let previous = performance.now();

    const animate = (now: number) => {
      const elapsed = now - previous;
      previous = now;
      offset = (offset - elapsed * 0.035) % 36;
      node.dashOffset(offset);
      node.getLayer()?.batchDraw();
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Group>
      <Line
        points={points}
        stroke={color}
        strokeWidth={selected ? 9 : 7}
        opacity={0.16}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
      <Line
        name="flow-line"
        id={connectionId}
        points={points}
        stroke={color}
        strokeWidth={selected ? 4 : 3}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={20}
        listening={!preview}
        onMouseDown={(event) => {
          event.cancelBubble = true;

          if (onSelectAt) {
            const pointer = event.target.getStage()?.getPointerPosition();
            if (pointer) {
              onSelectAt({ x: pointer.x, y: pointer.y });
              return;
            }
          }

          onSelect();
        }}
        onTap={(event) => {
          event.cancelBubble = true;

          if (onSelectAt) {
            const pointer = event.target.getStage()?.getPointerPosition();
            if (pointer) {
              onSelectAt({ x: pointer.x, y: pointer.y });
              return;
            }
          }

          onSelect();
        }}
      />
      <Line
        ref={flowRef}
        points={points}
        stroke="#ffffff"
        strokeWidth={2}
        dash={[10, 8]}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    </Group>
  );
}
