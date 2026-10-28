export const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

// Exactly these fields, nothing else: rating/userRatingCount land in the Text Search Enterprise SKU,
// and reviews, photos or summaries would cost more. Never add to this list casually.
export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
  'places.primaryType',
  'places.location',
  'places.formattedAddress',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

export class PlacesApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'PlacesApiError';
    this.status = status;
  }
}

/**
 * Request body for one (city, locality, category, page). Page 2 must repeat every
 * parameter of page 1 and only add pageToken, otherwise Google answers INVALID_ARGUMENT.
 */
export function buildRequestBody({ city, locality, category, pageToken }) {
  const body = {
    textQuery: `${category.textQuery} in ${locality.name}, ${city.name}`,
    includedType: category.includedType,
    strictTypeFiltering: true,
    locationRestriction: { rectangle: locality.rectangle },
    minRating: category.minRating,
    pageSize: 20,
  };
  if (category.priceLevels?.length) body.priceLevels = category.priceLevels;
  if (pageToken) body.pageToken = pageToken;
  return body;
}

/**
 * Text Search (New) client. Every network attempt, retries included, first goes through
 * guard.reserve(), which throws QuotaExceededError before anything is sent.
 * The key is never logged and is scrubbed from any error text.
 */
export function createPlacesClient({
  apiKey,
  guard,
  fetchImpl = globalThis.fetch,
  maxRetries = 2,
  baseDelayMs = 1000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set. Add it to .env (see .env.example).');
  if (!guard) throw new Error('A quota guard is required.');
  const redact = (text) => String(text).split(apiKey).join('***');

  async function searchText(body) {
    for (let attempt = 0; ; attempt++) {
      guard.reserve();
      let res;
      try {
        res = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': FIELD_MASK,
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new PlacesApiError(`Network error calling Places API: ${redact(err.message)}`, 0);
      }
      if (res.ok) return res.json();

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < maxRetries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      let detail = '';
      try {
        detail = (await res.json())?.error?.message ?? '';
      } catch {
        /* body wasn't JSON */
      }
      throw new PlacesApiError(`Places API HTTP ${res.status}${detail ? `: ${redact(detail)}` : ''}`, res.status);
    }
  }

  return { searchText };
}
