/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * Service tab section for user-entered duty station locations, rendered
 * between DeploymentsSection and AwardsSection in MyPacket.jsx. Extracted
 * to its own file (unlike its inline MyPacket.jsx siblings) so it — and
 * the lazy-loaded world map it always renders — can be unit/a11y-tested
 * without pulling in the rest of the 6,000+ line MyPacket module.
 *
 * The map (DutyStationMap.jsx) is the sole owner of geoContains-based
 * country derivation; this component only holds primitive draft form
 * state (name/periodId/dates/notes/lat/lon/country) and receives the
 * derived country back via a callback, whether the position came from a
 * map click, the "pick country" dropdown, or the keyboard lat/lon inputs
 * below (all three funnel through the same derivation — criterion 9).
 */
import { lazy, Suspense, useCallback, useState } from "react";
import {
  addDutyStation,
  updateDutyStation,
  removeDutyStation,
} from "../utils/veteranProfile";

const DutyStationMap = lazy(() => import("./DutyStationMap"));

const EMPTY_DRAFT = {
  periodId: "",
  name: "",
  country: "",
  latitude: null,
  longitude: null,
  startDate: "",
  endDate: "",
  notes: "",
};

// placeOfEntry is stored as extracted, e.g. "FORT BRAGG, NC" — title-case
// it for display, but keep a trailing 2-letter segment (a state code)
// uppercase rather than "Nc".
function titleCasePlaceOfEntry(value) {
  if (!value) return "";
  const parts = value.split(",").map((p) => p.trim());
  return parts
    .map((part, i) =>
      i === parts.length - 1 && /^[a-z]{2}$/i.test(part)
        ? part.toUpperCase()
        : part.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(", ");
}

function formatPeriodLabel(period, t) {
  const branch = period.branch || t("myPacketSection.service");
  const start = period.serviceStartDate || "?";
  const end = period.serviceEndDate || t("myPacketSection.present");
  return `${branch} (${start} – ${end})`;
}

function MapFallback() {
  return (
    <div
      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse"
      style={{ aspectRatio: "1000 / 487" }}
    />
  );
}

function PeriodSelect({ servicePeriods, value, onChange, t }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t("myPacketSection.linkedPeriod")}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="">{t("myPacketSection.unassignedPeriod")}</option>
        {servicePeriods.map((p) => (
          <option key={p.id} value={p.id}>
            {formatPeriodLabel(p, t)}
          </option>
        ))}
      </select>
    </div>
  );
}

function CoordinateInputs({ draft, setDraft, t }) {
  const onLat = (e) => {
    const v = e.target.value;
    setDraft((prev) => ({ ...prev, latitude: v === "" ? null : Number(v) }));
  };
  const onLon = (e) => {
    const v = e.target.value;
    setDraft((prev) => ({ ...prev, longitude: v === "" ? null : Number(v) }));
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.latitude")}
        </label>
        <input
          type="number"
          step="0.0001"
          min={-90}
          max={90}
          value={draft.latitude ?? ""}
          onChange={onLat}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.longitude")}
        </label>
        <input
          type="number"
          step="0.0001"
          min={-180}
          max={180}
          value={draft.longitude ?? ""}
          onChange={onLon}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
    </>
  );
}

function DutyStationFormFields({ draft, setDraft, servicePeriods, t }) {
  const onPeriodChange = (e) => {
    const periodId = e.target.value;
    setDraft((prev) => {
      const next = { ...prev, periodId };
      if (!prev.name) {
        const period = servicePeriods.find((p) => p.id === periodId);
        if (period?.placeOfEntry) {
          next.name = titleCasePlaceOfEntry(period.placeOfEntry);
        }
      }
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.stationName")} *
        </label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder={t("myPacketSection.stationNamePlaceholder")}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <PeriodSelect
        servicePeriods={servicePeriods}
        value={draft.periodId}
        onChange={onPeriodChange}
        t={t}
      />
      <div />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.startDate")}
        </label>
        <input
          type="date"
          value={draft.startDate}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, startDate: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.endDate")}
        </label>
        <input
          type="date"
          value={draft.endDate}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, endDate: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
      <CoordinateInputs draft={draft} setDraft={setDraft} t={t} />
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("myPacketSection.notesOptional")}
        </label>
        <textarea
          value={draft.notes}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, notes: e.target.value }))
          }
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  );
}

function DutyStationFormActions({ onSave, onCancel, t }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onSave}
        className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
      >
        {t("myPacketSection.save")}
      </button>
      <button
        onClick={onCancel}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        {t("myPacketSection.cancel")}
      </button>
    </div>
  );
}

function DutyStationEntry({ station, servicePeriods, onEdit, onRemove, t }) {
  const period = servicePeriods.find((p) => p.id === station.periodId);
  const periodLabel = period
    ? formatPeriodLabel(period, t)
    : t("myPacketSection.unassignedPeriod");
  const countryLabel = station.country || t("myPacketSection.atSea");

  return (
    <div className="flex items-start justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {station.name || countryLabel}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {countryLabel} · {periodLabel}
        </p>
        {(station.startDate || station.endDate) && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {station.startDate || "?"} –{" "}
            {station.endDate || t("myPacketSection.present")}
          </p>
        )}
        {station.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {station.notes}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onEdit(station)}
          className="text-sm text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
        >
          {t("myPacketSection.edit")}
        </button>
        <button
          onClick={() => onRemove(station.id)}
          className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
          aria-label={`${t("myPacketSection.removeDutyStation")}: ${station.name}`}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

function useDutyStationForm({ loadServiceHistory }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (station) => {
    setDraft({
      periodId: station.periodId || "",
      name: station.name || "",
      country: station.country || "",
      latitude: station.latitude,
      longitude: station.longitude,
      startDate: station.startDate || "",
      endDate: station.endDate || "",
      notes: station.notes || "",
    });
    setEditingId(station.id);
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const save = () => {
    if (!draft.name.trim()) {
      alert("Please enter a station name");
      return;
    }
    const payload = {
      periodId: draft.periodId || null,
      name: draft.name.trim(),
      country: draft.country || "",
      latitude: draft.latitude,
      longitude: draft.longitude,
      startDate: draft.startDate || null,
      endDate: draft.endDate || null,
      notes: draft.notes || "",
    };
    if (editingId) {
      updateDutyStation(editingId, payload);
    } else {
      addDutyStation(payload);
    }
    loadServiceHistory();
    cancel();
  };

  const remove = (id) => {
    removeDutyStation(id);
    loadServiceHistory();
  };

  // Stable across renders (setDraft is a useState setter) — DutyStationMap
  // re-derives country in a useEffect keyed on this callback's identity, so
  // an unstable reference here re-fires that effect every render and
  // deadlocks React into "Maximum update depth exceeded".
  const handlePositionChange = useCallback((latitude, longitude) => {
    setDraft((prev) => ({ ...prev, latitude, longitude }));
  }, []);
  const handleCountryDerived = useCallback((country) => {
    setDraft((prev) => ({ ...prev, country }));
  }, []);

  return {
    showForm,
    draft,
    setDraft,
    editingId,
    openAdd,
    openEdit,
    cancel,
    save,
    remove,
    handlePositionChange,
    handleCountryDerived,
  };
}

function DutyStationsHeader({ onAdd, t }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          🗺️ {t("myPacketSection.dutyStations")}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("myPacketSection.dutyStationsDescription")}
        </p>
      </div>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shrink-0"
      >
        ➕ {t("myPacketSection.addDutyStation")}
      </button>
    </div>
  );
}

export default function DutyStationsSection({
  serviceHistory,
  veteranProfile,
  loadServiceHistory,
  t,
}) {
  const dutyStations = serviceHistory.dutyStations || [];
  const servicePeriods = veteranProfile.servicePeriods || [];
  const form = useDutyStationForm({ loadServiceHistory });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <DutyStationsHeader onAdd={form.openAdd} t={t} />

      <Suspense fallback={<MapFallback />}>
        <DutyStationMap
          stations={dutyStations}
          draftLatitude={form.draft.latitude}
          draftLongitude={form.draft.longitude}
          onPositionChange={form.handlePositionChange}
          onCountryDerived={form.handleCountryDerived}
          t={t}
        />
      </Suspense>

      {form.showForm && (
        <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 my-4 space-y-4">
          <DutyStationFormFields
            draft={form.draft}
            setDraft={form.setDraft}
            servicePeriods={servicePeriods}
            t={t}
          />
          <DutyStationFormActions onSave={form.save} onCancel={form.cancel} t={t} />
        </div>
      )}

      {dutyStations.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-4">
          {t("myPacketSection.noDutyStationsYet")}
        </p>
      ) : (
        <div className="space-y-3 mt-4">
          {dutyStations.map((station) => (
            <DutyStationEntry
              key={station.id}
              station={station}
              servicePeriods={servicePeriods}
              onEdit={form.openEdit}
              onRemove={form.remove}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
