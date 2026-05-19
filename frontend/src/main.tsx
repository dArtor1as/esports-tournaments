import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';

// Створюємо клієнт з налаштуваннями за замовчуванням
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // не робити запит при поверненні на вкладку браузера
      retry: false, // не повторювати запит при помилці (щоб не спамити бекенд)
      staleTime: 5 * 60 * 1000, // дані вважаються свіжими 5 хвилин
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
