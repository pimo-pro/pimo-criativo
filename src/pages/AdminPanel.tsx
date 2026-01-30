import { useState } from "react";
import MaterialsManager from "../components/admin/MaterialsManager";
import TemplatesManager from "../components/admin/TemplatesManager";
import CADModelsManager from "../components/admin/CADModelsManager";
import MaterialsManufacturing from "../components/admin/MaterialsManufacturing";
import RulesManager from "../components/admin/RulesManager";

const sidebarItems = [
  "Dashboard",
  "Materials",
  "Materiais & Fabricação",
  "Ferragens",
  "Templates",
  "CAD Models",
  "Regras",
  "Pricing",
  "System Settings",
  "Users",
];

export default function AdminPanel() {
  const [active, setActive] = useState("Materials");

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        height: "100%",
        background: "radial-gradient(circle at top, #1e293b, #0b0f17 60%)",
      }}
    >
      <aside
        style={{
          width: 220,
          background: "rgba(15,23,42,0.92)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          padding: "18px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
          Admin Panel
        </div>
        {sidebarItems.map((item) => {
          const isDisabled = item === "Users";
          const isActive = active === item;
          return (
            <button
              key={item}
              onClick={() => !isDisabled && setActive(item)}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius)",
                border: "1px solid rgba(255,255,255,0.08)",
                background: isActive ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                color: "var(--text-main)",
                fontSize: 12,
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
              }}
            >
              {item}
            </button>
          );
        })}
      </aside>

      <section
        style={{
          flex: 1,
          padding: "24px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "var(--radius)",
            padding: "20px",
            minHeight: "calc(100vh - 48px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>
            {active}
          </div>

          {active === "Materials" ? (
            <MaterialsManager />
          ) : active === "Materiais & Fabricação" ? (
            <MaterialsManufacturing />
          ) : active === "Templates" ? (
            <TemplatesManager />
          ) : active === "CAD Models" ? (
            <CADModelsManager />
          ) : active === "Regras" ? (
            <RulesManager />
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Módulo em construção.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
