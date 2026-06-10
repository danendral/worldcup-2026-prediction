export type StageKey =
  | "qualify"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "final"
  | "champion";

export interface TeamStages {
  qualify: number;
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number;
}

export interface Team {
  name: string;
  group: string;
  confederation: string;
  elo: number;
  stages: TeamStages;
  groupFinish: Record<string, number>;
}

export interface GroupTeam {
  name: string;
  confederation: string;
  qualify: number;
  champion: number;
  winGroup: number;
}

export interface Group {
  group: string;
  teams: GroupTeam[];
}

export interface GroupMatch {
  id: number;
  group: string;
  home: string;
  away: string;
  homeSlot: string;
  awaySlot: string;
  date: string;
  venue: string;
  hg: number;
  ag: number;
  corners: number;
  yellows: number;
  reds: number;
  winner: "home" | "away" | "draw";
}

export interface Alternative {
  home: string;
  away: string;
  prob: number;
}

export interface KnockoutMatch {
  id: number;
  round: string;
  multiplier: number;
  date: string;
  venue: string;
  homeSlot: string;
  awaySlot: string;
  home: string;
  away: string;
  hg: number;
  ag: number;
  corners: number;
  yellows: number;
  reds: number;
  winner: "home" | "away";
  penalties: boolean;
  homeWinProb: number | null;
  matchupConfidence: number | null;
  alternatives: Alternative[];
}

export interface Contender {
  name: string;
  group: string;
  confederation: string;
  champion: number;
  final: number;
  sf: number;
}

export interface Predictions {
  meta: {
    title: string;
    model: string;
    nSims: number;
    asOf: string;
    kickoff: string;
    window: string;
    host: string;
    matchesPredicted: number;
  };
  summary: {
    champion: string;
    championProb: number;
    bracketChampion: string;
    bracketRunnerUp: string;
    runnerUp: string;
    finalScore: string;
    finalPenalties: boolean;
    topContenders: Contender[];
    knockoutsToPens: number;
    stageOrder: StageKey[];
    stageLabels: Record<string, string>;
  };
  teams: Team[];
  groups: Group[];
  groupMatches: GroupMatch[];
  knockout: KnockoutMatch[];
}
