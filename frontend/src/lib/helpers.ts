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
  size: 'w20' | 'w40' | 'w80' = 'w20',
) => {
  if (!countryCode || countryCode === 'INT') return null;
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
// 4. Визначення слова для віку
export const getAgeWord = (age: number): string => {
  const lastDigit = age % 10;
  const lastTwoDigits = age % 100;

  // Виняток для 11, 12, 13, 14 (завжди "років")
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'років';
  }
  // Закінчується на 1 (1, 21, 31...) -> "рік"
  if (lastDigit === 1) {
    return 'рік';
  }
  // Закінчується на 2, 3, 4 (2, 22, 24...) -> "роки"
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'роки';
  }
  // Все інше (0, 5, 6, 7, 8, 9) -> "років"
  return 'років';
};
