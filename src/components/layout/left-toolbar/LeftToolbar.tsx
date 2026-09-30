import type { IconName } from "@/components/icons";
import { Icon } from "@/components/icons";

export type LeftToolbarItem = {
  id: string;
  label: string;
  icon: string;
  iconName: IconName;
  isHome?: boolean;
};

/** IDs da sidebar: nova ordem e significado. */
export const LEFT_TOOLBAR_IDS = {
  HOME: "home",
  MOVEIS: "moveis",
  MODELOS: "modelos",
  CALCULADORA: "calculadora",
  LAYOUT: "layout",
  SALA: "sala",
  ELETRO: "eletro",
  ACESSORIOS: "acessorios",
  INFO: "info",
} as const;

const toolbarItems: LeftToolbarItem[] = [
  { id: LEFT_TOOLBAR_IDS.HOME, label: "Início", icon: "π", iconName: "home", isHome: true },
  { id: LEFT_TOOLBAR_IDS.MOVEIS, label: "Móveis", icon: "M", iconName: "furniture" },
  { id: LEFT_TOOLBAR_IDS.MODELOS, label: "Modelos", icon: "◫", iconName: "models" },
  { id: LEFT_TOOLBAR_IDS.CALCULADORA, label: "Calculadora", icon: "⊕", iconName: "calculator" },
  { id: LEFT_TOOLBAR_IDS.ELETRO, label: "Eletro", icon: "E", iconName: "electro" },
  { id: LEFT_TOOLBAR_IDS.ACESSORIOS, label: "Acessórios", icon: "A", iconName: "accessories" },
  { id: LEFT_TOOLBAR_IDS.INFO, label: "Info", icon: "?", iconName: "info" },
];

type LeftToolbarProps = {
  selectedId: string;
  onSelect: (_id: string) => void;
};

export default function LeftToolbar({ selectedId, onSelect }: LeftToolbarProps) {
  const handleHomeClick = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    onSelect(LEFT_TOOLBAR_IDS.HOME);
  };

  return (
    <aside className="left-toolbar" aria-label="Navegação lateral">
      {toolbarItems.map((item) => {
        const isSelected = selectedId === item.id;
        if (item.isHome) {
          return (
            <button
              key={item.id}
              type="button"
              className={`left-toolbar-item ${isSelected ? "left-toolbar-item--selected" : ""}`}
              onClick={handleHomeClick}
              aria-label={item.label}
              aria-pressed={isSelected}
            >
              <span className="left-toolbar-icon" aria-hidden="true">
                <Icon name={item.iconName} size={22} aria-hidden />
              </span>
              <span className="left-toolbar-label">{item.label}</span>
            </button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={`left-toolbar-item ${isSelected ? "left-toolbar-item--selected" : ""}`}
            onClick={() => onSelect(item.id)}
            aria-label={item.label}
            aria-pressed={isSelected}
          >
            <span className="left-toolbar-icon" aria-hidden="true">
              <Icon name={item.iconName} size={22} aria-hidden />
            </span>
            <span className="left-toolbar-label">{item.label}</span>
          </button>
        );
      })}
    </aside>
  );
}
