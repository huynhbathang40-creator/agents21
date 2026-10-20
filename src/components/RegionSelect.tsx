import { REGIONS, type Region } from "../lib/platforms";
import { Select } from "./Select";

interface Props {
  value: Region;
  onChange: (region: Region) => void;
  /** Helper text shown next to the control (e.g. when the region doesn't apply). */
  hint?: string;
}

export function RegionSelect({ value, onChange, hint }: Props) {
  return (
    <Select label="Region" value={value} onChange={onChange} hint={hint}>
      {REGIONS.map((r) => (
        <option key={r.code} value={r.code}>
          {r.label}
        </option>
      ))}
    </Select>
  );
}
