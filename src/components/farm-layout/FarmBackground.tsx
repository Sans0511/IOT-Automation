import { Circle, Group, Line, Rect, Text } from "react-konva";

const SOIL_BEDS = [
  { x: 120, y: 180, width: 300, height: 130, label: "Plot A" },
  { x: 450, y: 180, width: 300, height: 130, label: "Plot B" },
  { x: 780, y: 180, width: 300, height: 130, label: "Plot C" },
  { x: 120, y: 430, width: 300, height: 130, label: "Plot D" },
  { x: 450, y: 430, width: 300, height: 130, label: "Plot E" },
  { x: 780, y: 430, width: 300, height: 130, label: "Plot F" },
];

export default function FarmBackground({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Group listening={false}>
      <Rect width={width} height={height} fill="#e8f3dc" />

      <Rect
        x={32}
        y={32}
        width={width - 64}
        height={height - 64}
        fill="#dceecb"
        stroke="#5f8b4a"
        strokeWidth={4}
        cornerRadius={18}
      />

      <Rect x={88} y={96} width={width - 176} height={26} fill="#d9c6a5" />
      <Rect x={88} y={350} width={width - 176} height={26} fill="#d9c6a5" />
      <Rect x={88} y={600} width={width - 176} height={26} fill="#d9c6a5" />
      <Rect x={420} y={96} width={26} height={530} fill="#d9c6a5" />
      <Rect x={750} y={96} width={26} height={530} fill="#d9c6a5" />

      <Line
        points={[70, 140, width - 70, 140]}
        stroke="#22c55e"
        strokeWidth={6}
        dash={[18, 12]}
        opacity={0.75}
      />
      <Line
        points={[70, width / 2 + 5, width - 70, width / 2 + 5]}
        stroke="#22c55e"
        strokeWidth={6}
        dash={[18, 12]}
        opacity={0.75}
      />
      <Line
        points={[70, 660, width - 70, 660]}
        stroke="#22c55e"
        strokeWidth={6}
        dash={[18, 12]}
        opacity={0.75}
      />

      {SOIL_BEDS.map((bed) => (
        <Group key={bed.label}>
          <Rect
            x={bed.x}
            y={bed.y}
            width={bed.width}
            height={bed.height}
            fill="#b98559"
            stroke="#8a5c39"
            strokeWidth={2}
            cornerRadius={10}
          />
          {[1, 2, 3].map((row) => (
            <Line
              key={row}
              points={[
                bed.x + 14,
                bed.y + (bed.height / 4) * row,
                bed.x + bed.width - 14,
                bed.y + (bed.height / 4) * row,
              ]}
              stroke="#9b6b46"
              strokeWidth={3}
              dash={[10, 8]}
            />
          ))}
          <Text
            x={bed.x + 12}
            y={bed.y + 10}
            text={bed.label}
            fontSize={15}
            fontStyle="bold"
            fill="#4b2f1c"
          />
        </Group>
      ))}

      <Circle
        x={110}
        y={90}
        radius={34}
        fill="#86efac"
        stroke="#16a34a"
        strokeWidth={3}
      />
      <Text
        x={78}
        y={132}
        text="Water tank"
        fontSize={13}
        fill="#065f46"
      />

      <Rect
        x={width - 210}
        y={64}
        width={130}
        height={64}
        fill="#f4e2b8"
        stroke="#a9813f"
        strokeWidth={3}
        cornerRadius={8}
      />
      <Text
        x={width - 197}
        y={88}
        text="Pump house"
        fontSize={14}
        fontStyle="bold"
        fill="#6d5021"
      />

      <Line
        points={[144, 90, 420, 90, 420, 160, 450, 160]}
        stroke="#22c55e"
        strokeWidth={5}
        lineJoin="round"
      />
      <Text
        x={60}
        y={height - 82}
        text="Generic farm layout"
        fontSize={14}
        fill="#557348"
        opacity={0.8}
      />
    </Group>
  );
}
