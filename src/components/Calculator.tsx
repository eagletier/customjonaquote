"use client";

import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import ccbJson from "../data/ccb.json";

// ---- Types ----
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
type CcbRoot = { calculators?: CalculatorData[] };

// ---- Data (typed, no `any`) ----
const ccbRoot = ccbJson as unknown as CcbRoot;
const calculator: CalculatorData | null = ccbRoot.calculators?.[0] ?? null;

// ---- Helpers ----
const toNum = (v?: string | number) =>
  (typeof v === "number" ? v : Number(v || 0)) || 0;

const formatUSD = (n: number) =>
  `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ---- Component ----
export default function Calculator() {
  // Dropdown: store both numeric value and selected label so we can print it on the PDF
  const [dropdownValues, setDropdownValues] = useState<Record<string, number>>(
    {}
  );
  const [dropdownLabels, setDropdownLabels] = useState<Record<string, string>>(
    {}
  );

  // Toggles/Checkboxes: `${alias}:${optionText}` => boolean
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Compute the running total
  const total = useMemo(() => {
    let sum = 0;
    Object.values(dropdownValues).forEach((v) => (sum += v || 0));

    calculator?.ccb_fields?.forEach((f: Field) => {
      if ((f.type === "Toggle" || f.type === "Checkbox") && f.options) {
        f.options.forEach((o) => {
          const key = `${f.alias}:${o.optionText}`;
          if (checked[key]) sum += toNum(o.optionValue);
        });
      }
    });

    return sum;
  }, [dropdownValues, checked]);

  // Build an itemized array of selections for the PDF
  function buildSelections(): Array<{
    section: string;
    item: string;
    price: number;
  }> {
    const rows: Array<{ section: string; item: string; price: number }> = [];

    // Dropdown selections
    calculator?.ccb_fields?.forEach((f: Field) => {
      if (f.type === "Drop Down") {
        const alias = f.alias || `drop_${f._id}`;
        const value = dropdownValues[alias];
        const label = dropdownLabels[alias];
        if (value && label) {
          rows.push({ section: f.label, item: label, price: value });
        }
      }
    });

    // Toggle/Checkbox selections
    calculator?.ccb_fields?.forEach((f: Field) => {
      if ((f.type === "Toggle" || f.type === "Checkbox") && f.options) {
        f.options.forEach((o) => {
          const key = `${f.alias}:${o.optionText}`;
          if (checked[key]) {
            rows.push({
              section: f.label,
              item: o.optionText,
              price: toNum(o.optionValue),
            });
          }
        });
      }
    });

    return rows;
  }

  // Generate the PDF
  function handleDownloadPdf() {
    const rows = buildSelections();

    // Guard: nothing selected
    const somethingSelected =
      rows.length > 0 || Object.values(dropdownValues).some((v) => v > 0);
    if (!somethingSelected) {
      alert("Please make some selections before submitting.");
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;

    // Header
    let y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(calculator?.ccb_name || "Quote", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const date = new Date().toLocaleString();
    doc.text(`Issued: ${date}`, pageWidth - margin, y, { align: "right" });

    y += 24;

    // Table header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Section", margin, y);
    doc.text("Item", margin + 180, y);
    doc.text("Price", pageWidth - margin, y, { align: "right" });

    y += 12;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    // Table rows
    doc.setFont("helvetica", "normal");
    y += 16;

    const lineHeight = 18;
    rows.forEach((r) => {
      // page break check
      if (y > pageHeight - margin - 100) {
        doc.addPage();
        y = margin;

        // Reprint table header on new page
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Section", margin, y);
        doc.text("Item", margin + 180, y);
        doc.text("Price", pageWidth - margin, y, { align: "right" });
        y += 12;
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 16;
        doc.setFont("helvetica", "normal");
      }

      // Row text
      doc.text(r.section, margin, y);
      // Wrap item text manually if long
      const itemMaxWidth = pageWidth - margin * 2 - 260;
      const itemLines = doc.splitTextToSize(r.item, itemMaxWidth);
      doc.text(itemLines, margin + 180, y);

      doc.text(formatUSD(r.price), pageWidth - margin, y, { align: "right" });

      // Advance Y by number of lines used
      y += lineHeight * Math.max(1, itemLines.length);
    });

    // Divider
    y += 8;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 20;

    // Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Total:", pageWidth - margin - 120, y);
    doc.text(formatUSD(total), pageWidth - margin, y, { align: "right" });

    // Footer note
    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      "Thank you! This PDF lists the options you selected with a running total.",
      margin,
      y
    );

    // Filename
    const safeDate = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `JO-NA_Quote_${safeDate}.pdf`;
    doc.save(filename);
  }

  if (!calculator || !calculator.ccb_fields) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">No calculator found</h1>
        <p className="text-neutral-600">
          Make sure <code>src/data/ccb.json</code> exists and is valid JSON.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {calculator.ccb_name || "Calculator"}
        </h1>
        <div className="text-xl font-bold">Total: {formatUSD(total)}</div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {calculator.ccb_fields.map((f: Field) => {
          if (f.type === "Line") {
            return (
              <div key={f._id} className="md:col-span-2">
                <hr className="border-t" />
              </div>
            );
          }

          if (f.type === "Drop Down") {
            const alias = f.alias || `drop_${f._id}`;
            return (
              <div key={f._id} className="space-y-2">
                <label className="block text-sm font-medium">{f.label}</label>
                <select
                  className="w-full rounded border p-2"
                  defaultValue=""
                  onChange={(e) => {
                    const val = Number(e.target.value || 0);
                    const text =
                      f.options?.find(
                        (o) => String(o.optionValue) === e.target.value
                      )?.optionText || "";
                    setDropdownValues((s) => ({ ...s, [alias]: val }));
                    setDropdownLabels((s) => ({ ...s, [alias]: text }));
                  }}
                >
                  <option value="">Select…</option>
                  {(f.options || []).map((o) => (
                    <option key={o.optionText} value={o.optionValue}>
                      {o.optionText} ({formatUSD(toNum(o.optionValue))})
                    </option>
                  ))}
                </select>
                {f.description && (
                  <p className="text-xs text-neutral-600">{f.description}</p>
                )}
              </div>
            );
          }

          if (f.type === "Toggle" || f.type === "Checkbox") {
            return (
              <div key={f._id} className="space-y-2">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="space-y-1">
                  {(f.options || []).map((o) => {
                    const key = `${f.alias}:${o.optionText}`;
                    const isChecked = !!checked[key];
                    return (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={isChecked}
                          onChange={(e) =>
                            setChecked((s) => ({
                              ...s,
                              [key]: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-sm">
                          {o.optionText} — {formatUSD(toNum(o.optionValue))}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {f.description && (
                  <p className="text-xs text-neutral-600">{f.description}</p>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>

      <footer className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-neutral-600">
          Live running total updates as you select.
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPdf}
            className="rounded bg-black px-4 py-2 text-white hover:opacity-90"
          >
            Submit &amp; Download PDF
          </button>
          <div className="text-xl font-bold">Total: {formatUSD(total)}</div>
        </div>
      </footer>
    </div>
  );
}

