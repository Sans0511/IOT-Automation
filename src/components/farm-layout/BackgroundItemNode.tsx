"use client";

import {
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Line,
  Rect,
  Text,
} from "react-konva";
import type Konva from "konva";
import { useState } from "react";
import { useCanvasImage } from "./useCanvasImage";
import {
  FARM_BACKGROUND_LABELS,
  FARM_BACKGROUND_PORT_SIDES,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  FARM_LAYOUT_GRID,
  getFarmBackgroundPortLocalPoint,
  type FarmBackgroundPortSide,
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
  highlighted,
  linkMode,
  linkSourcePort,
  draggable,
  snapToGrid,
  onSelect,
  onPortDragStart,
  onAlignDrag,
  onMove,
}: {
  item: FarmLayoutBackgroundItem;
  selected: boolean;
  highlighted: boolean;
  linkMode: boolean;
  linkSourcePort: FarmBackgroundPortSide | null;
  draggable: boolean;
  snapToGrid: boolean;
  onSelect: (id: string, port?: FarmBackgroundPortSide) => void;
  onPortDragStart: () => void;
  onAlignDrag: (id: string, x: number, y: number) => FarmPoint;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showPorts = linkMode || selected || highlighted || hovered;
  const treeImage = useCanvasImage(
    item.type === "TREE" ? "/background-items/coconut-tree.png" : null,
  );
  const appleTreeImage = useCanvasImage(
    item.type === "APPLE_TREE" ? "/background-items/apple-tree.png" : null,
  );
  const mangoTreeImage = useCanvasImage(
    item.type === "MANGO_TREE"
      ? "/background-items/mango-tree-icon.svg"
      : null,
  );
  const rosePlantImage = useCanvasImage(
    item.type === "ROSE_PLANT"
      ? "/background-items/rose-plant-icon.svg"
      : null,
  );

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {selected ? (
        <Circle radius={50} stroke="#2563eb" strokeWidth={3} dash={[6, 4]} />
      ) : null}

      {item.type === "TREE" ? (
        treeImage ? (
          <KonvaImage
            image={treeImage}
            x={-36}
            y={-40}
            width={72}
            height={72}
          />
        ) : (
          <>
            <Rect x={-5} y={2} width={10} height={30} fill="#8b5a2b" />
            <Circle y={-8} radius={22} fill="#2f8f46" />
            <Circle x={-14} y={2} radius={16} fill="#3aa653" />
            <Circle x={14} y={0} radius={17} fill="#277c3b" />
          </>
        )
      ) : null}

      {item.type === "APPLE_TREE" ? (
        appleTreeImage ? (
          <KonvaImage
            image={appleTreeImage}
            x={-36}
            y={-40}
            width={72}
            height={68}
          />
        ) : (
          <>
            <Rect x={-5} y={2} width={10} height={30} fill="#8b5a2b" />
            <Circle y={-8} radius={22} fill="#2f8f46" />
            <Circle x={-13} y={0} radius={5} fill="#ef4444" />
            <Circle x={13} y={-4} radius={5} fill="#dc2626" />
          </>
        )
      ) : null}

      {item.type === "MANGO_TREE" ? (
        mangoTreeImage ? (
          <KonvaImage
            image={mangoTreeImage}
            x={-36}
            y={-40}
            width={72}
            height={68}
          />
        ) : (
          <>
            <Rect x={-5} y={2} width={10} height={30} fill="#8b5a2b" />
            <Circle y={-8} radius={22} fill="#2f8f46" />
            <Circle x={-13} y={0} radius={5} fill="#fbbf24" />
            <Circle x={13} y={-4} radius={5} fill="#f59e0b" />
          </>
        )
      ) : null}

      {item.type === "ROSE_PLANT" ? (
        rosePlantImage ? (
          <KonvaImage
            image={rosePlantImage}
            x={-36}
            y={-40}
            width={72}
            height={68}
          />
        ) : (
          <>
            <Ellipse y={28} radiusX={24} radiusY={8} fill="#8b5a2b" />
            <Line points={[0, 28, 0, -6]} stroke="#15803d" strokeWidth={4} />
            <Circle x={-12} y={-4} radius={9} fill="#f43f5e" />
            <Circle x={12} y={-8} radius={9} fill="#e11d48" />
            <Circle y={4} radius={9} fill="#fb7185" />
          </>
        )
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

      {item.type === "SPRINKLER_LINE" ? (
        <>
          <Line points={[-38, 10, 38, 10]} stroke="#059669" strokeWidth={5} />
          <Line points={[-28, 10, -28, -2]} stroke="#059669" strokeWidth={3} />
          <Line points={[0, 10, 0, -2]} stroke="#059669" strokeWidth={3} />
          <Line points={[28, 10, 28, -2]} stroke="#059669" strokeWidth={3} />
          <Circle x={-28} y={-6} radius={4} fill="#38bdf8" />
          <Circle x={0} y={-6} radius={4} fill="#38bdf8" />
          <Circle x={28} y={-6} radius={4} fill="#38bdf8" />
        </>
      ) : null}

      {item.type === "DELIVERY_POINT" ? (
        <>
          <Rect x={-5} y={-1} width={10} height={28} fill="#78350f" cornerRadius={2} />
          <Circle y={-12} radius={14} fill="#65a30d" />
          <Circle x={-14} y={-2} radius={11} fill="#65a30d" />
          <Circle x={14} y={-2} radius={11} fill="#65a30d" />
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

      {showPorts
        ? FARM_BACKGROUND_PORT_SIDES.map((side) => {
            const local = getFarmBackgroundPortLocalPoint(side);
            const active = highlighted && linkSourcePort === side;

            return (
              <Circle
                key={side}
                name="flow-background-port"
                id={`${item.id}:${side}`}
                x={local.x}
                y={local.y}
                radius={active ? 8 : 5}
                fill="#ffffff"
                stroke={active ? "#2563eb" : "#16a34a"}
                strokeWidth={2}
                onMouseDown={(event) => {
                  event.cancelBubble = true;
                  onPortDragStart();
                  onSelect(item.id, side);
                }}
                onTap={(event) => {
                  event.cancelBubble = true;
                  onPortDragStart();
                  onSelect(item.id, side);
                }}
              />
            );
          })
        : null}

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
