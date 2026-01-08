// SWR configuration and fetcher
export const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Default SWR options for the app
export const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // Cache for 1 minute
  errorRetryCount: 2,
};
