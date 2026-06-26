import { Link, useLocation } from "react-router-dom";

import { industrialProjectsUrl } from "../../config/industrialApp";
import { nestingBtnStyle } from "../../ui/layouts/nesting/nestingLayoutStyles";

const STATIONS = [
  { key: "warehouse", label: "Armazém" },
  { key: "nesting", label: "Nesting" },
  { key: "drill", label: "Furação" },
  { key: "orlar", label: "Orlar" },
  { key: "montagem", label: "Montagem" },
  { key: "embalagem", label: "Embalagem" },
] as const;

function StationIcon({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>
      {label.slice(0, 3)}
    </span>
  );
}

export default function NestingV3StationSidebar() {
  const location = useLocation();
  const onNestingV3 = location.pathname === "/nesting_v3";

  return (
    <nav
      style={{
        display: "grid",
        gap: 8,
        justifyItems: "center",
        alignContent: "start",
      }}
      aria-label="Navegação"
    >
      <Link
        to="/nesting_v3"
        title="Layout de Corte MANUAL (Nesting V3)"
        style={{
          ...nestingBtnStyle(onNestingV3),
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          padding: 0,
        }}
      >
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.2 }}>V3</span>
      </Link>

      <div style={{ height: 1, width: "100%", background: "var(--border, #334155)", margin: "4px 0" }} />

      {STATIONS.map((station) => (
        <a
          key={station.key}
          href={industrialProjectsUrl()}
          title={`${station.label} (PIMO Industrial)`}
          style={{
            ...nestingBtnStyle(false),
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            textDecoration: "none",
            padding: 0,
          }}
        >
          <StationIcon label={station.label} />
        </a>
      ))}

      <div style={{ height: 1, width: "100%", background: "var(--border, #334155)", margin: "4px 0" }} />

      <a
        href={industrialProjectsUrl()}
        title="PIMO Industrial (MES)"
        style={{
          ...nestingBtnStyle(false),
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          padding: 0,
          fontSize: 10,
        }}
      >
        ⌂
      </a>
      <Link
        to="/"
        title="Workspace criativo"
        style={{
          ...nestingBtnStyle(false),
          width: 40,
          height: 40,
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          padding: 0,
          fontSize: 10,
        }}
      >
        3D
      </Link>
    </nav>
  );
}
