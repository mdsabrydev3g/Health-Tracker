import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b0ff",
          500: "#338ffb",
          600: "#1d6ff0",
          700: "#1558dd",
          800: "#1848b3",
          900: "#1a408d",
          950: "#142a5c",
        },
      },
      fontSize: {
        "mother-body": ["20px", "30px"],
        "mother-btn": ["24px", "32px"],
      },
      minHeight: { touch: "48px" },
      minWidth: { touch: "48px" },
    },
  },
  plugins: [],
};
export default config;
