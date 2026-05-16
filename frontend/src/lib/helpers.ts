// 1. Розрахунок віку
export const calculateAge = (dateString?: string) => {
  if (!dateString) return null;
  const today = new Date();
  const birthDate = new Date(dateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

// 2. Генерація посилання на прапор
export const getFlagUrl = (
  countryCode?: string,
  size: "w20" | "w40" | "w80" = "w20",
) => {
  if (!countryCode || countryCode === "INT") return null;
  return `https://flagcdn.com/${size}/${countryCode.toLowerCase()}.png`;
};

// 3. Розрахунок K/D
export const calculateKd = (
  kills: number | string = 0,
  deaths: number | string = 0,
) => {
  const k = Number(kills);
  const d = Number(deaths);
  return d > 0 ? (k / d).toFixed(2) : k.toFixed(2);
};
