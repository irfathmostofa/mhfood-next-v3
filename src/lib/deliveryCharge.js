import {
  getLocationByKey,
  locationKey,
} from "@/lib/bangladeshLocations";

export const DEFAULT_DELIVERY_CHARGES = {
  same_area: 60,
  same_district: 80,
  same_division: 100,
  outside: 130,
  remote: 160,
};

export function getChargeTiers(settings) {
  return {
    same_area: Number(
      settings?.delivery_same_area_charge ?? DEFAULT_DELIVERY_CHARGES.same_area,
    ),
    same_district: Number(
      settings?.delivery_same_district_charge ??
        DEFAULT_DELIVERY_CHARGES.same_district,
    ),
    same_division: Number(
      settings?.delivery_same_division_charge ??
        DEFAULT_DELIVERY_CHARGES.same_division,
    ),
    outside: Number(
      settings?.delivery_outside_charge ?? DEFAULT_DELIVERY_CHARGES.outside,
    ),
    remote: Number(
      settings?.delivery_remote_charge ?? DEFAULT_DELIVERY_CHARGES.remote,
    ),
  };
}

export function getShopLocation(settings, extras = []) {
  if (!settings) return null;
  const fromKey = getLocationByKey(settings.shop_location_key, extras);
  if (fromKey) return fromKey;
  if (!settings.shop_division || !settings.shop_district || !settings.shop_area) {
    return null;
  }
  return {
    key:
      settings.shop_location_key ||
      locationKey(
        settings.shop_division,
        settings.shop_district,
        settings.shop_area,
      ),
    division: settings.shop_division,
    district: settings.shop_district,
    area: settings.shop_area,
  };
}

function sameText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function parentDistrict(district) {
  const name = String(district || "").trim();
  const idx = name.indexOf(" - ");
  return idx > 0 ? name.slice(0, idx) : name;
}

function sameArea(a, b) {
  return (
    sameText(a?.division, b?.division) &&
    sameText(a?.district, b?.district) &&
    sameText(a?.area, b?.area)
  );
}

function sameDistrict(a, b) {
  return (
    sameText(a?.division, b?.division) &&
    (sameText(a?.district, b?.district) ||
      sameText(parentDistrict(a?.district), parentDistrict(b?.district)))
  );
}

function sameDivision(a, b) {
  return sameText(a?.division, b?.division);
}

export function findLocationOverride(key, extras = []) {
  if (!key) return null;
  return (
    extras.find(
      (row) => (row.location_key || row.key) === String(key) && row.is_active !== false,
    ) || null
  );
}

export function computeDeliveryCharge({
  destination,
  shop,
  tiers,
  overrideCharge,
  isRemote,
} = {}) {
  if (
    overrideCharge != null &&
    overrideCharge !== "" &&
    Number.isFinite(Number(overrideCharge))
  ) {
    return Math.max(0, Number(overrideCharge));
  }

  const charges = { ...DEFAULT_DELIVERY_CHARGES, ...(tiers || {}) };
  if (!destination) return 0;

  const remote =
    isRemote ||
    destination.zoneType === "remote" ||
    destination.is_remote;

  if (remote && !(shop && sameArea(destination, shop))) {
    return Math.max(0, Number(charges.remote) || 0);
  }

  if (!shop) {
    const fallback = Number(destination.charge);
    return Number.isFinite(fallback) ? Math.max(0, fallback) : Math.max(0, Number(charges.outside) || 0);
  }

  if (sameArea(destination, shop)) {
    return Math.max(0, Number(charges.same_area) || 0);
  }
  if (sameDistrict(destination, shop)) {
    return Math.max(0, Number(charges.same_district) || 0);
  }
  if (sameDivision(destination, shop)) {
    return Math.max(0, Number(charges.same_division) || 0);
  }
  return Math.max(0, Number(charges.outside) || 0);
}

export function chargeForLocation(destination, settings, extras = []) {
  if (!destination) return 0;
  const override = findLocationOverride(destination.key, extras);
  return computeDeliveryCharge({
    destination,
    shop: getShopLocation(settings, extras),
    tiers: getChargeTiers(settings),
    overrideCharge: override?.charge,
    isRemote: !!(override?.is_remote || destination.is_remote),
  });
}
