export type ConsignmentPlaceRow = {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  distance_mi: number;
};

/**
 * Browser geolocation + GET /api/places/consignment (auth cookies).
 * Uses only the consignment route — not /api/contextual-places (donation/thrift).
 */
export function fetchConsignmentPlacesClient(): Promise<ConsignmentPlaceRow[]> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve([]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        void fetch(
          `/api/places/consignment?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
          { credentials: "include" }
        )
          .then(async (r) => {
            if (!r.ok) return [];
            const d = (await r.json()) as { places?: ConsignmentPlaceRow[] };
            return Array.isArray(d.places) ? d.places : [];
          })
          .then((places) => resolve(places))
          .catch(() => resolve([]));
      },
      () => resolve([])
    );
  });
}
