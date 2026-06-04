import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const FILTER_EMPTY_VALUE = '__empty_filter__';
const normalizeFilterValue = (value) => (String(value ?? '') === '' ? FILTER_EMPTY_VALUE : String(value));

export const FilterSelect = ({ value, onChange, placeholder, options, style, className }) => (
  <Select value={normalizeFilterValue(value)} onValueChange={(next) => onChange(next === FILTER_EMPTY_VALUE ? '' : next)}>
    <SelectTrigger className={`finance-radix-select-trigger ${className || ''}`} style={style}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className="finance-radix-select-content">
      {(options || []).map((option) => (
        <SelectItem
          key={normalizeFilterValue(option?.value)}
          value={normalizeFilterValue(option?.value)}
          className="finance-radix-select-item"
        >
          {option?.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
