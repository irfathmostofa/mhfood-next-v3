"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import {
  formatLocation,
  getAreas,
  getDistricts,
  getDivisions,
  getLocationByKey,
  locationKey,
  searchLocations,
} from "@/lib/bangladeshLocations";

const STEPS = ["division", "district", "area"];

export default function LocationSelect({
  value = "",
  onChange,
  freeDelivery = false,
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState("division");
  const [draft, setDraft] = useState({ division: "", district: "", area: "" });

  const selected = getLocationByKey(value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, step]);

  const options = useMemo(() => {
    const q = query.trim();
    if (q) {
      return searchLocations(q, {
        division: step === "district" || step === "area" ? draft.division : "",
        district: step === "area" ? draft.district : "",
      }).slice(0, 80);
    }
    if (step === "division") {
      return getDivisions().map((name) => ({
        key: name,
        label: name,
        type: "division",
      }));
    }
    if (step === "district") {
      return getDistricts(draft.division).map((name) => ({
        key: name,
        label: name,
        type: "district",
      }));
    }
    return getAreas(draft.division, draft.district).map((area) => ({
      key: locationKey(draft.division, draft.district, area.name),
      label: area.name,
      charge: area.charge,
      type: "area",
    }));
  }, [query, step, draft.division, draft.district]);

  function openPicker() {
    setOpen(true);
    setQuery("");
    if (selected) {
      setDraft({
        division: selected.division,
        district: selected.district,
        area: selected.area,
      });
      setStep("area");
    } else {
      setDraft({ division: "", district: "", area: "" });
      setStep("division");
    }
  }

  function pickDivision(name) {
    setDraft({ division: name, district: "", area: "" });
    setStep("district");
    setQuery("");
  }

  function pickDistrict(name) {
    setDraft((prev) => ({ ...prev, district: name, area: "" }));
    setStep("area");
    setQuery("");
  }

  function pickArea(loc) {
    const next =
      loc?.division && loc?.area
        ? loc
        : getLocationByKey(loc?.key) ||
          getLocationByKey(
            locationKey(draft.division, draft.district, loc.label || loc.area),
          );
    if (!next) return;
    onChange?.(next);
    setDraft({
      division: next.division,
      district: next.district,
      area: next.area,
    });
    setOpen(false);
    setQuery("");
  }

  function goStep(nextStep) {
    setStep(nextStep);
    setQuery("");
    if (nextStep === "division") {
      setDraft({ division: "", district: "", area: "" });
    } else if (nextStep === "district") {
      setDraft((prev) => ({ ...prev, district: "", area: "" }));
    }
  }

  function clear() {
    onChange?.(null);
    setDraft({ division: "", district: "", area: "" });
    setStep("division");
    setQuery("");
  }

  const display = selected ? formatLocation(selected) : "";
  const placeholder =
    step === "division"
      ? "Search or choose division"
      : step === "district"
        ? "Search or choose district"
        : "Search or choose area";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={openPicker}
        className="input w-full text-left flex items-center justify-between gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={display ? "text-ink truncate" : "text-muted truncate"}>
          {display || "Select division, district and area"}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {display && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  clear();
                }
              }}
              className="text-muted hover:text-ink"
              aria-label="Clear location"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className="text-muted" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-line bg-surface shadow-lg overflow-hidden">
          <div className="p-2 border-b border-line">
            <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
              <Search size={14} className="text-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-2 text-xs">
              {STEPS.map((s, i) => {
                const label =
                  s === "division"
                    ? draft.division || "Division"
                    : s === "district"
                      ? draft.district || "District"
                      : draft.area || "Area";
                const active = step === s;
                const done =
                  (s === "division" && draft.division) ||
                  (s === "district" && draft.district) ||
                  (s === "area" && draft.area);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (s === "division") goStep(s);
                      else if (s === "district" && draft.division) goStep(s);
                      else if (s === "area" && draft.district) goStep(s);
                    }}
                    className={`px-2 py-1 rounded-full ${
                      active
                        ? "bg-primary text-white"
                        : done
                          ? "bg-primary/10 text-ink"
                          : "text-muted"
                    }`}
                  >
                    {i + 1}. {label}
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {options.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted text-center">
                No matching area found.
              </li>
            )}
            {options.map((opt) => {
              if (query.trim()) {
                return (
                  <li key={opt.key}>
                    <button
                      type="button"
                      onClick={() => pickArea(opt)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5"
                    >
                      <span className="block text-ink">
                        {formatLocation(opt)}
                      </span>
                      <span className="block text-xs text-muted mt-0.5">
                        {freeDelivery ? "FREE" : `৳${Number(opt.charge).toFixed(0)}`}
                      </span>
                    </button>
                  </li>
                );
              }
              if (step === "division") {
                return (
                  <li key={opt.key}>
                    <button
                      type="button"
                      onClick={() => pickDivision(opt.label)}
                      className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-primary/5"
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              }
              if (step === "district") {
                return (
                  <li key={opt.key}>
                    <button
                      type="button"
                      onClick={() => pickDistrict(opt.label)}
                      className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-primary/5"
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              }
              return (
                <li key={opt.key}>
                  <button
                    type="button"
                    onClick={() => pickArea(opt)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 flex items-center justify-between gap-3"
                  >
                    <span className="text-ink">{opt.label}</span>
                    <span className="text-xs text-muted shrink-0">
                      {freeDelivery ? "FREE" : `৳${Number(opt.charge).toFixed(0)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
