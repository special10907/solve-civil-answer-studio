/**
 * App Configuration
 * 중앙 집중식 설정 관리 (차트, 색상, 기본 데이터 등)
 */

export const CHART_LABELS = {
  strategy: ["이론 이해도", "계산 정확성", "답안 형식/가독성", "시간 관리", "응용력"],
  strategyDash: ["이론 이해도", "계산 정확성", "답안 형식", "시간 관리", "응용력"],
  examDist: ["구조역학", "RC/PSC", "강구조", "교량/유지관리", "기타"],
};

export const CHART_COLORS = {
  myStats: {
    background: "rgba(59, 130, 246, 0.2)",
    border: "rgb(59, 130, 246)",
    point: "rgb(59, 130, 246)",
  },
  top10: {
    background: "rgba(148, 163, 184, 0.2)",
    border: "rgb(148, 163, 184)",
    point: "rgb(148, 163, 184)",
  },
  examDist: [
    "rgba(59,130,246,0.8)",
    "rgba(20,184,166,0.8)",
    "rgba(249,115,22,0.8)",
    "rgba(168,85,247,0.8)",
    "rgba(148,163,184,0.8)",
  ],
  vibration: "rgb(167,139,250)",
};

export const CHART_DATA = {
  myStats: [85, 70, 90, 80, 65],
  top10: [95, 85, 90, 95, 80],
  examDist: [30, 25, 20, 15, 10],
};

export const APP_DEFAULTS = {
  backend: "http://localhost:8787",
  lmStudio: "http://127.0.0.1:1234/v1/chat/completions",
};
