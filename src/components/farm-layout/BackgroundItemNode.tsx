"use client";

import { Circle, Ellipse, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import {
  FARM_BACKGROUND_LABELS,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  FARM_LAYOUT_GRID,
  type FarmLayoutBackgroundItem,
  type FarmPoint,
} from "@/lib/farm-layout";

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

function snap(value: number, enabled: boolean): number {
  if (!enabled) {
    return Math.round(value);
  }

  return Math.round(value / FARM_LAYOUT_GRID) * FARM_LAYOUT_GRID;
}

export default function BackgroundItemNode({
  item,
  selected,
  draggable,
  snapToGrid,
  onSelect,
  onAlignDrag,
  onMove,
}: {
  item: FarmLayoutBackgroundItem;
  selected: boolean;
  draggable: boolean;
  snapToGrid: boolean;
  onSelect: (id: string) => void;
  onAlignDrag: (id: string, x: number, y: number) => FarmPoint;
  onMove: (id: string, x: number, y: number) => void;
}) {
  function handleDragMove(event: Konva.KonvaEventObject<DragEvent>) {
    const aligned = onAlignDrag(item.id, event.target.x(), event.target.y());
    event.target.position(aligned);
  }

  function handleDragEnd(event: Konva.KonvaEventObject<DragEvent>) {
    const aligned = onAlignDrag(
      item.id,
      clamp(snap(event.target.x(), snapToGrid), FARM_CANVAS_WIDTH),
      clamp(snap(event.target.y(), snapToGrid), FARM_CANVAS_HEIGHT),
    );
    event.target.position(aligned);
    onMove(item.id, aligned.x, aligned.y);
  }

  return (
    <Group
      name="flow-background"
      id={item.id}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      scaleX={item.scale}
      scaleY={item.scale}
      draggable={draggable}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onSelect(item.id);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(item.id);
      }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {selected ? (
        <Circle radius={50} stroke="#2563eb" strokeWidth={3} dash={[6, 4]} />
      ) : null}

      {item.type === "TREE" ? (
        <>
          <Rect x={-5} y={2} width={10} height={30} fill="#8b5a2b" />
          <Circle y={-8} radius={22} fill="#2f8f46" />
          <Circle x={-14} y={2} radius={16} fill="#3aa653" />
          <Circle x={14} y={0} radius={17} fill="#277c3b" />
        </>
      ) : null}

      {item.type === "WATER_TANK" ? (
        <>
          <Rect x={-18} y={6} width={6} height={24} fill="#64748b" />
          <Rect x={12} y={6} width={6} height={24} fill="#64748b" />
          <Rect
            x={-28}
            y={-18}
            width={56}
            height={34}
            fill="#7dd3fc"
            stroke="#0284c7"
            strokeWidth={3}
            cornerRadius={8}
          />
          <Line
            points={[-28, -6, 28, -6]}
            stroke="#0284c7"
            strokeWidth={2}
            opacity={0.6}
          />
        </>
      ) : null}

      {item.type === "POND" ? (
        <>
          <Ellipse
            radiusX={42}
            radiusY={27}
            fill="#67d5e8"
            stroke="#0e9bb5"
            strokeWidth={3}
          />
          <Ellipse
            x={-8}
            y={-6}
            radiusX={14}
            radiusY={7}
            fill="#b8f1f8"
            opacity={0.8}
          />
          <Line
            points={[-30, 12, -10, 12]}
            stroke="#e7f7b5"
            strokeWidth={4}
            lineCap="round"
          />
        </>
      ) : null}

      {item.type === "SHED" ? (
        <>
          <Rect
            x={-30}
            y={-6}
            width={60}
            height={34}
            fill="#e7c987"
            stroke="#a27432"
            strokeWidth={3}
            cornerRadius={4}
          />
          <Line
            points={[-38, -6, 0, -30, 38, -6]}
            closed
            fill="#b5673d"
            stroke="#7f4427"
            strokeWidth={3}
            lineJoin="round"
          />
          <Rect x={-8} y={8} width={16} height={20} fill="#8b5a2b" />
        </>
      ) : null}

      {item.type === "FLOWER_BED" ? (
        <>
          <Rect
            x={-38}
            y={-20}
            width={76}
            height={40}
            fill="#9a6b45"
            stroke="#6f4a2f"
            strokeWidth={2}
            cornerRadius={12}
          />
          <Circle x={-22} y={-6} radius={7} fill="#f472b6" />
          <Circle x={0} y={-10} radius={8} fill="#fbbf24" />
          <Circle x={22} y={-4} radius={7} fill="#c084fc" />
          <Circle x={-10} y={10} radius={7} fill="#fb7185" />
          <Circle x={14} y={11} radius={7} fill="#f97316" />
        </>
      ) : null}

      <Text
        x={-60}
        y={36}
        width={120}
        text={FARM_BACKGROUND_LABELS[item.type]}
        fontSize={12}
        align="center"
        fill="#334155"
      />
    </Group>
  );
}
