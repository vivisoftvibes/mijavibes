/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './node_modules/nativewind/dist/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // SaludAlDía brand colors
        primary: '#0066CC',
        'primary-dark': '#0052A3',
        'primary-light': '#3385D6',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        neutral: '#6B7280',
        'bg-primary': '#FFFFFF',
        'bg-secondary': '#F3F4F6',
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        'border-light': '#E5E7EB',
      },
      spacing: {
        safe: 'env(safe-area-inset)',
      },
    },
  },
  plugins: [],
};
