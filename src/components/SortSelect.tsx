import { SORT_KEYS, SORT_LABELS, type SortKey } from "../lib/sort";
import { Select } from "./Select";

interface Props {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}

export function SortSelect({ value, onChange }: Props) {
  return (
    <Select label="Sort by" value={value} onChange={onChange}>
      {SORT_KEYS.map((key) => (
        <option key={key} value={key}>
          {SORT_LABELS[key]}
        </option>
      ))}
    </Select>
  );
}
