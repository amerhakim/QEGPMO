import React from "react";

type Rag = "GREEN" | "AMBER" | "RED";

const palette: Record<Rag, string> = {
  GREEN: "#127C4F",
  AMBER: "#B7791F",
  RED: "#C53030",
};

export function RagPill({ value }: { value: Rag }) {
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: 70,
        textAlign: "center",
        fontWeight: 700,
        borderRadius: 12,
        padding: "2px 10px",
        color: "white",
        backgroundColor: palette[value],
      }}
    >
      {value}
    </span>
  );
}
