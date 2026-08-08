/**
 * Sidebar Industrial Admin — Industrial Models + Workspace Design Mode.
 * Somente navegação; sem lógica industrial.
 */

import { INDUSTRIAL_ADMIN_MODELS_PATH } from "../routes/industrialAdminPaths";
import { PIPRO_WORKSPACE_PATH } from "../routes/piproPaths";

export type AdminSidebarItem = {
  label: string;
  path: string;
};

export const industrialAdminSidebarItems: readonly AdminSidebarItem[] = [
  {
    label: "Industrial Models",
    path: INDUSTRIAL_ADMIN_MODELS_PATH,
  },
  {
    label: "Workspace Design Mode",
    path: PIPRO_WORKSPACE_PATH,
  },
];

export type AdminSidebarProps = {
  items?: readonly AdminSidebarItem[];
  activePath?: string;
  onNavigate?: (path: string) => void;
};

export function AdminSidebar({
  items = industrialAdminSidebarItems,
  activePath,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <nav data-testid="industrial-admin-sidebar" aria-label="Industrial Admin">
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((item) => {
          const active = activePath === item.path;
          return (
            <li key={item.path}>
              <a
                href={item.path}
                data-active={active ? "true" : "false"}
                onClick={(e) => {
                  if (!onNavigate) return;
                  e.preventDefault();
                  onNavigate(item.path);
                }}
                style={{
                  display: "block",
                  padding: "8px 10px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 13,
                  color: "var(--admin-text, var(--text-main))",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                }}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default AdminSidebar;
