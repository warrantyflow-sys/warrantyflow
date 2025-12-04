import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        retry: 1,
        refetchOnMount: true,
        gcTime: 5 * 60 * 1000,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // בשרת: תמיד צור קליינט חדש לחלוטין
    return makeQueryClient();
  } else {
    // בדפדפן: צור פעם אחת ושמור
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}