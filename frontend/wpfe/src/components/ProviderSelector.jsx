import React from "react";
import { PROVIDERS } from "../lib/embedProviders";

const ProviderSelector = ({ value, onChange, disabled }) => (
  <label className="provider-selector">
    <span className="provider-selector-label">Video host</span>
    <select
      className="provider-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Video embed provider"
    >
      {Object.entries(PROVIDERS).map(([key, p]) => (
        <option key={key} value={key}>
          {p.name}
        </option>
      ))}
    </select>
  </label>
);

export default ProviderSelector;
