export const getWinRateStatus = (wr: number): "GOOD" | "AVERAGE" | "POOR" => {
  if (wr >= 54) return "GOOD";
  if (wr >= 48) return "AVERAGE";
  return "POOR";
};

export const getCS2FieldStatus = (
  field: "adr" | "kpr" | "dpr",
  val: number,
): "GOOD" | "AVERAGE" | "POOR" => {
  if (field === "adr")
    return val >= 85 ? "GOOD" : val >= 72 ? "AVERAGE" : "POOR";
  if (field === "kpr")
    return val >= 0.75 ? "GOOD" : val >= 0.65 ? "AVERAGE" : "POOR";
  if (field === "dpr")
    return val <= 0.65 ? "GOOD" : val <= 0.75 ? "AVERAGE" : "POOR"; // Інвертовано (менше = краще)
  return "AVERAGE";
};

export const getDotaFieldStatus = (
  field: "gpm" | "xpm" | "netWorth",
  val: number,
): "GOOD" | "AVERAGE" | "POOR" => {
  if (val === 0) return "POOR";
  if (field === "gpm")
    return val >= 650 ? "GOOD" : val >= 450 ? "AVERAGE" : "POOR";
  if (field === "xpm")
    return val >= 700 ? "GOOD" : val >= 500 ? "AVERAGE" : "POOR";
  if (field === "netWorth")
    return val >= 20000 ? "GOOD" : val >= 12000 ? "AVERAGE" : "POOR";
  return "AVERAGE";
};
