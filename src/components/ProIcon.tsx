import React from "react";
import Svg, { Rect, Path } from "react-native-svg";

export function ProIcon({ size = 20 }: { size?: number }) {
  const width = size;
  const height = (size * 32) / 51;
  return (
    <Svg width={width} height={height} viewBox="0 0 51 32">
      <Rect width={51} height={32} rx={6} fill="#C49A28" />
      <Path d="M 9 7 L 23 16 L 9 25 Z" fill="white" stroke="white" strokeWidth={2.5} strokeLinejoin="round" />
      <Rect x={28} y={11} width={14} height={3.5} rx={1.75} fill="white" />
      <Rect x={33.25} y={5.75} width={3.5} height={14} rx={1.75} fill="white" />
    </Svg>
  );
}
