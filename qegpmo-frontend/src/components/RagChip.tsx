import { Chip } from "@mui/material";
import type { RagStatus } from "../types";
import { ragColors } from "../theme";

export const RagChip = ({ value }: { value: RagStatus }) => {
  return (
    <Chip
      size="small"
      label={value}
      sx={{
        minWidth: 78,
        color: "#fff",
        backgroundColor: ragColors[value] ?? ragColors.UNKNOWN
      }}
    />
  );
};
