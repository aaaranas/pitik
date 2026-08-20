import { resolveAdjustments } from "./math";
import {
  CAMERA_PROFILES,
  DEFAULT_FILTER_ID,
  DEFAULT_PROFILE_ID,
  FILTER_PRESETS,
} from "./presets";
import {
  type Adjustments,
  type CameraProfile,
  type FilterCategory,
  type FilterDefinition,
  type ResolvedFilter,
} from "./types";

/**
 * The single source of truth for "what looks are available".
 *
 * Components ask the registry; they never import the preset array directly and
 * they never contain grading maths. That is what lets a future release load
 * user-authored or remotely-published filters by registering them here.
 */
const filters = new Map<string, FilterDefinition>();
const profiles = new Map<string, CameraProfile>();

for (const preset of FILTER_PRESETS) filters.set(preset.id, preset);
for (const profile of CAMERA_PROFILES) profiles.set(profile.id, profile);

export function registerFilter(definition: FilterDefinition): void {
  filters.set(definition.id, definition);
}

export function listFilters(): FilterDefinition[] {
  return [...filters.values()];
}

export function listFilterCategories(): FilterCategory[] {
  const seen: FilterCategory[] = [];
  for (const filter of filters.values()) {
    if (!seen.includes(filter.category)) seen.push(filter.category);
  }
  return seen;
}

export function getFilter(id: string | undefined): FilterDefinition {
  return (id && filters.get(id)) || filters.get(DEFAULT_FILTER_ID)!;
}

export function listProfiles(): CameraProfile[] {
  return [...profiles.values()];
}

export function getProfile(id: string | undefined): CameraProfile {
  return (id && profiles.get(id)) || profiles.get(DEFAULT_PROFILE_ID)!;
}

/**
 * Collapses body + look + any manual user tweaks into one parameter set.
 *
 * The profile is the sensor and the filter is the grade applied to it, so those
 * two *compose* — stacking the Disposable body under a Mono look should keep
 * the body's grain as well as the look's desaturation.
 *
 * User overrides are different: they are assigned, not composed. A slider the
 * user has physically moved has to land on the value shown next to it, and
 * composition can't do that — multiplying a saturation override of 1 into a
 * filter that sets saturation to 0 would leave the image grey no matter where
 * the user dragged the control.
 */
export function composeAdjustments(options: {
  profileId?: string;
  filterId?: string;
  overrides?: Partial<Adjustments>;
}): Adjustments {
  const stacked = resolveAdjustments(
    getProfile(options.profileId).adjustments,
    getFilter(options.filterId).adjustments,
  );
  return { ...stacked, ...options.overrides };
}

export function resolveFilter(id: string | undefined): ResolvedFilter {
  const definition = getFilter(id);
  return { ...definition, adjustments: resolveAdjustments(definition.adjustments) };
}

export { DEFAULT_FILTER_ID, DEFAULT_PROFILE_ID };
