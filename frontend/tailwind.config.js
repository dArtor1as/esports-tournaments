/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        esports: {
          primary: "#025E73", //  (Основний колір)
          dark: "#011F26", //  (Фон)
          muted: "#A5A692", //  (Приглушений текст)
          light: "#BFB78F", //  (Світлі картки / текст)
          accent: "#F2A71B", //  (Кнопки, акценти, попередження)
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
