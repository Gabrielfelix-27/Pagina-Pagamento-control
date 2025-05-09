import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    'import.meta.env.VITE_STRIPE_PUBLIC_KEY': JSON.stringify('pk_test_51RFmAZRwUl4uJKT1BkJVrrgZgSXaMQzD6Z1ChAD855BrDlHZWStPhogtounwGLr6FpNXITkUQo8OFjLEG1BfNk5K0016UxHWuj'),
  }
});
