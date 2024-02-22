import { createFetch } from "ofetch";

const $yeet = createFetch({
  Headers: globalThis.Headers,
  fetch: globalThis.fetch,
  defaults: {
    baseURL: "http://localhost:5555/api",
    headers: {
      Accept: "application/json",
    },
    // Default is 1 attemp, we want to give it 3 shots
    retry: 2,
    /*
     * Retry logic.
     *
     * If the server sends a retry-after, try to respect that,
     * else use exponential backoff algo based on the attempts
     * */
    retryDelay: ({ attempt, response }) => {
      let rawRetryAfter = response.headers.get("Retry-After");
      let retryAfterSeconds = Number.parseInt(rawRetryAfter);
      if (
        Number.isNaN(retryAfterSeconds) ||
        !Number.isSafeInteger(retryAfterSeconds)
      ) {
        retryAfterSeconds = 0;
      }

      if (retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
      }

      // Default, behavior if the server hasn't suggested a delay
      return exponentialBackoffDelay(attempt);
    },
  },
});

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function exponentialBackoffDelay(attempts: number) {
  const CAP = 2000;
  const BASE = 10;
  let sleep = randomBetween(0, Math.min(CAP, BASE * 2 ** attempts));
  return sleep;
}

type Res = {
  next: null | string;
  prev: null | string;
  count: number;
  results: ReadonlyArray<any>;
};

export async function callEndpoint() {
  let first = await $yeet<Res>("/products", {
    params: {
      offset: 0,
      limit: 1,
    },
  });

  /*
   * Call each page of the paginated api in parallel by computing
   * the offset and limit of each page
   * */
  let totalCount = first.count;
  let pageSize = 100;
  let numberOfPages = Math.ceil(totalCount / pageSize);

  let tasks = Array.from({ length: numberOfPages }, (_, i) => {
    let offset = i * pageSize + 1;
    return $yeet("/products", {
      params: {
        offset,
        limit: pageSize,
      },
    });
  });
  let restResults = await Promise.all(tasks);

  let allResults = [
    first.results.at(0),
    ...restResults.map((res) => res.results).flat(),
  ];

  console.info({
    allResultsCount: allResults.length,
  });

  return allResults;
}
