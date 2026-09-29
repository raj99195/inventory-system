/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316', // primary
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12'
        },
        ink: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A'
        },
        soft: {
          green: '#D1FAE5',
          blue:  '#DBEAFE',
          pink:  '#FCE7F3',
          orange:'#FFEDD5',
          yellow:'#FEF3C7',
          purple:'#EDE9FE'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        pop:  '0 10px 25px -5px rgba(249,115,22,0.25)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
};
