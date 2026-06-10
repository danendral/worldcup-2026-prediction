// Map team name -> ISO 3166-1 alpha-2 for FlagCDN. Covers every team that can
// appear in the 2026 field (incl. resolved playoff slots). Fallback: undefined.
const ISO: Record<string, string> = {
  Argentina: "ar",
  Brazil: "br",
  Uruguay: "uy",
  Colombia: "co",
  Ecuador: "ec",
  Paraguay: "py",
  Spain: "es",
  France: "fr",
  England: "gb-eng",
  Germany: "de",
  Portugal: "pt",
  Netherlands: "nl",
  Belgium: "be",
  Croatia: "hr",
  Switzerland: "ch",
  Austria: "at",
  Norway: "no",
  Scotland: "gb-sct",
  Turkey: "tr",
  Sweden: "se",
  "Czech Republic": "cz",
  "Bosnia & Herzegovina": "ba",
  Mexico: "mx",
  USA: "us",
  Canada: "ca",
  Panama: "pa",
  Haiti: "ht",
  "Curaçao": "cw",
  Morocco: "ma",
  Senegal: "sn",
  Egypt: "eg",
  Ghana: "gh",
  "Côte d'Ivoire": "ci",
  Tunisia: "tn",
  Algeria: "dz",
  "Cabo Verde": "cv",
  "South Africa": "za",
  "DR Congo": "cd",
  Japan: "jp",
  "South Korea": "kr",
  Iran: "ir",
  Australia: "au",
  "Saudi Arabia": "sa",
  Qatar: "qa",
  Uzbekistan: "uz",
  Jordan: "jo",
  Iraq: "iq",
  "New Zealand": "nz",
};

export function flagUrl(team: string, w = 40): string | null {
  const code = ISO[team];
  if (!code) return null;
  return `https://flagcdn.com/w${w}/${code}.png`;
}

export function flagSrcSet(team: string): string | null {
  const code = ISO[team];
  if (!code) return null;
  return `https://flagcdn.com/w40/${code}.png 1x, https://flagcdn.com/w80/${code}.png 2x`;
}

export function teamCode(team: string): string {
  return (ISO[team] || team.slice(0, 2)).toUpperCase().replace("GB-", "");
}

export const CONF_COLOR: Record<string, string> = {
  CONMEBOL: "#2dd4a7",
  UEFA: "#5b8def",
  CONCACAF: "#e8b542",
  CAF: "#e0584f",
  AFC: "#a86bd9",
  OFC: "#9aa0a8",
  "—": "#8a8f99",
};

// Full confederation names + the region they govern (for tooltips).
export const CONF_NAME: Record<string, string> = {
  UEFA: "UEFA — Europe",
  CONMEBOL: "CONMEBOL — South America",
  CONCACAF: "CONCACAF — North & Central America",
  CAF: "CAF — Africa",
  AFC: "AFC — Asia & Australia",
  OFC: "OFC — Oceania",
};
