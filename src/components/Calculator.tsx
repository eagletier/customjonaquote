"use client";

import { useMemo, useState } from "react";
import ccb from "../data/ccb.json";

type Option = { optionText: string; optionValue: string; optionHint?: string };
type Field = {
  _id: number;
  type: "Drop Down" | "Toggle" | "Checkbox" | "Line";
  label: string;
  description?: string;
  alias?: string;
  options?: Option[];
};
type CalculatorData = {
  ccb_name: string;
  ccb_fields: Field[];
};

const calculator = ((ccb as any).calculators?.[0] || {}) as CalculatorData;

export default function Calculator() {
  const [dropdownValues, setDropdownValues] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const total = useMemo(() => {
    let sum = 0;
    Object.values(dropdownValues).forEach(v => (sum += v || 0));
    calculator.ccb_fields?.forEach(f => {
      if ((f.type === "Toggle" || f.type === "Checkbox") && f.options) {
        f.options.forEach(o => {
          const key = `${f.alias}:${o.optionText}`;
          if (checked[key]) sum += Number(o.optionValue || 0);
        });
      }
    });
    return sum;
  }, [dropdownValues, checked]);

  if (!calculator?.ccb_fields) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">No calculator found</h1>
        <p className="text-neutral-600">Make sure src/data/ccb.json exists and is valid JSON.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{calculator.ccb_name || "Calculator"}</h1>
        <div className="text-xl font-bold">
          Total: ${total.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {calculator.ccb_fields.map(f => {
          if (f.type === "Line") {
            return <div key={f._id} className="md:col-span-2"><hr className="border-t" /></div>;
          }

          if (f.type === "Drop Down") {
            const alias = f.alias || `drop_${f._id}`;
            return (
              <div key={f._id} className="space-y-2">
                <label className="block text-sm font-medium">{f.label}</label>
                <select
                  className="w-full rounded border p-2"
                  defaultValue=""
                  onChange={e =>
                    setDropdownValues(s => ({ ...s, [alias]: Number(e.target.value || 0) }))
                  }
                >
                  <option value="">Select…</option>
                  {(f.options || []).map(o => (
                    <option key={o.optionText} value={o.optionValue}>
                      {o.optionText} (${Number(o.optionValue || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
                {f.description && <p className="text-xs text-neutral-600">{f.description}</p>}
              </div>
            );
          }

          if (f.type === "Toggle" || f.type === "Checkbox") {
            return (
              <div key={f._id} className="space-y-2">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="space-y-1">
                  {(f.options || []).map(o => {
                    const key = `${f.alias}:${o.optionText}`;
                    const isChecked = !!checked[key];
                    return (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={isChecked}
                          onChange={e => setChecked(s => ({ ...s, [key]: e.target.checked }))}
                        />
                        <span className="text-sm">
                          {o.optionText} — ${Number(o.optionValue || 0).toLocaleString()}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {f.description && <p className="text-xs text-neutral-600">{f.description}</p>}
              </div>
            );
          }

          return null;
        })}
      </div>

      <footer className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-neutral-600">Live running total updates as you select.</div>
        <div className="text-xl font-bold">
          Total: ${total.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}
        </div>
      </footer>
    </div>
  );
}

