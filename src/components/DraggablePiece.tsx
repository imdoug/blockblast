import React, { useRef } from "react";
import { View, PanResponder, StyleSheet } from "react-native";
import { Piece } from "../types";
import { CELL_SIZE, CELL_GAP } from "../constants/theme";

const LIFT_OFFSET = 90;
const CELL_STEP = CELL_SIZE + CELL_GAP;

interface Props {
  piece: Piece;
  trayIndex: number;
  isSelected: boolean;
  gridOrigin: { x: number; y: number } | null;
  onSelect: (index: number) => void;
  onDrop: (row: number, col: number) => void;
  onGhostChange: (row: number, col: number) => void;
  onDragEnd: () => void;
}

export function DraggablePiece({
  piece, trayIndex, isSelected, gridOrigin,
  onSelect, onDrop, onGhostChange, onDragEnd,
}: Props) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onSelect(trayIndex);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!gridOrigin) return;
        const fingerX = gestureState.moveX;
        const fingerY = gestureState.moveY - LIFT_OFFSET;
        const col = Math.floor((fingerX - gridOrigin.x) / CELL_STEP);
        const row = Math.floor((fingerY - gridOrigin.y) / CELL_STEP);
        const pieceRow = row - Math.floor(piece.shape.length / 2);
        const pieceCol = col - Math.floor(piece.shape[0].length / 2);
        onGhostChange(pieceRow, pieceCol);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!gridOrigin) { onDragEnd(); return; }
        const fingerX = gestureState.moveX;
        const fingerY = gestureState.moveY - LIFT_OFFSET;
        const col = Math.floor((fingerX - gridOrigin.x) / CELL_STEP);
        const row = Math.floor((fingerY - gridOrigin.y) / CELL_STEP);
        const pieceRow = row - Math.floor(piece.shape.length / 2);
        const pieceCol = col - Math.floor(piece.shape[0].length / 2);
        onDrop(pieceRow, pieceCol);
        onDragEnd();
      },
    })
  ).current;

  const MINI = 14;

  return (
    <View {...panResponder.panHandlers}>
      {piece.shape.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((cell, c) => (
            <View
              key={c}
              style={{
                width: MINI,
                height: MINI,
                margin: 1,
                borderRadius: 3,
                backgroundColor: cell
                  ? `hsl(${trayIndex * 45}, 70%, 60%)`
                  : "transparent",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}